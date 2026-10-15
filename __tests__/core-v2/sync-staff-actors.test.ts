/**
 * Unidirectional V1 -> Core v2 STAFF-actor sync (Core v2 §3 data authorities).
 *
 * The gap this closes: in CORE_V2_AUTH_MODE=V1_ONLY, lib/core-v2/http/actor.ts
 * resolveActor() maps a signed-in V1 session to a Core v2 `users` row BY ID and
 * requires accountStatus=ACTIVE. With no such row every v2 staff panel returns
 * 403 ACTOR_NOT_IN_CORE_V2. No existing production tool creates staff actors in
 * V1_ONLY (bootstrap-admin needs Core v2 auth + mints a fresh id; the roster
 * migrator needs >=1 student and skips ADMIN/ASSISTANTE). This sync is the
 * V1_ONLY-compatible path for staff actors only. Capabilities are role-derived
 * (lib/core-v2/rbac.ts), never stored per user.
 *
 * Runs in the dedicated Core v2 lane (jest.core-v2.config.js) against a
 * disposable CORE_V2_DATABASE_URL. Pure-core cases need no database.
 */
import {
  buildStaffActorRecord,
  isStaffRole,
  upsertStaffActors,
  STAFF_ROLES,
  type SourceStaffUser,
  type StaffActorRecord,
} from '@/scripts/core-v2/sync-staff-actors';
import { resolveActor } from '@/lib/core-v2/http/actor';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { bootstrapTestAdmin } from './helpers/bootstrap';
import { resetCoreV2Database } from './helpers/reset-db';
import type { PrismaClient } from '@/core-v2/generated/client';

function sourceStaff(overrides: Partial<SourceStaffUser> = {}): SourceStaffUser {
  return {
    id: 'u-assistant-1',
    email: 'Owner@NexusReussite.Academy',
    role: 'ASSISTANTE',
    firstName: 'Owner',
    lastName: 'Admin',
    phone: null,
    // Credentials are deliberately irrelevant to Core membership.
    password: 'xxxxxxxx',
    activatedAt: new Date('2026-01-01T00:00:00Z'),
    coachProfileId: null,
    ...overrides,
  };
}

describe('buildStaffActorRecord — pure mapping (no DB)', () => {
  test('maps a staff user to an ACTIVE actor record with normalized email', () => {
    const r = buildStaffActorRecord(sourceStaff());
    expect(r.id).toBe('u-assistant-1');
    expect(r.role).toBe('ASSISTANTE');
    expect(r.accountStatus).toBe('ACTIVE');
    expect(r.email).toBe('owner@nexusreussite.academy');
    expect(r.coachProfileId).toBeNull();
  });

  test('activation, independently of password, determines initial membership', () => {
    expect(buildStaffActorRecord(sourceStaff({ password: null })).accountStatus).toBe('ACTIVE');
    expect(buildStaffActorRecord(sourceStaff({ activatedAt: null })).accountStatus).toBe('PENDING_ACTIVATION');
  });

  test('null email passes through as null (email is not the actor key)', () => {
    expect(buildStaffActorRecord(sourceStaff({ email: null })).email).toBeNull();
  });

  test('coachProfileId is kept only for COACH, dropped for ADMIN/ASSISTANTE', () => {
    expect(buildStaffActorRecord(sourceStaff({ role: 'COACH', coachProfileId: 'cp-1' })).coachProfileId).toBe('cp-1');
    expect(buildStaffActorRecord(sourceStaff({ role: 'ASSISTANTE', coachProfileId: 'cp-1' })).coachProfileId).toBeNull();
  });

  test('refuses a non-staff role (never mirror PARENT/ELEVE as actors)', () => {
    expect(() => buildStaffActorRecord(sourceStaff({ role: 'PARENT' }))).toThrow(/NOT_SYNC_STAFF_ROLE/);
    expect(isStaffRole('ELEVE')).toBe(false);
    expect(STAFF_ROLES).toEqual(['ADMIN', 'ASSISTANTE', 'COACH']);
  });
});

describe('upsertStaffActors — idempotent DB sync against a disposable Core v2', () => {
  let client: PrismaClient;

  beforeAll(async () => {
    client = (await requireCoreV2Client()) as unknown as PrismaClient;
  });
  afterAll(async () => {
    await disconnectCoreV2Client().catch(() => undefined);
  });
  beforeEach(async () => {
    await resetCoreV2Database(client);
    await bootstrapTestAdmin(client);
  });

  const records: StaffActorRecord[] = [
    buildStaffActorRecord(sourceStaff({ id: 'u-assist', role: 'ASSISTANTE', email: 'b@x.tn' })),
    buildStaffActorRecord(sourceStaff({ id: 'u-coach', role: 'COACH', email: 'c@x.tn', coachProfileId: 'cp-coach' })),
  ];

  test('first --execute creates the staff actors and the coach profile', async () => {
    const report = await upsertStaffActors(client, records, { execute: true });
    expect(report.mode).toBe('EXECUTE');
    expect(report.users).toEqual({ created: 2, updated: 0, unchanged: 0 });
    expect(report.coachProfiles).toEqual({ created: 1, unchanged: 0 });
    const admin = await client.user.findUnique({ where: { id: 'authoritative-test-admin' }, select: { role: true, accountStatus: true, password: true } });
    expect(admin).toMatchObject({ role: 'ADMIN', accountStatus: 'ACTIVE', password: null });
    const cp = await client.coachProfile.findUnique({ where: { id: 'cp-coach' }, select: { userId: true } });
    expect(cp?.userId).toBe('u-coach');
  });

  test('a signed-in V1 staff session resolves to a Core v2 actor (no 403)', async () => {
    await upsertStaffActors(client, records, { execute: true });
    await expect(resolveActor(client, 'authoritative-test-admin')).resolves.toEqual({ userId: 'authoritative-test-admin', role: 'ADMIN' });
    await expect(resolveActor(client, 'u-coach')).resolves.toEqual({ userId: 'u-coach', role: 'COACH' });
  });

  test('re-running --execute is a pure no-op (idempotent): everything unchanged, no duplicates', async () => {
    await upsertStaffActors(client, records, { execute: true });
    const second = await upsertStaffActors(client, records, { execute: true });
    // A create already wrote exactly the desired state, so the second pass must
    // detect no drift and touch nothing.
    expect(second.users).toEqual({ created: 0, updated: 0, unchanged: 2 });
    expect(second.coachProfiles).toEqual({ created: 0, unchanged: 1 });
    expect(await client.user.count()).toBe(3);
    expect(await client.coachProfile.count()).toBe(1);
  });

  test('a changed V1 attribute (e.g. renamed staff) is converged as an update, not a duplicate', async () => {
    await upsertStaffActors(client, records, { execute: true });
    const renamed = records.map((r) => (r.id === 'u-assist' ? { ...r, lastName: 'Renamed' } : r));
    const report = await upsertStaffActors(client, renamed, { execute: true });
    expect(report.users).toEqual({ created: 0, updated: 1, unchanged: 1 });
    expect(await client.user.findUnique({ where: { id: 'u-assist' }, select: { lastName: true } })).toEqual({ lastName: 'Renamed' });
    expect(await client.user.count()).toBe(3);
  });

  test('dry run writes nothing', async () => {
    const report = await upsertStaffActors(client, records, { execute: false });
    expect(report.mode).toBe('DRY_RUN');
    expect(report.users.created).toBe(2);
    expect(await client.user.count()).toBe(1);
    expect(await client.auditEvent.count()).toBe(1);
  });
});
