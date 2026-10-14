/** Disposable fixtures use real V1 credentials and the exclusive attested ADMIN bootstrap. */
import { prisma as coreV1 } from '@/lib/prisma';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import { normalizeEmail } from '@/lib/core-v2/contact';
import { readRuntimeCredentialsManifest } from '@/lib/security/seed-runtime';
import { verifyBootstrap, lockV1AdminBootstrap, assertBootstrapAttested } from '@/lib/core-v2/accounts/bootstrap-v1-admin';
import { acquireV1InvitationIdentity, type V1IdentityLease } from '@/lib/auth/v1-invitation-authority';
import { inTransaction } from '@/lib/core-v2/services/context';
import type { Tx } from '@/lib/core-v2/services/context';
import { collectV1StaffActors, upsertStaffActors } from './sync-staff-actors';
import { assertCoreV2E2eSeedTarget, assertCoreV1E2eSeedTarget, type CoreV2E2eSeedEnvironment } from './e2e-seed-target';
import { CORE_V2_ARIA_FOUNDATION_EMAIL, resetCoreV2AriaFoundationProfile } from './aria-foundation-e2e-persona';

type FixtureIdentity = { id: string; email: string | null; role: string; activatedAt: Date | null;
  disabledAt: Date | null; mergedIntoUserId: string | null; student: { id: string } | null };
function assertFoundationIdentity(identity: FixtureIdentity | null): asserts identity is FixtureIdentity {
  if (!identity || identity.email !== CORE_V2_ARIA_FOUNDATION_EMAIL || identity.role !== 'ELEVE'
    || !identity.activatedAt || identity.disabledAt || identity.mergedIntoUserId || identity.student) {
    throw new Error('CORE_V2_ARIA_E2E_IDENTITY_INVALID');
  }
}
async function assertExistingFoundation(coreV2: Pick<Tx, 'user'>, v1Identity: FixtureIdentity) {
  const selection = { id: true, email: true, role: true, password: true, accountStatus: true } as const;
  const existing = await coreV2.user.findUnique({ where: { email: CORE_V2_ARIA_FOUNDATION_EMAIL }, select: selection });
  const byId = await coreV2.user.findUnique({ where: { id: v1Identity.id }, select: selection });
  if (byId && (byId.id !== existing?.id || byId.email !== CORE_V2_ARIA_FOUNDATION_EMAIL)) {
    throw new Error('CORE_V2_ARIA_E2E_IDENTITY_INVALID');
  }
  if (existing && (existing.id !== v1Identity.id || existing.email !== v1Identity.email || existing.role !== 'ELEVE'
    || existing.password !== null || existing.accountStatus !== 'ACTIVE')) {
    throw new Error('CORE_V2_ARIA_E2E_IDENTITY_INVALID');
  }
  return existing;
}
async function seedCoreV2AriaFoundationPersona(coreV2: Tx, v1Identity: FixtureIdentity) {
  const existing = await assertExistingFoundation(coreV2, v1Identity);
  if (!existing) await coreV2.user.create({ data: { id: v1Identity.id, email: v1Identity.email, password: null,
    role: 'ELEVE', firstName: 'Lina', lastName: 'Fondation', accountStatus: 'ACTIVE' } });
  const household = await coreV2.household.upsert({
    where: { id: 'e2e-core-v2-aria-household' },
    create: { id: 'e2e-core-v2-aria-household' },
    update: {},
  });
  const student = await coreV2.student.upsert({
    where: { userId: v1Identity.id },
    create: {
      id: 'e2e-core-v2-aria-student',
      userId: v1Identity.id,
      householdId: household.id,
    },
    update: { householdId: household.id },
  });
  const academicYear = await coreV2.academicYear.upsert({
    where: { startYear: 2026 },
    create: {
      id: 'e2e-academic-year-2026',
      startYear: 2026,
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2027-08-31T23:59:59.999Z'),
      status: 'CURRENT',
    },
    update: { status: 'CURRENT' },
  });
  const enrollment = await coreV2.studentAcademicYearEnrollment.upsert({
    where: {
      studentId_academicYearId: { studentId: student.id, academicYearId: academicYear.id },
    },
    create: {
      studentId: student.id,
      academicYearId: academicYear.id,
      status: 'ACTIVE',
      schoolingStatus: 'SCHOOL_ENROLLED',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      school: 'Lycée Pierre-Mendès-France',
      approvedAt: new Date(),
    },
    update: {
      status: 'ACTIVE',
      schoolingStatus: 'SCHOOL_ENROLLED',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      school: 'Lycée Pierre-Mendès-France',
    },
  });

  for (const course of [
    { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' as const },
    { courseKey: 'opt-maths-expertes-terminale', kind: 'OPTION' as const },
  ]) {
    await coreV2.studentCourseEnrollment.upsert({
      where: {
        academicYearEnrollmentId_courseKey: {
          academicYearEnrollmentId: enrollment.id,
          courseKey: course.courseKey,
        },
      },
      create: {
        academicYearEnrollmentId: enrollment.id,
        courseKey: course.courseKey,
        kind: course.kind,
      },
      update: { kind: course.kind },
    });
  }

  await coreV2.ariaAccessGrant.upsert({
    where: { id: 'e2e-core-v2-aria-scoped-grant' },
    create: {
      id: 'e2e-core-v2-aria-scoped-grant',
      studentId: student.id,
      featureKey: 'aria_maths',
      ariaTier: 'ARIA_ACCOMPAGNEE',
      courseScopes: ['maths-terminale-eds'],
      status: 'ACTIVE',
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      source: 'E2E Core v2 ARIA foundation',
    },
    update: {
      studentId: student.id,
      featureKey: 'aria_maths',
      ariaTier: 'ARIA_ACCOMPAGNEE',
      courseScopes: ['maths-terminale-eds'],
      status: 'ACTIVE',
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: null,
    },
  });
}

/** No bootstrap, promotion, password write or session copying is available through this seed. */
export async function seedCoreV2E2eActors(env: CoreV2E2eSeedEnvironment = process.env): Promise<void> {
  assertCoreV2E2eSeedTarget(env);
  assertCoreV1E2eSeedTarget(env);
  if (env.CORE_V2_AUTH_MODE !== 'V1_ONLY') throw new Error('E2E_SEED_REQUIRES_V1_ONLY');
  const credentials = readRuntimeCredentialsManifest(env.E2E_CREDENTIALS_PATH ?? 'e2e/.credentials.json') as Record<string, { email?: unknown }>;
  if (typeof credentials.admin?.email !== 'string' || credentials.coachV1?.email !== 'coach-v1@e2e.nexus.test'
    || credentials.coreV2AriaFoundation?.email !== CORE_V2_ARIA_FOUNDATION_EMAIL) throw new Error('E2E_SEED_IDENTITIES_INVALID');
  const coreV2 = await requireCoreV2Client();
  const admin = await coreV1.user.findUnique({ where: { email: credentials.admin.email },
    select: { id: true, role: true, activatedAt: true, disabledAt: true, mergedIntoUserId: true } });
  if (!admin || admin.role !== 'ADMIN' || !admin.activatedAt || admin.disabledAt || admin.mergedIntoUserId) {
    throw new Error('E2E_SEED_ADMIN_IDENTITY_INVALID');
  }
  // This gate fails before any seed mutation. Only the real offline bootstrap can satisfy it.
  await verifyBootstrap(coreV2, admin.id);
  const legacyCoach = await coreV1.user.findUnique({ where: { email: credentials.coachV1.email },
    select: { id: true, role: true, activatedAt: true, disabledAt: true, mergedIntoUserId: true } });
  if (!legacyCoach || legacyCoach.role !== 'COACH' || !legacyCoach.activatedAt || legacyCoach.disabledAt || legacyCoach.mergedIntoUserId) {
    throw new Error('E2E_LEGACY_COACH_IDENTITY_INVALID');
  }
  if (await coreV2.user.findUnique({ where: { email: credentials.coachV1.email }, select: { id: true } })
    || await coreV2.user.findUnique({ where: { id: legacyCoach.id }, select: { id: true } })) {
    throw new Error('E2E_LEGACY_COACH_MUST_NOT_EXIST_IN_CORE');
  }
  const foundation = await coreV1.user.findUnique({ where: { email: CORE_V2_ARIA_FOUNDATION_EMAIL },
    select: { id: true, email: true, role: true, activatedAt: true, disabledAt: true, mergedIntoUserId: true, student: { select: { id: true } } } });
  assertFoundationIdentity(foundation);
  await assertExistingFoundation(coreV2, foundation);
  const records = (await collectV1StaffActors(coreV1)).filter(record => record.id !== legacyCoach.id);
  const dryRun = await upsertStaffActors(coreV2, records, { execute: false });
  if (dryRun.adminCreates !== 0 || dryRun.adminPromotions !== 0) throw new Error('E2E_SEED_ADMIN_WRITE_FORBIDDEN');
  await upsertStaffActors(coreV2, records, { execute: true });
  const secondPass = await upsertStaffActors(coreV2, records, { execute: true });
  if (secondPass.adminCreates !== 0 || secondPass.adminPromotions !== 0 || secondPass.users.created !== 0
    || secondPass.users.updated !== 0 || secondPass.coachProfiles.created !== 0) throw new Error('E2E_SEED_SYNC_NOT_IDEMPOTENT');
  let lease: V1IdentityLease | undefined;
  try {
    await inTransaction(coreV2, async tx => {
      await lockV1AdminBootstrap(tx);
      if (await assertBootstrapAttested(tx) !== admin.id) throw new Error('UNATTESTED_ADMIN_STATE');
      lease = await acquireV1InvitationIdentity({ issuerId: admin.id, expectedIssuerRole: 'ADMIN', targetId: foundation.id,
        targetRole: 'ELEVE', recipient: CORE_V2_ARIA_FOUNDATION_EMAIL, requireActiveTargetById: true });
      await seedCoreV2AriaFoundationPersona(tx, foundation);
      await lease.verify();
    });
  } finally { await lease?.release(); }
  await resetCoreV2AriaFoundationProfile(coreV2);
  await verifyBootstrap(coreV2, admin.id);
}

if (require.main === module) {
  seedCoreV2E2eActors().then(() => console.info('E2E_CORE_V1_ONLY_FIXTURES_READY'))
    .catch(() => { console.error('E2E_CORE_SEED_REFUSED'); process.exitCode = 1; })
    .finally(async () => { await disconnectCoreV2Client(); await coreV1.$disconnect(); });
}
