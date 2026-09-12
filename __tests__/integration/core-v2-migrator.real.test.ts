/**
 * Migrator rehearsal against TWO real databases (go-live §AP / §AR):
 *   source = a disposable Core v1 database seeded with a synthetic family,
 *   target = a disposable, empty Core v2 database.
 *
 *   1. empty Core v2 target, dry run: nothing written, everything PLANNED;
 *   2. execute: rows exist with the same ids, ACTIVE enrollment, rebuilt
 *      assignment, materialized planning; reconciliation all zeros;
 *   3. idempotent rerun: everything UNCHANGED;
 *   4. source changes → rerun → exactly that object UPDATED;
 *   5. the source transaction is READ ONLY at the database;
 *   6. a target holding foreign rows is refused.
 */
jest.unmock('@/lib/prisma');

import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { prisma as v1 } from '@/lib/prisma';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import { INVITATION_TTL_ENV, ORGANIZATION_TIMEZONE_ENV, PASSWORD_RESET_TTL_ENV } from '@/lib/core-v2/config';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { resetCoreV2Database } from '@/__tests__/core-v2/helpers/reset-db';
import { approvalDigest, parseApprovalFile } from '@/scripts/core-v2/migration/approval';
import { applyPlan } from '@/scripts/core-v2/migration/apply';
import { readSourceSnapshot } from '@/scripts/core-v2/migration/source';
import { buildTargetPlan } from '@/scripts/core-v2/migration/transform';
import { TRANSFORM_VERSION } from '@/scripts/core-v2/migration/types';

process.env[ORGANIZATION_TIMEZONE_ENV] ??= 'Africa/Tunis';
process.env[INVITATION_TTL_ENV] ??= '72';
process.env[PASSWORD_RESET_TTL_ENV] ??= '60';

const prefix = `mig-${randomUUID().slice(0, 8)}`;
let v2: Awaited<ReturnType<typeof requireCoreV2Client>>;
const ids = { admin: '', parent: '', parentProfile: '', studentA: '', studentB: '', coachUser: '', coachProfile: '', assignment: '', series: '' };
const migratedAt = new Date('2026-09-12T08:00:00Z');

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  if (!process.env.CORE_V2_DATABASE_URL) throw new Error('CORE_V2_DATABASE_URL is required for the migrator rehearsal');
  execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=core-v2/prisma/schema.prisma'], { stdio: 'inherit', env: process.env });
  v2 = await requireCoreV2Client();
  await resetCoreV2Database(v2);

  // Synthetic Core v1 family: an ADMIN (the migrating actor), one parent with two students, one coach.
  const pw = await bcrypt.hash('change_me_migration_fixture', 4);
  const admin = await v1.user.create({ data: { email: `${prefix}-admin@synthetic.test`, role: 'ADMIN', password: pw, activatedAt: new Date(), firstName: 'Admin', lastName: prefix } });
  const parentUser = await v1.user.create({ data: { email: `${prefix}-Parent@synthetic.test`, role: 'PARENT', password: pw, activatedAt: new Date(), firstName: 'Amel', lastName: prefix, phone: '+21620000001', sessionVersion: 4 } });
  const parentProfile = await v1.parentProfile.create({ data: { userId: parentUser.id } });
  const studentAUser = await v1.user.create({ data: { email: `${prefix}-yasmine@synthetic.test`, role: 'ELEVE', password: pw, activatedAt: new Date(), firstName: 'Yasmine', lastName: prefix } });
  const studentA = await v1.student.create({ data: { userId: studentAUser.id, parentId: parentProfile.id, gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', school: 'Lycée synthétique' } });
  const studentBUser = await v1.user.create({ data: { email: `${prefix}-ziad@synthetic.test`, role: 'ELEVE', firstName: 'Ziad', lastName: prefix } }); // never activated, no password
  const studentB = await v1.student.create({ data: { userId: studentBUser.id, parentId: parentProfile.id, gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE' } });
  await v1.studentAcademicEnrollment.createMany({
    data: [
      { studentId: studentA.id, courseKey: 'maths-premiere', kind: 'SPECIALTY', source: 'ASSISTANTE' },
      { studentId: studentA.id, courseKey: 'nsi-premiere', kind: 'SPECIALTY', source: 'BACKFILL_LEGACY_SPECIALTIES' },
      { studentId: studentB.id, courseKey: 'maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
  });
  const coachUser = await v1.user.create({ data: { email: `${prefix}-coach@synthetic.test`, role: 'COACH', password: pw, activatedAt: new Date(), firstName: 'Coach', lastName: prefix } });
  const coachProfile = await v1.coachProfile.create({ data: { userId: coachUser.id, pseudonym: `Coach-${prefix}`, subjects: ['MATHEMATIQUES'] } });
  const assignment = await v1.coachStudentAssignment.create({
    data: { coachId: coachProfile.id, studentId: studentA.id, status: 'ACTIVE', courseScopeState: 'STAFF_VERIFIED', academicCourseKeys: ['maths-premiere'], subjects: ['MATHEMATIQUES'], assignedById: admin.id },
  });
  await v1.coachStudentAssignment.create({
    data: { coachId: coachProfile.id, studentId: studentB.id, status: 'ACTIVE', courseScopeState: 'BACKFILL_AMBIGUOUS', academicCourseKeys: ['maths-terminale'], subjects: ['MATHEMATIQUES'], assignedById: admin.id },
  });
  const series = await v1.planningSeries.create({
    data: {
      studentProfileId: studentA.id, coachProfileId: coachProfile.id, assignmentId: assignment.id, academicCourseKey: 'maths-premiere',
      timezone: 'Africa/Tunis', startDate: new Date('2026-09-01T00:00:00Z'), localStartTime: '18:00', localEndTime: '19:00', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      modality: 'ONLINE', createdById: admin.id,
    },
  });
  Object.assign(ids, { admin: admin.id, parent: parentUser.id, parentProfile: parentProfile.id, studentA: studentA.id, studentB: studentB.id, coachUser: coachUser.id, coachProfile: coachProfile.id, assignment: assignment.id, series: series.id });
});

afterAll(async () => {
  await v1.user.deleteMany({ where: { lastName: prefix } }).catch(() => undefined);
  await v1.$disconnect();
  await disconnectCoreV2Client();
});

function approval() {
  return parseApprovalFile({
    schoolYear: '2026-2027',
    academicYear: { startYear: 2026, startsAt: '2026-09-01', endsAt: '2027-07-15' },
    // The ADMIN actor is not a student; they enter the plan through… nothing. So the plan must carry the actor explicitly:
    approvedStudentIds: [ids.studentA, ids.studentB],
    approvedBy: 'owner-synthetic',
    approvedAt: '2026-09-12T00:00:00.000Z',
  });
}

async function run(execute: boolean) {
  const snapshot = await readSourceSnapshot(v1, approval());
  const plan = buildTargetPlan(snapshot, approval(), migratedAt);
  // The migrating actor must exist in the target: the plan carries roster users only, so the
  // rehearsal mirrors the ADMIN first exactly as the e2e staff seed does (same id).
  const admin = await v1.user.findUniqueOrThrow({ where: { id: ids.admin } });
  await v2.user.upsert({
    where: { id: admin.id },
    create: { id: admin.id, email: admin.email!.toLowerCase(), role: 'ADMIN', password: admin.password, accountStatus: 'ACTIVE', activatedAt: admin.activatedAt, firstName: admin.firstName, lastName: admin.lastName },
    update: {},
  });
  const planWithActor = { ...plan, users: [...plan.users, { id: admin.id, email: admin.email!.toLowerCase(), password: admin.password, role: 'ADMIN' as const, firstName: admin.firstName, lastName: admin.lastName, phone: admin.phone, accountStatus: 'ACTIVE' as const, activatedAt: admin.activatedAt, sessionVersion: admin.sessionVersion }] };
  const manifest = await applyPlan(v2, planWithActor, {
    execute,
    actorUserId: ids.admin,
    migratedAt,
    approvalDigest: approvalDigest(approval()),
    sourceFingerprint: snapshot.fingerprint,
    transformVersion: TRANSFORM_VERSION,
    correlationId: `migration-test:${prefix}`,
  });
  return { snapshot, plan, manifest };
}

const results = (m: Awaited<ReturnType<typeof run>>['manifest'], entity?: string) =>
  m.objects.filter((o) => !entity || o.entity === entity).map((o) => o.result);

test('1. dry run on an empty target writes nothing and reports every roster object as PLANNED, the rest SKIPPED/REJECTED with reasons', async () => {
  const { manifest } = await run(false);
  expect(manifest.mode).toBe('DRY_RUN');
  expect(await v2.student.count()).toBe(0);
  expect(await v2.planningSeries.count()).toBe(0);
  expect(results(manifest, 'Student')).toEqual(['PLANNED', 'PLANNED']);
  expect(results(manifest, 'PlanningSeries')).toEqual(['PLANNED']);
  expect(manifest.objects.filter((o) => o.result === 'SKIPPED').map((o) => o.reason).sort()).toEqual(['SCOPE_BACKFILL_AMBIGUOUS_NEEDS_REVIEW', 'SOURCE_BACKFILL_LEGACY_SPECIALTIES_NEEDS_REVIEW']);
  expect(manifest.reconciliation).toEqual({ UNKNOWN: 0, SILENT_DROPPED: 0, DUPLICATE_TARGET: 0, UNMAPPED_APPROVED: 0 });
  expect(manifest.anomalies).toEqual([]);
  expect(manifest.sourceFingerprint).toMatch(/^v1:.*students=2;assignments=2;series=1$/);
});

test('2. execute: same ids in Core v2, ACTIVE enrollments, rebuilt assignment, materialized future occurrences, audit row; reconciliation clean', async () => {
  const { manifest } = await run(true);
  expect(manifest.mode).toBe('EXECUTE');
  expect(manifest.anomalies).toEqual([]);
  expect(manifest.reconciliation).toEqual({ UNKNOWN: 0, SILENT_DROPPED: 0, DUPLICATE_TARGET: 0, UNMAPPED_APPROVED: 0 });
  expect(results(manifest).filter((r) => r === 'CREATED').length).toBeGreaterThanOrEqual(10);

  const parent = await v2.user.findUniqueOrThrow({ where: { id: ids.parent } });
  expect(parent).toMatchObject({ email: `${prefix}-parent@synthetic.test`, accountStatus: 'ACTIVE', sessionVersion: 4, role: 'PARENT' });
  expect(parent.password).toBeTruthy();
  const ziad = await v2.student.findUniqueOrThrow({ where: { id: ids.studentB }, include: { user: true, household: { include: { parents: true } } } });
  expect(ziad.user).toMatchObject({ accountStatus: 'PENDING_ACTIVATION', password: null });
  expect(ziad.household.parents.map((p) => p.userId)).toEqual([ids.parent]);
  const yasmine = await v2.student.findUniqueOrThrow({ where: { id: ids.studentA }, include: { academicYearEnrollments: { include: { courseEnrollments: true, assignments: { include: { planningSeries: { include: { bookings: true } } } } } } } });
  const enrollment = yasmine.academicYearEnrollments[0]!;
  expect(enrollment).toMatchObject({ status: 'ACTIVE', gradeLevel: 'PREMIERE', school: 'Lycée synthétique', approvedById: ids.admin });
  expect(enrollment.approvedAt?.toISOString()).toBe(migratedAt.toISOString());
  expect(enrollment.courseEnrollments.map((c) => c.courseKey)).toEqual(['maths-premiere']);
  expect(enrollment.assignments).toHaveLength(1);
  expect(enrollment.assignments[0]).toMatchObject({ coachId: ids.coachProfile, courseKey: 'maths-premiere', status: 'ACTIVE' });
  const series = enrollment.assignments[0]!.planningSeries[0]!;
  expect(series.id).toBe(ids.series);
  // Past occurrences stay in Core v1 history: the first materialized Tuesday is on/after the migration instant.
  const first = series.bookings.map((b) => b.startsAt.getTime()).sort()[0]!;
  expect(first).toBeGreaterThanOrEqual(Date.UTC(2026, 8, 15, 17, 0, 0)); // Tue 15 Sept 18:00 Africa/Tunis
  expect(series.bookings.length).toBeGreaterThan(40); // weekly to mid-July 2027
  expect(await v2.coachCourseCapability.count({ where: { coachId: ids.coachProfile } })).toBe(1);
  const audit = await v2.auditEvent.findFirst({ where: { action: 'migration.run_completed' } });
  expect(audit?.metadata).toMatchObject({ anomalies: [], approvalDigest: manifest.approvalDigest });
  expect(JSON.stringify(manifest)).not.toMatch(/\$2[aby]\$/); // no bcrypt hash ever reaches the manifest
});

test('3. idempotent rerun: every object UNCHANGED, no new rows', async () => {
  const before = { users: await v2.user.count(), bookings: await v2.sessionBooking.count(), audit: await v2.auditEvent.count() };
  const { manifest } = await run(true);
  const written = manifest.objects.filter((o) => o.result === 'CREATED' || o.result === 'UPDATED');
  expect(written).toEqual([]);
  expect(results(manifest, 'Student')).toEqual(['UNCHANGED', 'UNCHANGED']);
  expect(results(manifest, 'PlanningSeries')).toEqual(['UNCHANGED']);
  expect(await v2.user.count()).toBe(before.users);
  expect(await v2.sessionBooking.count()).toBe(before.bookings);
  expect(await v2.auditEvent.count()).toBe(before.audit + 1); // the run itself is audited
});

test('4. a source change is carried as exactly one UPDATED object', async () => {
  await v1.student.update({ where: { id: ids.studentA }, data: { school: 'Autre lycée' } });
  const { manifest } = await run(true);
  const changed = manifest.objects.filter((o) => o.result === 'UPDATED');
  expect(changed.map((o) => [o.entity, o.targetId])).toEqual([['StudentAcademicYearEnrollment', `aye-${ids.studentA}-2026`]]);
  expect((await v2.studentAcademicYearEnrollment.findUniqueOrThrow({ where: { id: `aye-${ids.studentA}-2026` } })).school).toBe('Autre lycée');
});

test('5. the source snapshot runs in a READ ONLY transaction — a write inside it is refused by PostgreSQL', async () => {
  await expect(
    v1.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.user.update({ where: { id: ids.parent }, data: { firstName: 'Hacked' } });
    }),
  ).rejects.toThrow(/read-only transaction/);
  expect((await v1.user.findUniqueOrThrow({ where: { id: ids.parent } })).firstName).toBe('Amel');
});

test('6. a target that holds rows outside the plan is refused before any write', async () => {
  await v2.user.create({ data: { id: `${prefix}-foreign`, role: 'PARENT', email: `${prefix}-foreign@synthetic.test`, accountStatus: 'ACTIVE' } });
  await expect(run(true)).rejects.toThrow(/TARGET_HAS_FOREIGN_ROWS/);
  await v2.user.delete({ where: { id: `${prefix}-foreign` } });
});
