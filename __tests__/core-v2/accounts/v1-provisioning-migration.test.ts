/**
 * Migration 0026 is additive and forward-only, interruption-safe, and its
 * constraints keep the saga non-secret and monotonic. Applied here on a scratch
 * database that first receives migrations 0001..0025 with live rows, exactly as
 * a production database would.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { createScratchDatabaseRegistry, type ScratchDatabase, type ScratchDatabaseRegistry } from '../helpers/scratch-database';
import { assertAccountV1ProvisioningSchema, V1_PROVISIONING_MIGRATION } from '@/lib/core-v2/accounts/v1-provisioning-schema';

const MIGRATIONS = join(process.cwd(), 'core-v2/prisma/migrations');
const adminUrl = process.env.CORE_V2_IDENTITY_TEST_ADMIN_URL ?? '';
let scratch: ScratchDatabase;
let db: Client;
// Declare explicitement : sans cela l'affectation creait une globale
// implicite — invisible a l'execution, mais non typable.
let registry: ScratchDatabaseRegistry | undefined;

const migrationNames = () => readdirSync(MIGRATIONS).filter((name) => /^\d{4}_/.test(name)).sort();
const sqlOf = (name: string) => readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8');

async function rowsDigest(): Promise<string> {
  const rows = await db.query(`
    SELECT (SELECT json_agg(u ORDER BY u.id) FROM users u) AS users,
           (SELECT json_agg(j ORDER BY j.id) FROM core_v2_job_outbox j) AS jobs`);
  return createHash('sha256').update(JSON.stringify(rows.rows)).digest('hex');
}

beforeAll(async () => {
  if (!adminUrl) throw new Error('CORE_V2_IDENTITY_TEST_ADMIN_URL is required');
  registry = createScratchDatabaseRegistry(adminUrl);
  scratch = await registry.create('d2_migration');
  db = new Client({ connectionString: scratch.url });
  await db.connect();
  for (const name of migrationNames().filter((candidate) => candidate < V1_PROVISIONING_MIGRATION)) {
    await db.query(sqlOf(name));
  }
  await db.query(`INSERT INTO users (id, role, email, "accountStatus", "updatedAt") VALUES ('legacy-user', 'PARENT', 'legacy@d2.example.test', 'ACTIVE', now())`);
  await db.query(`
    INSERT INTO core_v2_job_outbox (id, "jobType", "aggregateType", "aggregateId", "idempotencyKey", payload, "updatedAt")
    VALUES ('legacy-aria', 'RECOVER_ARIA_TURN', 'AriaConversationTurnCoreV2', 'turn-1', 'legacy-aria-key', '{"schemaVersion":"1","turnId":"turn-1"}', now()),
           ('legacy-handoff', 'ACCOUNT_EMAIL_HANDOFF', 'ACCOUNT_EMAIL_HANDOFF', 'issuance-1', 'legacy-handoff-key',
            jsonb_build_object('schemaVersion','account-email-handoff/v1','keyVersion','v1','iv',repeat('A',16),'tag',repeat('A',22),'ciphertext','abc'), now())`);
});
afterAll(async () => {
  await db?.end();
  await registry?.dropAll();
});

test('the migration list only grew: 0001..0025 are still present and 0026 keeps its rank', () => {
  const names = migrationNames();
  // The invariant is APPEND-ONLY, not "0026 is last". 0027 closes the key set of
  // the ARIA branch of the job-outbox payload check, so the tail has moved on.
  // Asserting a fixed tail would turn every future additive migration into a
  // failure — the guard must check rank and ordering, not length.
  expect(names.slice(0, 25)).toHaveLength(25);
  expect(names.indexOf(V1_PROVISIONING_MIGRATION)).toBe(25);
  expect(names).toEqual([...names].sort());
  expect(names.length).toBeGreaterThanOrEqual(26);
});

test('an interrupted 0026 rolls back completely and leaves the old rows byte-identical', async () => {
  const before = await rowsDigest();
  const sql = sqlOf(V1_PROVISIONING_MIGRATION);
  const interrupted = new Client({ connectionString: scratch.url });
  await interrupted.connect();
  await interrupted.query(sql.slice(0, sql.lastIndexOf('COMMIT;')));
  await interrupted.end(); // connection dropped inside the transaction
  const enumLabel = await db.query(`SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'CoreV2JobType' AND e.enumlabel = 'ACCOUNT_V1_PROVISIONING'`);
  expect(enumLabel.rowCount).toBe(0);
  expect((await db.query(`SELECT to_regclass('account_v1_provisioning') AS t`)).rows[0].t).toBeNull();
  expect(await rowsDigest()).toBe(before);
});

describe('after 0026', () => {
  beforeAll(async () => {
    await db.query(sqlOf(V1_PROVISIONING_MIGRATION));
  });

  test('every pre-existing row survives untouched and stays valid', async () => {
    expect((await db.query(`SELECT count(*)::int AS n FROM users WHERE id = 'legacy-user'`)).rows[0].n).toBe(1);
    expect((await db.query(`SELECT count(*)::int AS n FROM core_v2_job_outbox`)).rows[0].n).toBe(2);
    // The widened constraint validated against them (VALIDATE CONSTRAINT ran inside the migration).
    expect((await db.query(`SELECT convalidated FROM pg_constraint WHERE conname = 'core_v2_job_outbox_payload_check'`)).rows[0].convalidated).toBe(true);
  });

  test('the startup schema assertion refuses a database that lacks the migration record and accepts the proven one', async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (migration_name text, checksum text, finished_at timestamptz, rolled_back_at timestamptz)`);
    const client = { $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.reduce((acc, part, index) => `${acc}${part}${index < values.length ? `$${index + 1}` : ''}`, '');
      return (await db.query(text, values as string[])).rows;
    } };
    await expect(assertAccountV1ProvisioningSchema(client as never)).rejects.toThrow('ACCOUNT_V1_PROVISIONING_SCHEMA_UNAVAILABLE');
    const checksum = createHash('sha256').update(sqlOf(V1_PROVISIONING_MIGRATION)).digest('hex');
    await db.query(`INSERT INTO "_prisma_migrations" VALUES ($1, $2, now(), NULL)`, [V1_PROVISIONING_MIGRATION, checksum]);
    await expect(assertAccountV1ProvisioningSchema(client as never)).resolves.toBeUndefined();
    await db.query(`UPDATE "_prisma_migrations" SET checksum = 'tampered'`);
    await expect(assertAccountV1ProvisioningSchema(client as never)).rejects.toThrow('ACCOUNT_V1_PROVISIONING_SCHEMA_UNAVAILABLE');
  });

  const job = (key: string, aggregateId: string, payload: object) => db.query(
    `INSERT INTO core_v2_job_outbox (id, "jobType", "aggregateType", "aggregateId", "idempotencyKey", payload, "updatedAt")
     VALUES ($1, 'ACCOUNT_V1_PROVISIONING', 'ACCOUNT_V1_PROVISIONING', $2, $1, $3::jsonb, now())`,
    [key, aggregateId, JSON.stringify(payload)],
  );
  const base = { schemaVersion: 'account-v1-provisioning/v1', userId: 'u1', generation: 1, kind: 'ADVANCE' };

  test('the saga job payload is a closed, non-secret key set', async () => {
    await expect(job('ok-1', 'u1', base)).resolves.toBeDefined();
    await expect(job('ok-revoke', 'u1', { ...base, generation: 2, kind: 'REVOKE' })).resolves.toBeDefined();
    for (const extra of [{ role: 'ADMIN' }, { email: 'a@b.test' }, { rawToken: 'x'.repeat(40) }, { password: 'x'.repeat(12) }, { tokenHash: 'a'.repeat(64) }]) {
      await expect(job(`bad-${Object.keys(extra)[0]}`, 'u1', { ...base, ...extra })).rejects.toThrow(/payload_check/);
    }
    await expect(job('bad-missing', 'u1', { schemaVersion: base.schemaVersion, userId: 'u1', generation: 1 })).rejects.toThrow(/payload_check/);
    await expect(job('bad-kind', 'u1', { ...base, kind: 'SEND_PASSWORD' })).rejects.toThrow(/payload_check/);
    await expect(job('bad-generation', 'u1', { ...base, generation: 0 })).rejects.toThrow(/payload_check/);
    await expect(job('bad-generation-text', 'u1', { ...base, generation: '1' })).rejects.toThrow(/payload_check/);
    await expect(job('bad-aggregate', 'someone-else', base)).rejects.toThrow(/payload_check/);
  });

  describe('account_v1_provisioning', () => {
    beforeAll(async () => {
      await db.query(`INSERT INTO users (id, role, email, "accountStatus", "updatedAt") VALUES
        ('p1','ASSISTANTE','p1@d2.example.test','PENDING_ACTIVATION',now()), ('p2','COACH','p2@d2.example.test','PENDING_ACTIVATION',now()),
        ('p3','PARENT','p3@d2.example.test','PENDING_ACTIVATION',now())`);
    });
    const insert = (id: string, userId: string, extra: Record<string, unknown> = {}) => {
      const columns = { id, userId, ...extra };
      const names = Object.keys(columns).map((n) => `"${n}"`).join(', ');
      const marks = Object.keys(columns).map((_, i) => `$${i + 1}`).join(', ');
      return db.query(`INSERT INTO account_v1_provisioning (${names}, "updatedAt") VALUES (${marks}, now())`, Object.values(columns) as string[]);
    };

    test('one request per account, one account per v1 identity', async () => {
      await insert('s1', 'p1', { v1UserId: 'p1', state: 'SENT', invitationExpiresAt: new Date() });
      await expect(insert('s1-dup', 'p1')).rejects.toThrow(/userId_key/);
      await expect(insert('s2', 'p2', { v1UserId: 'p1', state: 'SENT', invitationExpiresAt: new Date() })).rejects.toThrow(/v1UserId_key/);
      await insert('s3', 'p3');
    });

    test('shape checks: link and expiry are mandatory where the state claims them, error codes are codes', async () => {
      await db.query(`INSERT INTO users (id, role, email, "accountStatus", "updatedAt") VALUES ('p4','COACH','p4@d2.example.test','PENDING_ACTIVATION',now()), ('p5','COACH','p5@d2.example.test','PENDING_ACTIVATION',now()), ('p6','COACH','p6@d2.example.test','PENDING_ACTIVATION',now())`);
      await expect(insert('c1', 'p4', { state: 'SENT', v1UserId: 'p4' })).rejects.toThrow(/sent_expiry_check/);
      await expect(insert('c2', 'p4', { state: 'V1_ACTIVATED' })).rejects.toThrow(/link_state_check/);
      await expect(insert('c3', 'p4', { state: 'CORE_PROVISIONED' })).rejects.toThrow(/link_state_check/);
      await expect(insert('c4', 'p4', { lastErrorCode: 'free text with a@b.test' })).rejects.toThrow(/error_code_check/);
      await expect(insert('c5', 'p4', { generation: 0 })).rejects.toThrow(/generation_check/);
      await expect(insert('c6', 'p4', { v1UserId: 'has space' })).rejects.toThrow(/v1_user_id_check/);
      await expect(insert('c7', 'p4', { state: 'NOT_A_STATE' })).rejects.toThrow();
      await expect(insert('c8', 'no-such-user')).rejects.toThrow(/userId_fkey/);
    });

    test('the link is immutable, a provisioned account stays provisioned, the generation never goes back', async () => {
      await db.query(`UPDATE account_v1_provisioning SET generation = 3 WHERE id = 's1'`);
      await expect(db.query(`UPDATE account_v1_provisioning SET generation = 2 WHERE id = 's1'`)).rejects.toThrow(/ACCOUNT_V1_GENERATION_MONOTONIC/);
      await expect(db.query(`UPDATE account_v1_provisioning SET "v1UserId" = 'other' WHERE id = 's1'`)).rejects.toThrow(/ACCOUNT_V1_LINK_IMMUTABLE/);
      await expect(db.query(`UPDATE account_v1_provisioning SET "userId" = 'p2' WHERE id = 's1'`)).rejects.toThrow(/ACCOUNT_V1_PROVISIONING_USER_IMMUTABLE/);
      await db.query(`UPDATE account_v1_provisioning SET state = 'CORE_PROVISIONED' WHERE id = 's1'`);
      await expect(db.query(`UPDATE account_v1_provisioning SET state = 'REQUESTED' WHERE id = 's1'`)).rejects.toThrow(/ACCOUNT_V1_PROVISIONED_IMMUTABLE/);
    });

    test('an account cannot be deleted from under its provisioning record', async () => {
      await expect(db.query(`DELETE FROM users WHERE id = 'p1'`)).rejects.toThrow(/userId_fkey/);
    });

    test('the table has no column able to hold a credential', async () => {
      const columns = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'account_v1_provisioning'`)).rows.map((r) => r.column_name as string);
      expect(columns.sort()).toEqual(['createdAt', 'generation', 'id', 'invitationExpiresAt', 'lastErrorCode', 'requestedById', 'state', 'updatedAt', 'userId', 'v1UserId']);
      expect(columns.some((name) => /pass|hash|token|secret|digest/i.test(name))).toBe(false);
    });
  });
});
