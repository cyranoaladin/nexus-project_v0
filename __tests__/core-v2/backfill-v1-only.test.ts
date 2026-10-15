import { syntheticSecret } from './helpers/synthetic-secret';
import type { PrismaClient } from '@/core-v2/generated/client';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { resetCoreV2Database } from './helpers/reset-db';
import { bootstrapTestAdmin } from './helpers/bootstrap';
import { upsertStaffActors } from '@/scripts/core-v2/sync-staff-actors';
import { buildTargetPlan } from '@/scripts/core-v2/migration/transform';
import { applyPlan } from '@/scripts/core-v2/migration/apply';
import { parseApprovalFile } from '@/scripts/core-v2/migration/approval';
import { TRANSFORM_VERSION } from '@/scripts/core-v2/migration/types';
import type { SourceSnapshot, SourceUser } from '@/scripts/core-v2/migration/source';

const at = new Date('2026-10-12T12:00:00Z');
const approval = parseApprovalFile({ schoolYear: '2026-2027', academicYear: {
  startYear: 2026, startsAt: '2026-09-01', endsAt: '2027-07-15' }, approvedStudentIds: ['roster-student'],
  approvedBy: 'isolated-owner', approvedAt: at.toISOString() });
const sourceUser = (id: string, role: SourceUser['role']): SourceUser => ({ id, role,
  email: `${id}@example.test`, password: null, firstName: 'Synthetic', lastName: 'Fixture', phone: null,
  activatedAt: at, sessionVersion: 9, mergedIntoUserId: null });
const source: SourceSnapshot = { fingerprint: 'isolated-source', approvedIdsNotFound: [], assignments: [], planningSeries: [],
  students: [{ id: 'roster-student', user: sourceUser('roster-eleve', 'ELEVE'), parentUser: sourceUser('roster-parent', 'PARENT'),
    parentProfileId: 'roster-parent-profile', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', stmgPathway: null,
    schoolingStatus: 'SCHOOL_ENROLLED', school: null, birthDate: null, courseEnrollments: [] }] };
const assistant = { id: 'staff-outside-roster', email: null, role: 'ASSISTANTE' as const,
  firstName: null, lastName: null, phone: null, accountStatus: 'ACTIVE' as const, coachProfileId: null };
const options = { execute: true, actorUserId: 'authoritative-test-admin', migratedAt: at,
  approvalDigest: 'b'.repeat(64), sourceFingerprint: source.fingerprint, transformVersion: TRANSFORM_VERSION,
  correlationId: 'isolated-backfill-0001' };

describe('V1_ONLY backfill following exclusive bootstrap and staff sync', () => {
  let client: PrismaClient;
  let prior: string | undefined;
  beforeAll(async () => { client = await requireCoreV2Client(); });
  beforeEach(async () => { prior = process.env.CORE_V2_AUTH_MODE; process.env.CORE_V2_AUTH_MODE = 'V1_ONLY'; await resetCoreV2Database(client); });
  afterEach(() => { if (prior === undefined) delete process.env.CORE_V2_AUTH_MODE; else process.env.CORE_V2_AUTH_MODE = prior; });
  afterAll(async () => { await disconnectCoreV2Client(); });
  const plan = () => buildTargetPlan(source, approval, at);

  test('an approved authoritative parent relationship is attested on first backfill and never reactivated on rerun', async () => {
    await bootstrapTestAdmin(client);
    await applyPlan(client, plan(), options);
    const membership = await client.householdParent.findUniqueOrThrow({ where: { userId: 'roster-parent' } });
    expect(membership).toMatchObject({ verificationStatus: 'VERIFIED', verifiedById: options.actorUserId,
      verifiedAt: at, verificationEvidenceDigest: options.approvalDigest, revokedAt: null, revision: 1 });
    await client.householdParent.update({ where: { id: membership.id }, data: {
      verificationStatus: 'REVOKED', revokedAt: at, isPrimaryContact: false, revision: { increment: 1 } } });
    const revoked = await client.householdParent.findUniqueOrThrow({ where: { id: membership.id } });
    await applyPlan(client, plan(), options);
    expect(await client.householdParent.findUniqueOrThrow({ where: { id: membership.id } })).toEqual(revoked);
  });

  test('a preexisting Core credential refuses before roster mutations', async () => {
    await bootstrapTestAdmin(client);
    await applyPlan(client, plan(), options);
    await client.user.update({ where: { id: 'roster-eleve' }, data: { password: syntheticSecret() } });
    const before = await client.auditEvent.findMany({ orderBy: { id: 'asc' } });
    await expect(applyPlan(client, plan(), options)).rejects.toThrow('MIGRATION_CORE_CREDENTIAL_PRESENT');
    expect(await client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });

  test('bootstrap then attested staff sync then backfill succeeds, and rerun does not mutate', async () => {
    await bootstrapTestAdmin(client);
    await upsertStaffActors(client, [assistant], { execute: true });
    const report = await applyPlan(client, plan(), options);
    expect(report.anomalies).toEqual([]);
    expect(await client.user.count()).toBe(4);
    expect(await client.user.count({ where: { password: { not: null } } })).toBe(0);
    expect(await client.invitation.count()).toBe(0);
    expect(await client.student.count()).toBe(1);
    const users = await client.user.findMany({ orderBy: { id: 'asc' } });
    const audit = await client.auditEvent.findMany({ orderBy: { id: 'asc' } });
    const enrollments = await client.studentAcademicYearEnrollment.findMany();
    const second = await applyPlan(client, plan(), options);
    expect(second.objects.every(o => o.result === 'UNCHANGED')).toBe(true);
    expect(await client.user.findMany({ orderBy: { id: 'asc' } })).toEqual(users);
    expect(await client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(audit);
    expect(await client.studentAcademicYearEnrollment.findMany()).toEqual(enrollments);
  });

  test('foreign staff without a sync attestation refuses before any roster write', async () => {
    await bootstrapTestAdmin(client);
    await client.user.create({ data: { id: assistant.id, role: 'ASSISTANTE', accountStatus: 'ACTIVE' } });
    await expect(applyPlan(client, plan(), options)).rejects.toThrow('TARGET_HAS_FOREIGN_ROWS');
    expect(await client.student.count()).toBe(0);
    expect(await client.academicYear.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(1);
  });

  test('a manually created ADMIN is never accepted as the migration authority', async () => {
    await client.user.create({ data: { id: options.actorUserId, role: 'ADMIN', accountStatus: 'ACTIVE' } });
    await expect(applyPlan(client, plan(), options)).rejects.toThrow('UNATTESTED_ADMIN_STATE');
    expect(await client.student.count()).toBe(0);
    expect(await client.academicYear.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
  });

  test.each(['credential', 'ADMIN', 'ASSISTANTE'])('a tampered %s plan refuses before any mutation', async kind => {
    await bootstrapTestAdmin(client);
    const target = plan();
    const users = target.users.map((u, i) => i ? u : { ...u,
      ...(kind === 'credential' ? { password: syntheticSecret() } : { role: kind }) });
    await expect(applyPlan(client, { ...target, users } as ReturnType<typeof plan>, options))
      .rejects.toThrow('MIGRATION_V1_ONLY_PLAN_FORBIDDEN');
    expect(await client.user.count()).toBe(1);
    expect(await client.academicYear.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(1);
  });
});
