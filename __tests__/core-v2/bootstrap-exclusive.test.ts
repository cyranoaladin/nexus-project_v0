import { bootstrapV1Admin } from '@/lib/core-v2/accounts/bootstrap-v1-admin';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { upsertStaffActors } from '@/scripts/core-v2/sync-staff-actors';
import { resetCoreV2Database } from './helpers/reset-db';
import type { PrismaClient } from '@/core-v2/generated/client';
import { objectHash } from '@/scripts/core-v2/migration/transform';
import { buildStaffActorRecord } from '@/scripts/core-v2/sync-staff-actors';
import { bootstrapFirstAdmin } from '@/lib/core-v2/services/staff-account';

const id = 'authoritative-v1-admin-0001';
const snapshot = { id, role: 'ADMIN', activatedAt: new Date('2026-01-01'), disabledAt: null, mergedIntoUserId: null };
// Instants relatifs à l'horloge réelle : le déclencheur SQL de l'expiration compare à clock_timestamp().
// Une date figée transformait ces tests en bombe à retardement (manifeste « expiré » dès le lendemain).
const at = new Date(Math.floor(Date.now() / 1000) * 1000);
const expiresAt = new Date(at.getTime() + 86_400_000).toISOString();
const afterExpiry = new Date(at.getTime() + 2 * 86_400_000);
const sha = 'a'.repeat(40);
const assistant = { id: 'authoritative-assistant-0001', role: 'ASSISTANTE' as const,
  email: null, firstName: null, lastName: null, phone: null,
  accountStatus: 'ACTIVE' as const, coachProfileId: null };

describe('first ADMIN exclusive boundary — real PostgreSQL', () => {
  let client: PrismaClient;
  beforeAll(async () => { client = await requireCoreV2Client(); });
  beforeEach(async () => { await resetCoreV2Database(client); });
  afterAll(async () => { await disconnectCoreV2Client(); });

  async function options(patch: Record<string, unknown> = {}) {
    const [identity] = await client.$queryRaw<Array<{ value: string }>>`
      SELECT COALESCE(to_jsonb(i)->>'instanceId', i."schemaIdentity") AS value
      FROM core_v2_database_identity i WHERE id = 1`;
    const [head] = await client.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1`;
    const body = { finalSha: sha, databaseIdentity: identity.value, migrationHead: head.migration_name,
      v1UserId: id, expectedV1State: { role: 'ADMIN', activated: true, disabled: false, merged: false },
      capability: 'ADMIN', nonce: 'authoritative-nonce-0001', expiresAt,
      reason: 'CORE_V2_GO_LIVE', ...patch };
    const manifest = { ...body, fingerprint: objectHash(body) };
    return { nonce: String(body.nonce), expectedV1UserId: String(body.v1UserId),
      manifest, expectedReleaseSha: sha, now: () => at };
  }

  async function bootstrap() { return bootstrapV1Admin(client, snapshot, await options()); }

  test('real expiration after application writes but before commit rolls back ADMIN, receipt and attestation', async () => {
    const expiry = new Date(Date.now() + 1_500);
    const opts = await options({ expiresAt: expiry.toISOString() });
    let wroteBeforeCommit = false;
    const delayed = new Proxy(client, { get(target, property) {
      if (property === '$transaction') return (fn: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<unknown>) =>
        target.$transaction(async tx => {
          const result = await fn(tx);
          wroteBeforeCommit = await tx.coreAdminBootstrap.count() === 1 && await tx.user.count({ where: { role: 'ADMIN' } }) === 1;
          await tx.$executeRaw`SELECT pg_sleep((GREATEST(EXTRACT(EPOCH FROM (${expiry}::timestamptz - clock_timestamp())), 0) + 0.1)::double precision)`;
          return result;
        });
      return Reflect.get(target, property);
    } });
    await expect(bootstrapV1Admin(delayed, snapshot, opts)).rejects.toThrow('MANIFEST_EXPIRED');
    expect(wroteBeforeCommit).toBe(true);
    expect(await client.user.count()).toBe(0); expect(await client.auditEvent.count()).toBe(0);
    expect(await client.coreAdminBootstrap.count()).toBe(0);
  });

  test.each(['checksum', 'trigger-disabled'] as const)('bootstrap refuses a tampered %s before any write', async fault => {
    const opts = await options();
    const [migration] = await client.$queryRaw<Array<{ checksum: string }>>`SELECT checksum FROM public._prisma_migrations
      WHERE migration_name = '0031_core_v2_bootstrap_commit_expiry'`;
    if (fault === 'checksum') await client.$executeRaw`UPDATE public._prisma_migrations SET checksum = 'synthetic-tamper'
      WHERE migration_name = '0031_core_v2_bootstrap_commit_expiry'`;
    else await client.$executeRawUnsafe('ALTER TABLE public.core_admin_bootstrap DISABLE TRIGGER core_admin_bootstrap_commit_expiry');
    try {
      await expect(bootstrapV1Admin(client, snapshot, opts)).rejects.toThrow('BOOTSTRAP_SCHEMA_UNAVAILABLE');
      expect(await client.user.count()).toBe(0); expect(await client.auditEvent.count()).toBe(0);
      expect(await client.coreAdminBootstrap.count()).toBe(0);
    } finally {
      await client.$executeRaw`UPDATE public._prisma_migrations SET checksum = ${migration.checksum}
        WHERE migration_name = '0031_core_v2_bootstrap_commit_expiry'`;
      await client.$executeRawUnsafe('ALTER TABLE public.core_admin_bootstrap ENABLE TRIGGER core_admin_bootstrap_commit_expiry');
    }
  });

  test('a manifest expiring during its final authority check rolls back actor and receipt', async () => {
    let current = at;
    let checks = 0;
    const opts = { ...await options({ expiresAt: new Date(at.getTime() + 1_000).toISOString() }),
      now: () => current, verifyAuthoritativeV1: async () => { if (++checks === 2) current = new Date(at.getTime() + 2_000); } };
    await expect(bootstrapV1Admin(client, snapshot, opts)).rejects.toThrow('MANIFEST_EXPIRED');
    expect(await client.user.count()).toBe(0); expect(await client.auditEvent.count()).toBe(0);
    expect(await client.coreAdminBootstrap.count()).toBe(0);
  });
  test('a failed newer migration refuses bootstrap without an actor or receipt', async () => {
    const opts = await options();
    await client.$executeRaw`INSERT INTO public._prisma_migrations (id, checksum, migration_name, started_at)
      VALUES ('synthetic-dirty-migration', 'synthetic', '9999_synthetic_failure', CURRENT_TIMESTAMP)`;
    try {
      await expect(bootstrapV1Admin(client, snapshot, opts)).rejects.toThrow('BOOTSTRAP_MIGRATIONS_INCOMPLETE');
      expect(await client.user.count()).toBe(0); expect(await client.auditEvent.count()).toBe(0);
      expect(await client.coreAdminBootstrap.count()).toBe(0);
    } finally { await client.$executeRaw`DELETE FROM public._prisma_migrations WHERE id = 'synthetic-dirty-migration'`; }
  });

  test.each([1, 2])('loss of the V1 authority lease at precommit check %i rolls back every Core write', async failureAt => {
    let checks = 0;
    const opts = { ...await options(), verifyAuthoritativeV1: async () => {
      if (++checks === failureAt) throw new Error('V1_AUTHORITY_LEASE_LOST');
    } };
    await expect(bootstrapV1Admin(client, snapshot, opts)).rejects.toThrow('V1_AUTHORITY_LEASE_LOST');
    expect(await client.user.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
    expect(await client.coreAdminBootstrap.count()).toBe(0);
  });

  test('dry-run validates the whole manifest and state without any write', async () => {
    expect((await bootstrapV1Admin(client, snapshot, { ...await options(), dryRun: true })).outcome).toBe('READY');
    expect(await client.user.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
    expect(await client.coreAdminBootstrap.count()).toBe(0);
    await client.user.create({ data: { id, role: 'ADMIN', accountStatus: 'ACTIVE' } });
    await expect(bootstrapV1Admin(client, snapshot, { ...await options(), dryRun: true }))
      .rejects.toThrow(/UNATTESTED_ADMIN_STATE/);
  });

  test('sync before bootstrap refuses and performs zero writes', async () => {
    await expect(upsertStaffActors(client, [assistant], { execute: true })).rejects.toThrow(/BOOTSTRAP_REQUIRED/);
    expect(await client.user.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
    expect(await client.coachProfile.count()).toBe(0);
  });

  test('bootstrap never adopts an ADMIN without its receipt', async () => {
    await client.user.create({ data: { id, role: 'ADMIN', accountStatus: 'ACTIVE' } });
    const before = await client.user.findMany();
    await expect(bootstrapV1Admin(client, snapshot, await options())).rejects.toThrow(/UNATTESTED_ADMIN_STATE/);
    expect(await client.user.findMany()).toEqual(before);
    expect(await client.auditEvent.count()).toBe(0);
  });

  test('valid bootstrap creates exactly one ADMIN and one bound receipt atomically', async () => {
    const outcome = await bootstrap();
    expect(outcome.outcome).toBe('PROVISIONED');
    expect(await client.user.count({ where: { role: 'ADMIN' } })).toBe(1);
    const receipt = await client.auditEvent.findUnique({ where: { id: outcome.receiptId } });
    const opts = await options();
    expect(receipt?.metadata).toMatchObject(opts.manifest);
    expect(await client.invitation.count()).toBe(0);
    expect(await client.coreV2JobOutbox.count()).toBe(0);
    expect((await client.user.findUnique({ where: { id } }))?.password).toBeNull();
  });

  test('second identical bootstrap is a strict no-op', async () => {
    await bootstrap();
    const users = await client.user.findMany();
    const receipts = await client.auditEvent.findMany();
    expect((await bootstrap()).outcome).toBe('ALREADY_PROVISIONED');
    expect(await client.user.findMany()).toEqual(users);
    expect(await client.auditEvent.findMany()).toEqual(receipts);
  });

  test('manifest expiration while waiting for the lock refuses without writes', async () => {
    let calls = 0;
    await expect(bootstrapV1Admin(client, snapshot, { ...await options(),
      now: () => ++calls === 1 ? at : afterExpiry }))
      .rejects.toThrow('MANIFEST_EXPIRED');
    expect(await client.user.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
  });

  test('authoritative V1 revalidation occurs under the Core lock and refuses a newly suspended identity', async () => {
    let lockHeld = false;
    await expect(bootstrapV1Admin(client, snapshot, { ...await options(), readAuthoritativeV1: async () => {
      lockHeld = await client.$transaction(async tx => {
        const [result] = await tx.$queryRaw<Array<{ available: boolean }>>`SELECT pg_try_advisory_xact_lock(4242, 1026) AS available`;
        return !result.available;
      });
      return { ...snapshot, disabledAt: at };
    } })).rejects.toThrow('The v1 administrator is disabled.');
    expect(lockHeld).toBe(true);
    expect(await client.user.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
  });

  test('a coach profile bound to another identity refuses the whole sync batch', async () => {
    await bootstrap();
    await client.user.create({ data: { id: 'other-coach-identity', role: 'COACH', accountStatus: 'ACTIVE' } });
    await client.coachProfile.create({ data: { id: 'shared-coach-profile', userId: 'other-coach-identity' } });
    const before = await client.user.findMany({ orderBy: { id: 'asc' } });
    await expect(upsertStaffActors(client, [assistant, { ...assistant, id: 'new-coach-identity', role: 'COACH',
      coachProfileId: 'shared-coach-profile' }], { execute: true })).rejects.toThrow('SYNC_COACH_PROFILE_IDENTITY_CONFLICT');
    expect(await client.user.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    expect(await client.auditEvent.count()).toBe(1);
  });

  test('two concurrent identical bootstraps produce one effect', async () => {
    const outcomes = await Promise.all([bootstrap(), bootstrap()]);
    expect(outcomes.map(o => o.outcome).sort()).toEqual(['ALREADY_PROVISIONED', 'PROVISIONED']);
    expect(await client.user.count()).toBe(1);
    expect(await client.auditEvent.count()).toBe(1);
  });

  test.each([
    ['wrong SHA', { finalSha: 'b'.repeat(40) }, 'MANIFEST_RELEASE_MISMATCH'],
    ['wrong database instance', { databaseIdentity: 'another-instance' }, 'MANIFEST_DATABASE_MISMATCH'],
    ['wrong migration head', { migrationHead: '0001_core_v2_baseline' }, 'MANIFEST_MIGRATION_HEAD_MISMATCH'],
    ['expired manifest', { expiresAt: '2026-10-11T12:00:00Z' }, 'MANIFEST_EXPIRED'],
    ['wrong identity', { v1UserId: 'another-v1-admin-0001' }, 'MANIFEST_V1_IDENTITY_MISMATCH'],
    ['wrong constant role', { capability: 'ASSISTANTE' }, 'MANIFEST_INVALID'],
  ])('%s refuses before any mutation', async (_name, patch, code) => {
    await expect(bootstrapV1Admin(client, snapshot, await options(patch))).rejects.toThrow(code);
    expect(await client.user.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
  });

  test('replayed nonce with changed attested content refuses', async () => {
    await bootstrap();
    const before = await client.auditEvent.findMany();
    await expect(bootstrapV1Admin(client, snapshot, await options({ reason: 'DIFFERENT_REASON' })))
      .rejects.toThrow(/BOOTSTRAP_MANIFEST_REPLAY/);
    expect(await client.auditEvent.findMany()).toEqual(before);
    expect(await client.user.count()).toBe(1);
  });

  test('orphan receipt refuses closed without adoption', async () => {
    const orphan = { actorUserId: id, action: 'account.bootstrap_v1_admin',
      subjectType: 'User', subjectId: id, correlationId: 'orphan-nonce-00001' };
    // Even the disposable superuser cannot commit an orphan normally. Inject
    // historic corruption only by explicitly disabling its commit constraint.
    await expect(client.auditEvent.create({ data: orphan })).rejects.toThrow('UNATTESTED_ADMIN_STATE');
    expect(await client.auditEvent.count()).toBe(0);
    await client.$executeRawUnsafe('ALTER TABLE public.audit_events DISABLE TRIGGER core_reserved_admin_receipt_commit');
    try { await client.auditEvent.create({ data: orphan }); }
    finally { await client.$executeRawUnsafe('ALTER TABLE public.audit_events ENABLE TRIGGER core_reserved_admin_receipt_commit'); }
    const before = await client.auditEvent.findMany();
    await expect(bootstrap()).rejects.toThrow(/UNATTESTED_ADMIN_STATE/);
    expect(await client.user.count()).toBe(0);
    expect(await client.auditEvent.findMany()).toEqual(before);
  });

  test.each(['ADMIN', 'admin', 'Admin'])('V1 role injection %s is never mapped by sync', role => {
    expect(() => buildStaffActorRecord({ ...snapshot, email: null, firstName: null, lastName: null,
      phone: null, password: null, coachProfileId: null, role })).toThrow(/NOT_SYNC_STAFF_ROLE/);
  });

  test('sync cannot promote a non-ADMIN by injected records after bootstrap', async () => {
    await bootstrap();
    await upsertStaffActors(client, [assistant], { execute: true });
    const users = await client.user.findMany({ orderBy: { id: 'asc' } });
    const audit = await client.auditEvent.findMany({ orderBy: { id: 'asc' } });
    await expect(upsertStaffActors(client, [{ ...assistant, role: 'ADMIN' }], { execute: true }))
      .rejects.toThrow(/NOT_SYNC_STAFF_ROLE/);
    expect(await client.user.findMany({ orderBy: { id: 'asc' } })).toEqual(users);
    expect(await client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(audit);
  });

  test('sync after bootstrap leaves the attested ADMIN unchanged and repeats as a no-op', async () => {
    await bootstrap();
    const admin = await client.user.findUnique({ where: { id } });
    const first = await upsertStaffActors(client, [assistant], { execute: true });
    expect(first).toMatchObject({ adminCreates: 0, adminPromotions: 0 });
    const before = await client.user.findMany({ orderBy: { id: 'asc' } });
    const audit = await client.auditEvent.findMany({ orderBy: { id: 'asc' } });
    const second = await upsertStaffActors(client, [assistant], { execute: true });
    expect(second.users).toEqual({ created: 0, updated: 0, unchanged: 1 });
    expect(await client.user.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    expect(await client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(audit);
    expect(await client.user.findUnique({ where: { id } })).toEqual(admin);
  });

  test('sync preserves a Core suspension independently of an active V1 snapshot', async () => {
    await bootstrap();
    await upsertStaffActors(client, [assistant], { execute: true });
    await client.user.update({ where: { id: assistant.id }, data: { accountStatus: 'SUSPENDED' } });
    await upsertStaffActors(client, [assistant], { execute: true });
    expect((await client.user.findUnique({ where: { id: assistant.id } }))?.accountStatus).toBe('SUSPENDED');
  });

  test('a suspension requested during sync is serialized and preserved', async () => {
    await bootstrap();
    await upsertStaffActors(client, [assistant], { execute: true });
    let intercepted = false;
    let suspension: Promise<unknown> | undefined;
    const wrapped = { $transaction: (fn: (tx: unknown) => Promise<unknown>) => client.$transaction(tx => fn({
      ...tx, user: { ...tx.user, findUnique: async (args: Parameters<typeof tx.user.findUnique>[0]) => {
        const result = await tx.user.findUnique(args);
        if (!intercepted && args.where.id === assistant.id) {
          intercepted = true;
          // Start a separate writer without awaiting it inside the held authority lock.
          // Awaiting here would manufacture a self-deadlock instead of a legal race.
          suspension = Promise.resolve(client.user.update({ where: { id: assistant.id }, data: { accountStatus: 'SUSPENDED' } }));
        }
        return result;
      } },
    })) } as unknown as PrismaClient;
    await upsertStaffActors(wrapped, [{ ...assistant, lastName: 'Renamed' }], { execute: true });
    await suspension;
    expect(intercepted).toBe(true);
    expect((await client.user.findUnique({ where: { id: assistant.id } }))?.accountStatus).toBe('SUSPENDED');
    expect((await client.user.findUnique({ where: { id: assistant.id } }))?.lastName).toBe('Renamed');
  });

  test('concurrent bootstrap and sync never let sync create an ADMIN', async () => {
    const outcomes = await Promise.allSettled([bootstrap(), upsertStaffActors(client, [assistant], { execute: true })]);
    expect(outcomes[0].status).toBe('fulfilled');
    expect(await client.user.count({ where: { role: 'ADMIN' } })).toBe(1);
    expect(await client.auditEvent.count({ where: { action: 'account.bootstrap_v1_admin' } })).toBe(1);
    if (outcomes[1].status === 'rejected') {
      expect(String(outcomes[1].reason)).toContain('BOOTSTRAP_REQUIRED');
      expect(await client.user.count()).toBe(1);
    }
  });

  test('historical credential bootstrap refuses under V1_ONLY at its service boundary', async () => {
    const prior = process.env.CORE_V2_AUTH_MODE;
    process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
    try {
      await expect(bootstrapFirstAdmin(client, { email: 'owner@example.test', firstName: 'Test', lastName: 'Owner' }))
        .rejects.toThrow('The legacy administrator bootstrap is closed; use bootstrap-v1-admin.');
      expect(await client.user.count()).toBe(0);
    } finally {
      if (prior === undefined) delete process.env.CORE_V2_AUTH_MODE;
      else process.env.CORE_V2_AUTH_MODE = prior;
    }
  });
});
