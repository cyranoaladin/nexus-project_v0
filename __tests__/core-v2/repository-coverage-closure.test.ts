/**
 * Repository coverage closure (mission §M, NEW_DEAD_CODE audit): five
 * exported repository functions had zero callers anywhere outside their
 * own declaration — not even in a test. For a foundation whose entire
 * point is being provable, an untested exported repository function is
 * both dead code and an unproven claim. `endAssignment` in particular
 * backs a specific invariant asserted in a code comment
 * (coach-student-course-assignment.ts: "historical ENDED rows for the
 * same triple remain explicitly allowed") that was never actually
 * exercised — this closes that gap with a real proof, not just a comment.
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
  createStudent,
  createUser,
  endAssignment,
  formatAcademicYearLabel,
  getAcademicYearByStartYear,
  grantCapability,
  hasCapability,
  listHouseholdParents,
} from '@/lib/core-v2/repositories';
import { resetCoreV2Database } from './helpers/reset-db';

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

describe('formatAcademicYearLabel — pure function, no DB', () => {
  test.each([
    [2026, '2026-2027'],
    [2099, '2099-2100'],
  ])('startYear %i => "%s"', (startYear, expected) => {
    expect(formatAcademicYearLabel({ startYear })).toBe(expected);
  });
});

describe('getAcademicYearByStartYear', () => {
  test('finds an existing year by its startYear', async () => {
    const created = await createAcademicYear(client, { startYear: 2027 });
    const found = await getAcademicYearByStartYear(client, 2027);
    expect(found?.id).toBe(created.id);
  });

  test('returns null for a startYear with no matching row', async () => {
    const found = await getAcademicYearByStartYear(client, 1900);
    expect(found).toBeNull();
  });
});

describe('hasCapability', () => {
  test('returns true once granted, false for an ungranted (coach, courseKey) pair', async () => {
    const coachUser = await createUser(client, { role: 'COACH' });
    const coach = await createCoachProfile(client, { userId: coachUser.id });

    expect(await hasCapability(client, coach.id, 'maths-seconde')).toBe(false);

    await grantCapability(client, { coachId: coach.id, courseKey: 'maths-seconde' });

    expect(await hasCapability(client, coach.id, 'maths-seconde')).toBe(true);
    expect(await hasCapability(client, coach.id, 'physique-seconde')).toBe(false);
  });
});

describe('listHouseholdParents', () => {
  test('lists every parent attached to a household', async () => {
    const parentUser = await createUser(client, { role: 'PARENT', email: 'parent-a@synthetic.test' });
    const { household } = await createHouseholdWithParent(client, { parentUserId: parentUser.id });

    const parents = await listHouseholdParents(client, household.id);
    expect(parents).toHaveLength(1);
    expect(parents[0]?.userId).toBe(parentUser.id);
  });

  test('returns an empty array for a household with no parents row matching it', async () => {
    const parentUser = await createUser(client, { role: 'PARENT', email: 'parent-b@synthetic.test' });
    const { household: otherHousehold } = await createHouseholdWithParent(client, {
      parentUserId: parentUser.id,
    });
    const unrelatedParents = await listHouseholdParents(client, `${otherHousehold.id}-does-not-exist`);
    expect(unrelatedParents).toEqual([]);
  });
});

describe('endAssignment', () => {
  test('ending an assignment allows a new ACTIVE assignment for the same (coach, enrollment, courseKey) triple — proves the partial-unique-index comment\'s claim', async () => {
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
    await grantCapability(client, { coachId: coach.id, courseKey: 'maths-seconde' });
    await createCourseEnrollment(client, {
      academicYearEnrollmentId: enrollment.id,
      courseKey: 'maths-seconde',
      kind: 'SPECIALTY',
    });

    const firstAssignment = await createAssignment(client, {
      coachId: coach.id,
      academicYearEnrollmentId: enrollment.id,
      courseKey: 'maths-seconde',
    });

    const ended = await endAssignment(client, firstAssignment.id);
    expect(ended.status).toBe('ENDED');
    expect(ended.endsAt).not.toBeNull();

    // The partial unique index only forbids a SECOND simultaneously-ACTIVE
    // row for this triple — with the first now ENDED, a new ACTIVE
    // assignment for the exact same triple must be accepted, not rejected.
    const secondAssignment = await createAssignment(client, {
      coachId: coach.id,
      academicYearEnrollmentId: enrollment.id,
      courseKey: 'maths-seconde',
    });
    expect(secondAssignment.status).toBe('ACTIVE');
    expect(secondAssignment.id).not.toBe(firstAssignment.id);
  });
});
