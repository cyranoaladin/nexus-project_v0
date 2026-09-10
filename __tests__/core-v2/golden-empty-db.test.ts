/**
 * THE Core v2 reference test (foundation §15). Proves the whole foundation —
 * baseline migration, isolated client, repository layer, invariants — works
 * end to end starting from a completely empty PostgreSQL database. All
 * fixtures are synthetic: no real name, address, or student.
 *
 * Requires CORE_V2_DATABASE_URL to point at a disposable database. Applies
 * the Core v2 baseline migrations itself (via `prisma migrate deploy`) so
 * this test is self-contained — it does not assume any pre-existing schema.
 */
import { execFileSync } from 'node:child_process';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import type { PrismaClient } from '@/core-v2/generated/client';
import {
  createAcademicYear,
  createAnnualEnrollment,
  createAssignment,
  createCoachProfile,
  createCourseEnrollment,
  createHouseholdWithParent,
  createPlanningSeries,
  createSessionBooking,
  createStudent,
  createUser,
  addParentToHousehold,
  getHouseholdWithMembers,
  getRosterForYear,
  grantCapability,
  listCourseEnrollments,
} from '@/lib/core-v2/repositories';
import { resetCoreV2Database } from './helpers/reset-db';

if (!process.env.CORE_V2_DATABASE_URL) {
  throw new Error(
    'CORE_V2_DATABASE_URL must be set to a disposable PostgreSQL database to run this suite.',
  );
}

let client: PrismaClient;

beforeAll(async () => {
  execFileSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema=core-v2/prisma/schema.prisma'],
    { stdio: 'inherit', env: process.env },
  );
  client = await requireCoreV2Client();
});

beforeEach(async () => {
  await resetCoreV2Database(client);
});

afterAll(async () => {
  await disconnectCoreV2Client();
});

describe('Golden Empty DB — full lifecycle from an empty database', () => {
  test('household, 2 parents, 2 students, enrollments, coaches, assignments, planning, booking', async () => {
    // 1-2. AcademicYear 2026-2027 + Household (with its first parent)
    const academicYear = await createAcademicYear(client, { startYear: 2026 });
    const parentUser1 = await createUser(client, { role: 'PARENT', email: 'parent1@synthetic.test' });
    const { household } = await createHouseholdWithParent(client, { parentUserId: parentUser1.id });

    // 3. a second parent, same household
    const parentUser2 = await createUser(client, { role: 'PARENT', email: 'parent2@synthetic.test' });
    await addParentToHousehold(client, household.id, parentUser2.id);

    // 4. 2 students
    const studentUser1 = await createUser(client, { role: 'ELEVE', firstName: 'Synthetic1' });
    const studentUser2 = await createUser(client, { role: 'ELEVE', firstName: 'Synthetic2' });
    const student1 = await createStudent(client, { householdId: household.id, userId: studentUser1.id });
    const student2 = await createStudent(client, { householdId: household.id, userId: studentUser2.id });

    // 5. annual enrollment for each
    const enrollment1 = await createAnnualEnrollment(client, {
      studentId: student1.id,
      academicYearId: academicYear.id,
      gradeLevel: 'SECONDE',
    });
    const enrollment2 = await createAnnualEnrollment(client, {
      studentId: student2.id,
      academicYearId: academicYear.id,
      gradeLevel: 'PREMIERE',
      academicTrack: 'EDS_GENERALE',
    });

    // 6. explicit course enrollments
    await createCourseEnrollment(client, {
      academicYearEnrollmentId: enrollment1.id,
      courseKey: 'maths-seconde',
      kind: 'SPECIALTY',
    });
    await createCourseEnrollment(client, {
      academicYearEnrollmentId: enrollment2.id,
      courseKey: 'maths-premiere-spe',
      kind: 'SPECIALTY',
    });
    await createCourseEnrollment(client, {
      academicYearEnrollmentId: enrollment2.id,
      courseKey: 'anglais-premiere-option',
      kind: 'OPTION',
    });

    // 7. 2 coaches
    const coachUser1 = await createUser(client, { role: 'COACH', firstName: 'CoachSynthetic1' });
    const coachUser2 = await createUser(client, { role: 'COACH', firstName: 'CoachSynthetic2' });
    const coach1 = await createCoachProfile(client, { userId: coachUser1.id });
    const coach2 = await createCoachProfile(client, { userId: coachUser2.id });

    // 8. capabilities
    await grantCapability(client, { coachId: coach1.id, courseKey: 'maths-seconde' });
    await grantCapability(client, { coachId: coach2.id, courseKey: 'maths-premiere-spe' });

    // 9. mono-course assignments
    const assignment1 = await createAssignment(client, {
      coachId: coach1.id,
      academicYearEnrollmentId: enrollment1.id,
      courseKey: 'maths-seconde',
    });
    const assignment2 = await createAssignment(client, {
      coachId: coach2.id,
      academicYearEnrollmentId: enrollment2.id,
      courseKey: 'maths-premiere-spe',
    });

    // 10. planning series
    const planningSeries = await createPlanningSeries(client, {
      assignmentId: assignment1.id,
      startDate: new Date('2026-09-15'),
      localStartTime: '18:00',
      localEndTime: '19:00',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      modality: 'ONLINE',
      createdById: coachUser1.id,
    });

    // 11. session booking
    const booking = await createSessionBooking(client, {
      assignmentId: assignment1.id,
      planningSeriesId: planningSeries.id,
      startsAt: new Date('2026-09-15T17:00:00Z'),
      endsAt: new Date('2026-09-15T18:00:00Z'),
    });

    // ── Verification ────────────────────────────────────────────────────

    // Household membership correct: 2 parents, 2 students
    const householdWithMembers = await getHouseholdWithMembers(client, household.id);
    expect(householdWithMembers?.parents).toHaveLength(2);
    expect(householdWithMembers?.students).toHaveLength(2);
    expect(new Set(householdWithMembers?.parents.map((p) => p.userId))).toEqual(
      new Set([parentUser1.id, parentUser2.id]),
    );

    // Annual enrollment = sole roster authority
    const roster = await getRosterForYear(client, academicYear.id);
    expect(roster.map((r) => r.studentId).sort()).toEqual([student1.id, student2.id].sort());
    // No legacy field exists on the Student row itself.
    expect(student1).not.toHaveProperty('grade');
    expect(student1).not.toHaveProperty('gradeLevel');
    expect(student1).not.toHaveProperty('academicTrack');

    // Explicit course enrollments correct
    const enrollment2Courses = await listCourseEnrollments(client, enrollment2.id);
    expect(enrollment2Courses.map((c) => c.courseKey).sort()).toEqual(
      ['anglais-premiere-option', 'maths-premiere-spe'].sort(),
    );

    // Coach capability respected + assignment is exactly one scalar courseKey
    expect(typeof assignment1.courseKey).toBe('string');
    expect(assignment1.courseKey).toBe('maths-seconde');
    expect(assignment2.courseKey).toBe('maths-premiere-spe');
    expect(assignment1.coachId).toBe(coach1.id);

    // Planning tied to the assignment
    expect(planningSeries.assignmentId).toBe(assignment1.id);

    // Booking tied to the right context (assignment + series)
    expect(booking.assignmentId).toBe(assignment1.id);
    expect(booking.planningSeriesId).toBe(planningSeries.id);
  });
});
