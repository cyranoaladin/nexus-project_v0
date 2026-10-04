import { createServiceContext } from '@/lib/core-v2/services/context';
import { verifyHouseholdParent, revokeHouseholdParent } from '@/lib/core-v2/services/household-verification';
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

import { randomInt, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as confirmPasswordReset } from '@/app/api/auth/reset-password/route';
import { generateResetToken, verifyResetToken } from '@/lib/password-reset-token';
import { canApplyV1CredentialProof } from '@/lib/auth/password-reset-authority';
import { normalizeParentPhone } from '@/lib/contact/parent-phone';
import { issueParentPhoneChallenge, verifyParentPhoneChallenge, consumeParentPhoneChallenge } from '@/lib/auth/parent-phone';
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
const proofClock = new Date('2026-09-12T07:55:00Z');
const originalAuthMode = process.env.CORE_V2_AUTH_MODE;
let emailProof: string;
let phoneProof: string;
let phoneChallengeId: string;

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  if (!process.env.CORE_V2_DATABASE_URL) throw new Error('CORE_V2_DATABASE_URL is required for the migrator rehearsal');
  execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=core-v2/prisma/schema.prisma'], { stdio: 'inherit', env: process.env });
  v2 = await requireCoreV2Client();
  await resetCoreV2Database(v2);
  process.env.CORE_V2_AUTH_MODE = 'HYBRID';

  // Synthetic Core v1 family: an ADMIN (the migrating actor), one parent with two students, one coach.
  const pw = await bcrypt.hash('change_me_migration_fixture', 4);
  const admin = await v1.user.create({ data: { email: `${prefix}-admin@synthetic.test`, role: 'ADMIN', password: pw, activatedAt: new Date(), firstName: 'Admin', lastName: prefix } });
  const phone = `+2162${randomInt(0, 10_000_000).toString().padStart(7, '0')}`;
  const parentUser = await v1.user.create({ data: {
    email: `${prefix}-Parent@synthetic.test`, emailVerifiedAt: proofClock,
    role: 'PARENT', password: pw, activatedAt: proofClock, firstName: 'Amel', lastName: prefix,
    phone, phoneNormalized: normalizeParentPhone(phone).normalized, parentPhoneState: 'VERIFIED', phoneVerifiedAt: proofClock, sessionVersion: 4,
  } });
  const clock = jest.spyOn(Date, 'now').mockReturnValue(proofClock.getTime());
  try {
    emailProof = generateResetToken(parentUser.id, parentUser.email!, parentUser.password);
    expect(verifyResetToken(emailProof, parentUser.password)).toMatchObject({ userId: parentUser.id });
    expect(await canApplyV1CredentialProof({ userId: parentUser.id, email: parentUser.email! })).toBe(true);
  } finally {
    clock.mockRestore();
  }
  const issuedPhone = await v1.$transaction(tx => issueParentPhoneChallenge(tx, {
    userId: parentUser.id, purpose: 'RECOVERY', now: proofClock,
  }));
  phoneProof = issuedPhone.rawToken;
  phoneChallengeId = issuedPhone.challengeId;
  expect(await verifyParentPhoneChallenge(phoneProof, { now: proofClock })).toMatchObject({ valid: true });
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
}, 30_000); // `prisma migrate deploy` grows with every migration added (9 as of the candidat-libre diagnostics migration); the 5s Jest default no longer covers deploy + reset + fixture creation.

afterAll(async () => {
  if (originalAuthMode === undefined) delete process.env.CORE_V2_AUTH_MODE;
  else process.env.CORE_V2_AUTH_MODE = originalAuthMode;
  await v1.user.deleteMany({ where: { lastName: prefix } }).catch(() => undefined);
  await v1.$disconnect();
  await disconnectCoreV2Client();
});

function approval() {
  return parseApprovalFile({
    schoolYear: '2026-2027',
    academicYear: { startYear: 2026, startsAt: '2026-09-01', endsAt: '2027-07-15' },
    // L'acteur ADMIN n'est pas un eleve et n'a pas a l'etre : c'est une
    // identite de plan de controle, provisionnee dans Core v2 avant la
    // migration. Le roster ne porte que des eleves.
    approvedStudentIds: [ids.studentA, ids.studentB],
    approvedBy: 'owner-synthetic',
    approvedAt: '2026-09-12T00:00:00.000Z',
  });
}

async function run(execute: boolean) {
  const snapshot = await readSourceSnapshot(v1, approval());
  const plan = buildTargetPlan(snapshot, approval(), migratedAt);
  // L'acteur est provisionne dans Core v2 AVANT la migration, comme le fait
  // le parcours canonique. Le plan n'a plus a le porter : `applyPlan` le
  // verifie dans la cible (present, role ADMIN) et le tolere comme unique
  // utilisateur cible preexistant.
  const admin = await v1.user.findUniqueOrThrow({ where: { id: ids.admin } });
  await v2.user.upsert({
    where: { id: admin.id },
    create: { id: admin.id, email: admin.email!.toLowerCase(), role: 'ADMIN', password: admin.password, accountStatus: 'ACTIVE', activatedAt: admin.activatedAt, firstName: admin.firstName, lastName: admin.lastName },
    update: {},
  });
  const manifest = await applyPlan(v2, plan, {
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

/** Même exécution, avec un acteur imposé : sert les épreuves de refus. */
async function runWithActor(execute: boolean, actorUserId: string) {
  const snapshot = await readSourceSnapshot(v1, approval());
  const plan = buildTargetPlan(snapshot, approval(), migratedAt);
  return applyPlan(v2, plan, {
    execute,
    actorUserId,
    migratedAt,
    approvalDigest: approvalDigest(approval()),
    sourceFingerprint: snapshot.fingerprint,
    transformVersion: TRANSFORM_VERSION,
    correlationId: `migration-test-actor:${prefix}`,
  });
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

  // Un SECOND administrateur ne passe pas davantage : la tolerance porte sur
  // l'acteur DECLARE, pas sur le role.
  await v2.user.create({ data: { id: `${prefix}-admin2`, role: 'ADMIN', email: `${prefix}-admin2@synthetic.test`, accountStatus: 'ACTIVE' } });
  await expect(run(true)).rejects.toThrow(/TARGET_HAS_FOREIGN_ROWS/);
  await v2.user.delete({ where: { id: `${prefix}-admin2` } });

  // Un acteur absent de la cible est refuse avant toute ecriture.
  await expect(runWithActor(true, `${prefix}-nobody`)).rejects.toThrow(/MIGRATION_ACTOR_ABSENT_FROM_TARGET/);
  // Un acteur present mais qui n'est pas ADMIN l'est aussi.
  await expect(runWithActor(true, ids.parent)).rejects.toThrow(/MIGRATION_ACTOR_NOT_ADMIN/);
});


async function credentialState() {
  const select = { password: true, sessionVersion: true };
  return {
    source: await v1.user.findUniqueOrThrow({ where: { id: ids.parent }, select }),
    target: await v2.user.findUniqueOrThrow({ where: { id: ids.parent }, select }),
    challenge: await v1.parentPhoneChallenge.findUniqueOrThrow({
      where: { id: phoneChallengeId }, select: { consumedAt: true, revokedAt: true, expiresAt: true },
    }),
  };
}

async function confirmStaleEmailProof() {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(proofClock.getTime());
  try {
    return await confirmPasswordReset(new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ token: emailProof, newPassword: 'Synthetic-new-credential-42!' }),
    }));
  } finally {
    clock.mockRestore();
  }
}

test('7. a still-valid V1 email proof is refused after the approved real migration without changing either credential store', async () => {
  const before = await credentialState();
  expect((await confirmStaleEmailProof()).status).toBe(400);
  expect(await credentialState()).toEqual(before);
});

test('8. an unexpired V1 phone proof is no longer verifiable after the real identity transfer', async () => {
  const before = await credentialState();
  expect(await verifyParentPhoneChallenge(phoneProof, { now: proofClock })).toEqual({ valid: false });
  expect(await credentialState()).toEqual(before);
});

test('9. consuming an unexpired V1 phone proof after transfer cannot change passwords, rotate sessions or consume the challenge', async () => {
  const before = await credentialState();
  expect(await consumeParentPhoneChallenge(phoneProof, 'Synthetic-new-credential-42!', { now: proofClock })).toEqual({ success: false });
  expect(await credentialState()).toEqual(before);
});

test('10. losing the Core authority configuration fails closed even with a valid old V1 email proof', async () => {
  const before = await credentialState();
  const url = process.env.CORE_V2_DATABASE_URL;
  await disconnectCoreV2Client();
  delete process.env.CORE_V2_DATABASE_URL;
  try {
    expect((await confirmStaleEmailProof()).status).toBe(503);
  } finally {
    process.env.CORE_V2_DATABASE_URL = url;
  }
  expect(await credentialState()).toEqual(before);
});


test('11. rerunning an approved student roster cannot reactivate a revoked family or restore its primary contact', async () => {
  const membership = await v2.householdParent.findUniqueOrThrow({ where: { userId: ids.parent } });
  const ctx = createServiceContext({ userId: ids.admin, role: 'ADMIN' }, { now: () => migratedAt });
  await verifyHouseholdParent(v2, ctx, { householdId: membership.householdId, parentUserId: ids.parent, expectedRevision: 0, evidenceDigest: 'a'.repeat(64) });
  await revokeHouseholdParent(v2, ctx, { householdId: membership.householdId, parentUserId: ids.parent, expectedRevision: 1 });
  const before = await v2.householdParent.findUniqueOrThrow({ where: { id: membership.id } });
  const { manifest } = await run(true);
  expect(results(manifest, 'HouseholdParent')).toEqual(['UNCHANGED']);
  expect(await v2.householdParent.findUniqueOrThrow({ where: { id: membership.id } })).toEqual(before);
  expect(before).toMatchObject({ verificationStatus: 'REVOKED', isPrimaryContact: false, revision: 2 });
});
