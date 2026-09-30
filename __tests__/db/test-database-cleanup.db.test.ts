/** Real PostgreSQL countertests for the mandatory db-core cleanup. */
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import { assertTestDbAvailable, DB_CORE_TRUNCATE_STATEMENT_TIMEOUT_MS, setupTestDatabase, testPrisma } from '../setup/test-database';

const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
const parent = `dbcore_parent_${suffix}`;
const child = `dbcore_child_${suffix}`;
const odd = `dbcore_odd_${suffix}_";drop table users;--`;
const externalSchema = `dbcore_external_${suffix}`;
const partitioned = `dbcore_partitioned_${suffix}`;
const triggerFunction = `dbcore_truncate_guard_${suffix}`;

function q(name: string) { return `"${name.replace(/"/g, '""')}"`; }
const parentName = `${q('public')}.${q(parent)}`;
const childName = `${q('public')}.${q(child)}`;
const oddName = `${q('public')}.${q(odd)}`;
const externalName = `${q(externalSchema)}.${q('dependent')}`;

async function count(sql: string): Promise<number> {
  const rows = await testPrisma.$queryRawUnsafe<Array<{ count: bigint }>>(sql);
  return Number(rows[0].count);
}

describe('disposable db-core cleanup', () => {
  beforeAll(async () => {
    await assertTestDbAvailable();
    await testPrisma.$executeRawUnsafe(`CREATE TABLE ${parentName} (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY)`);
    await testPrisma.$executeRawUnsafe(`CREATE TABLE ${childName} (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, parent_id bigint NOT NULL REFERENCES ${parentName}(id))`);
    await testPrisma.$executeRawUnsafe(`CREATE TABLE ${oddName} (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY)`);
  }, 10_000);

  afterAll(async () => {
    await testPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${q(externalSchema)} CASCADE`);
    await testPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${q('public')}.${q(partitioned)}`);
    await testPrisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${q('public')}.${q(triggerFunction)}()`);
    await testPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${childName}`);
    await testPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${parentName}`);
    await testPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${oddName}`);
    await testPrisma.$disconnect();
  }, 30_000);

  it('uses one grouped TRUNCATE, preserves migrations, resets identities and keeps FK enforcement', async () => {
    const migrationsBefore = await count('SELECT count(*) FROM public._prisma_migrations');
    await testPrisma.$executeRawUnsafe(`INSERT INTO ${parentName} DEFAULT VALUES`);
    await testPrisma.$executeRawUnsafe(`INSERT INTO ${childName} (parent_id) VALUES (1)`);
    await testPrisma.$executeRawUnsafe(`INSERT INTO ${oddName} DEFAULT VALUES`);

    const metrics = await setupTestDatabase();
    expect(metrics.cleanupStatements).toBe(1);
    expect(metrics.tables).toBeGreaterThan(2);
    expect(await count(`SELECT count(*) FROM ${parentName}`)).toBe(0);
    expect(await count(`SELECT count(*) FROM ${childName}`)).toBe(0);
    expect(await count(`SELECT count(*) FROM ${oddName}`)).toBe(0);
    expect(await count('SELECT count(*) FROM public._prisma_migrations')).toBe(migrationsBefore);
    const inserted = await testPrisma.$queryRawUnsafe<Array<{ id: bigint }>>(`INSERT INTO ${parentName} DEFAULT VALUES RETURNING id`);
    expect(inserted[0].id).toBe(BigInt(1));
    await expect(testPrisma.$executeRawUnsafe(`INSERT INTO ${childName} (parent_id) VALUES (999)`)).rejects.toThrow();
  }, 30_000);

  it('refuses a non-disposable target before any write', async () => {
    await testPrisma.$executeRawUnsafe(`INSERT INTO ${oddName} DEFAULT VALUES`);
    const before = await count(`SELECT count(*) FROM ${oddName}`);
    const marker = process.env.NEXUS_DISPOSABLE_POSTGRES;
    process.env.NEXUS_DISPOSABLE_POSTGRES = '0';
    try {
      await expect(setupTestDatabase()).rejects.toThrow('DISPOSABLE_POSTGRES_GUARD_FAILED');
    } finally {
      if (marker === undefined) delete process.env.NEXUS_DISPOSABLE_POSTGRES;
      else process.env.NEXUS_DISPOSABLE_POSTGRES = marker;
    }
    expect(await count(`SELECT count(*) FROM ${oddName}`)).toBe(before);
  });

  it('fails atomically rather than cascading into a referencing schema', async () => {
    await testPrisma.$executeRawUnsafe(`CREATE SCHEMA ${q(externalSchema)}`);
    await testPrisma.$executeRawUnsafe(`CREATE TABLE ${externalName} (parent_id bigint REFERENCES ${parentName}(id))`);
    await testPrisma.$executeRawUnsafe(`INSERT INTO ${parentName} DEFAULT VALUES`);
    await testPrisma.$executeRawUnsafe(`INSERT INTO ${externalName} (parent_id) SELECT max(id) FROM ${parentName}`);
    const parentBefore = await count(`SELECT count(*) FROM ${parentName}`);
    const outsideBefore = await count(`SELECT count(*) FROM ${externalName}`);
    try {
      await expect(setupTestDatabase()).rejects.toThrow();
      expect(await count(`SELECT count(*) FROM ${parentName}`)).toBe(parentBefore);
      expect(await count(`SELECT count(*) FROM ${externalName}`)).toBe(outsideBefore);
    } finally {
      await testPrisma.$executeRawUnsafe(`DROP SCHEMA ${q(externalSchema)} CASCADE`);
    }
  }, 30_000);

  it('rejects an ON TRUNCATE trigger without disabling it', async () => {
    await testPrisma.$executeRawUnsafe(`CREATE FUNCTION ${q('public')}.${q(triggerFunction)}() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NULL; END'`);
    await testPrisma.$executeRawUnsafe(`CREATE TRIGGER ${q(`dbcore_truncate_${suffix}`)} BEFORE TRUNCATE ON ${oddName} FOR EACH STATEMENT EXECUTE FUNCTION ${q('public')}.${q(triggerFunction)}()`);
    try {
      await expect(setupTestDatabase()).rejects.toThrow('DB_CORE_CLEANUP_ON_TRUNCATE_TRIGGER_REQUIRES_REVIEW');
    } finally {
      await testPrisma.$executeRawUnsafe(`DROP TRIGGER ${q(`dbcore_truncate_${suffix}`)} ON ${oddName}`);
    }
  });

  it('rejects a partitioned public table rather than traversing its children', async () => {
    await testPrisma.$executeRawUnsafe(`CREATE TABLE ${q('public')}.${q(partitioned)} (id integer) PARTITION BY RANGE (id)`);
    await testPrisma.$executeRawUnsafe(`CREATE TABLE ${q('public')}.${q(`${partitioned}_child`)} PARTITION OF ${q('public')}.${q(partitioned)} FOR VALUES FROM (0) TO (10)`);
    try {
      await expect(setupTestDatabase()).rejects.toThrow('DB_CORE_CLEANUP_PARTITION_OR_INHERITANCE_REQUIRES_REVIEW');
    } finally {
      await testPrisma.$executeRawUnsafe(`DROP TABLE ${q('public')}.${q(partitioned)}`);
    }
  });

  it('bounds a conflicting lock and leaves no cleanup running after failure', async () => {
    await testPrisma.$executeRawUnsafe(`INSERT INTO ${oddName} DEFAULT VALUES`);
    const before = await count(`SELECT count(*) FROM ${oddName}`);
    const blocker = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL } },
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { locked = resolve; });
    const blockerTask = blocker.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`LOCK TABLE ${oddName} IN ACCESS SHARE MODE`);
      locked();
      await held;
    }, { timeout: 10_000 });
    await lockAcquired;
    try {
      await expect(setupTestDatabase()).rejects.toThrow();
    } finally {
      release();
      await blockerTask;
      await blocker.$disconnect();
    }
    expect(await count(`SELECT count(*) FROM ${oddName}`)).toBe(before);
    // A second cleanup must succeed immediately; the failed SQL did not survive its return.
    const metrics = await setupTestDatabase();
    expect(metrics.cleanupStatements).toBe(1);
    expect(await count(`SELECT count(*) FROM ${oddName}`)).toBe(0);
  }, 30_000);

  it('cancels an active SQL statement server-side before returning an error', async () => {
    const timeoutMs = DB_CORE_TRUNCATE_STATEMENT_TIMEOUT_MS;
    const started = performance.now();
    await expect(testPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${timeoutMs}ms'`);
      await tx.$queryRawUnsafe(`SELECT pg_sleep(${(timeoutMs + 1500) / 1000})`);
    }, { timeout: 30_000 })).rejects.toThrow();
    expect(performance.now() - started).toBeLessThan(timeoutMs + 2500);
    const active = await testPrisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'active'
        AND query LIKE '%pg_sleep%'
    `;
    expect(active[0].count).toBe(BigInt(0));
  }, 22_000);
});
