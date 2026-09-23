/**
 * Disposable-stack only: mirrors the seeded Core v1 STAFF and COACH accounts
 * into the Core v2 database with the SAME ids, so the session→actor mapping
 * (lib/core-v2/http/actor.ts) resolves them and the staff API / UI can be
 * exercised end to end. This is the explicit "migrated-actor authority
 * mapping" of §S/§V for the test stack — not the production migrator
 * (scripts/core-v2/extract-to-core-v2.ts stays fail-closed).
 *
 * Refuses to run outside a disposable stack, refuses a Core v2 target that
 * collides with DATABASE_URL (client guard), and never touches PARENT/ELEVE
 * rows, except for the explicitly named Core-v2-only ARIA foundation persona
 * below. That persona has a shared login User but deliberately no V1 Student.
 */
import { prisma as coreV1 } from '@/lib/prisma';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import { normalizeEmail } from '@/lib/core-v2/contact';
import { assertCoreV2E2eSeedTarget } from './e2e-seed-target';
import {
  CORE_V2_ARIA_FOUNDATION_EMAIL,
  resetCoreV2AriaFoundationProfile,
} from './aria-foundation-e2e-persona';

const MIRRORED_ROLES = ['ADMIN', 'ASSISTANTE', 'COACH'] as const;

async function seedCoreV2AriaFoundationPersona(coreV2: Awaited<ReturnType<typeof requireCoreV2Client>>) {
  const legacyIdentity = await coreV1.user.findUnique({
    where: { email: CORE_V2_ARIA_FOUNDATION_EMAIL },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      firstName: true,
      lastName: true,
      sessionVersion: true,
      student: { select: { id: true } },
    },
  });
  if (!legacyIdentity?.email || !legacyIdentity.password || legacyIdentity.role !== 'ELEVE') {
    throw new Error('CORE_V2_ARIA_E2E_IDENTITY_MISSING');
  }
  if (legacyIdentity.student) throw new Error('CORE_V2_ARIA_E2E_LEGACY_STUDENT_FORBIDDEN');

  await coreV2.user.upsert({
    where: { id: legacyIdentity.id },
    create: {
      id: legacyIdentity.id,
      email: normalizeEmail(legacyIdentity.email),
      password: legacyIdentity.password,
      role: 'ELEVE',
      firstName: legacyIdentity.firstName,
      lastName: legacyIdentity.lastName,
      sessionVersion: legacyIdentity.sessionVersion,
      accountStatus: 'ACTIVE',
      activatedAt: new Date(),
    },
    update: {
      email: normalizeEmail(legacyIdentity.email),
      password: legacyIdentity.password,
      firstName: legacyIdentity.firstName,
      lastName: legacyIdentity.lastName,
      // Re-seeding rewrites credentials: revoke any existing Core v2 session.
      sessionVersion: { increment: 1 },
      accountStatus: 'ACTIVE',
    },
  });

  const household = await coreV2.household.upsert({
    where: { id: 'e2e-core-v2-aria-household' },
    create: { id: 'e2e-core-v2-aria-household' },
    update: {},
  });
  const student = await coreV2.student.upsert({
    where: { userId: legacyIdentity.id },
    create: {
      id: 'e2e-core-v2-aria-student',
      userId: legacyIdentity.id,
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
  await resetCoreV2AriaFoundationProfile(coreV2);
}

async function main(): Promise<void> {
  // Must run before `requireCoreV2Client`: no connection or mutation is
  // attempted until the actual parsed target, not only a marker, is proven.
  assertCoreV2E2eSeedTarget(process.env);
  const coreV2 = await requireCoreV2Client();
  const staff = await coreV1.user.findMany({
    where: { role: { in: [...MIRRORED_ROLES] } },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true, password: true, sessionVersion: true },
  });

  let mirrored = 0;
  for (const user of staff) {
    if (!user.email) continue;
    await coreV2.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: normalizeEmail(user.email),
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        password: user.password,
        sessionVersion: user.sessionVersion,
        accountStatus: 'ACTIVE',
        activatedAt: new Date(),
      },
      update: {
        email: normalizeEmail(user.email),
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        password: user.password,
        // Re-seeding rewrites credentials: revoke any Core v2 session like every other credential write.
        sessionVersion: { increment: 1 },
        accountStatus: 'ACTIVE',
      },
    });
    if (user.role === 'COACH') {
      await coreV2.coachProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    }
    mirrored += 1;
  }
  await seedCoreV2AriaFoundationPersona(coreV2);
  console.log(`[seed-e2e-staff-actors] mirrored ${mirrored} staff/coach account(s) into Core v2 (same ids).`);
  console.log('[seed-e2e-staff-actors] seeded the Core-v2-only ARIA foundation persona.');
  await disconnectCoreV2Client();
  await coreV1.$disconnect();
}

main().catch(async (error) => {
  console.error('[seed-e2e-staff-actors] FAILED', error instanceof Error ? error.message : error);
  await disconnectCoreV2Client().catch(() => undefined);
  await coreV1.$disconnect().catch(() => undefined);
  process.exit(1);
});
