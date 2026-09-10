/**
 * Negative golden tests (foundation §16) — proves the DB/repository layer
 * actually REFUSES the invariant violations it claims to enforce. Each test
 * is a real RED→GREEN proof: the setup alone would be silently accepted by
 * a naive schema; the assertion proves it is not accepted by this one.
 *
 * missing-CORE_V2_DATABASE_URL and accidental-Core-v1-target are covered in
 * client-guards.test.ts (no DB connection needed for those two).
 */
import { execFileSync } from 'node:child_process';
import { disconnectCoreV2Client, getCoreV2Client } from '@/lib/core-v2/client';
import {
  CoachLacksCapabilityError,
  DuplicateActiveAssignmentError,
  StudentNotEnrolledInCourseError,
  createAcademicYear,
  createAnnualEnrollment,
  createAssignment,
  createCoachProfile,
  createCourseEnrollment,
  createHouseholdWithParent,
  createStudent,
  createUser,
  grantCapability,
} from '@/lib/core-v2/repositories';
import { resetCoreV2Database } from './helpers/reset-db';

const client = getCoreV2Client();

beforeAll(() => {
  execFileSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema=core-v2/prisma/schema.prisma'],
    { stdio: 'inherit', env: process.env },
  );
});

beforeEach(async () => {
  await resetCoreV2Database(client);
});

afterAll(async () => {
  await disconnectCoreV2Client();
});

/** Builds one household + student + enrollment + coach, ready for an assignment. */
async function buildBaseFixture() {
  const academicYear = await createAcademicYear(client, { startYear: 2026 });
  const parentUser = await createUser(client, { role: 'PARENT' });
  const { household } = await createHouseholdWithParent(client, { parentUserId: parentUser.id });
  const studentUser = await createUser(client, { role: 'ELEVE' });
  const student = await createStudent(client, { householdId: household.id, userId: studentUser.id });
  const enrollment = await createAnnualEnrollment(client, {
    studentId: student.id,
    academicYearId: academicYear.id,
    gradeLevel: 'SECONDE',
  });
  const coachUser = await createUser(client, { role: 'COACH' });
  const coach = await createCoachProfile(client, { userId: coachUser.id });
  return { academicYear, household, student, enrollment, coach };
}

describe('Negative golden tests — the DB/repository layer refuses invariant violations', () => {
  test('double annual enrollment for the same student + year is rejected', async () => {
    const { student, academicYear } = await buildBaseFixture();
    await expect(
      createAnnualEnrollment(client, {
        studentId: student.id,
        academicYearId: academicYear.id,
        gradeLevel: 'SECONDE',
      }),
    ).rejects.toThrow();
  });

  test('duplicate coach capability for the same courseKey is rejected', async () => {
    const { coach } = await buildBaseFixture();
    await grantCapability(client, { coachId: coach.id, courseKey: 'maths-seconde' });
    await expect(grantCapability(client, { coachId: coach.id, courseKey: 'maths-seconde' })).rejects.toThrow();
  });

  test('assignment to a course the coach has no capability for is refused', async () => {
    const { enrollment, coach } = await buildBaseFixture();
    await createCourseEnrollment(client, {
      academicYearEnrollmentId: enrollment.id,
      courseKey: 'maths-seconde',
      kind: 'SPECIALTY',
    });
    // Deliberately no grantCapability call.
    await expect(
      createAssignment(client, { coachId: coach.id, academicYearEnrollmentId: enrollment.id, courseKey: 'maths-seconde' }),
    ).rejects.toThrow(CoachLacksCapabilityError);
  });

  test('assignment to a course the student has no explicit enrollment for is refused', async () => {
    const { enrollment, coach } = await buildBaseFixture();
    await grantCapability(client, { coachId: coach.id, courseKey: 'maths-seconde' });
    // Deliberately no createCourseEnrollment call.
    await expect(
      createAssignment(client, { coachId: coach.id, academicYearEnrollmentId: enrollment.id, courseKey: 'maths-seconde' }),
    ).rejects.toThrow(StudentNotEnrolledInCourseError);
  });

  test('a second simultaneously-ACTIVE assignment for the same (coach, enrollment, courseKey) triple is refused', async () => {
    const { enrollment, coach } = await buildBaseFixture();
    await grantCapability(client, { coachId: coach.id, courseKey: 'maths-seconde' });
    await createCourseEnrollment(client, {
      academicYearEnrollmentId: enrollment.id,
      courseKey: 'maths-seconde',
      kind: 'SPECIALTY',
    });
    await createAssignment(client, { coachId: coach.id, academicYearEnrollmentId: enrollment.id, courseKey: 'maths-seconde' });
    await expect(
      createAssignment(client, { coachId: coach.id, academicYearEnrollmentId: enrollment.id, courseKey: 'maths-seconde' }),
    ).rejects.toThrow(DuplicateActiveAssignmentError);
  });

  test('an AcademicYear with endsAt not after startsAt is refused by the SQL CHECK constraint', async () => {
    await expect(
      client.academicYear.create({
        data: {
          startYear: 2099,
          startsAt: new Date('2099-09-01'),
          endsAt: new Date('2099-08-31'), // before startsAt
        },
      }),
    ).rejects.toThrow();
  });

  test('an illegitimate parent/household relation (non-existent household) is refused by the FK', async () => {
    const parentUser = await createUser(client, { role: 'PARENT' });
    await expect(
      client.householdParent.create({
        data: { householdId: 'does-not-exist', userId: parentUser.id },
      }),
    ).rejects.toThrow();
  });
});
