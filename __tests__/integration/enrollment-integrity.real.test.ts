jest.unmock('@/lib/prisma');
import { cleanupDisposableTestFixture } from '../helpers/real-db-fixture-cleanup';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { checkEnrollmentIntegrity } from '@/scripts/curriculum/verify-enrollment-integrity';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const PREFIX = `enrollment-integrity-${randomUUID()}-`;
let disposableVerified = false;

async function createStudent() {
  const parent = await prisma.user.create({
    data: {
      id: PREFIX + randomUUID(),
      role: 'PARENT',
      email: null,
      firstName: 'Synthetic',
      lastName: 'Parent',
      parentProfile: { create: {} },
    },
    include: { parentProfile: true },
  });
  const user = await prisma.user.create({
    data: {
      id: PREFIX + randomUUID(),
      role: 'ELEVE',
      email: null,
      firstName: 'Synthetic',
      lastName: 'Student',
      student: {
        create: {
          gradeLevel: 'TERMINALE',
          academicTrack: 'EDS_GENERALE',
          parentId: parent.parentProfile!.id,
        },
      },
    },
    include: { student: true },
  });
  return user.student!;
}

async function cleanup() {
  // `StudentAcademicEnrollment.studentId` references `Student.id` (an
  // auto-generated cuid, never PREFIX-stamped) — filtering on that column
  // directly here always matched zero rows. This previously went
  // unnoticed because Student.user was `onDelete: Cascade`, so deleting
  // the User row below silently cascade-deleted these enrollments anyway.
  // Now that it's `Restrict` (DELETE-1/DELETE-2), that implicit cascade
  // no longer happens, so this must reach the enrollment via the actual
  // relation to the PREFIX-stamped User/Student instead.
  await prisma.studentAcademicEnrollment.deleteMany({ where: { student: { userId: { startsWith: PREFIX } } } });
  // Order comes from the live schema via the canonical fixture cleanup,
  // so this teardown no longer hand-maintains which relations are RESTRICT.
  const fixtureUserIds = (await prisma.user.findMany({
    where: { id: { startsWith: PREFIX } },
    select: { id: true },
  })).map((user) => user.id);
  if (fixtureUserIds.length > 0) {
    await cleanupDisposableTestFixture(prisma, { userIds: fixtureUserIds });
  }
}

beforeAll(() => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  disposableVerified = true;
});
afterEach(async () => { if (disposableVerified) await cleanup(); });
afterAll(async () => { if (disposableVerified) { await cleanup(); await prisma.$disconnect(); } });

it('reports zero anomalies for a real, catalog-valid enrollment row (positive case)', async () => {
  const student = await createStudent();
  await prisma.studentAcademicEnrollment.create({
    data: {
      studentId: student.id,
      courseKey: 'eds-maths-terminale',
      kind: 'SPECIALTY',
      source: 'ADMIN',
      verifiedById: null,
    },
  });

  const result = await checkEnrollmentIntegrity(prisma);
  const own = result.anomalies.filter((a) => a.courseKey === 'eds-maths-terminale');
  expect(own).toEqual([]);
  expect(result.ok || result.anomalies.every((a) => a.courseKey !== 'eds-maths-terminale')).toBe(true);
});

it('discriminates: flags an orphan courseKey unknown to the catalog as UNKNOWN_COURSE_KEY (negative/adversarial case)', async () => {
  const student = await createStudent();
  const orphanCourseKey = 'not-a-real-catalog-course-key';
  // Bypasses the canonical validated writer (lib/curriculum/enrollment.ts)
  // deliberately, exactly like a corrupted/legacy row the gate must catch —
  // the canonical writer would itself refuse this value before it ever
  // reaches the database.
  await prisma.studentAcademicEnrollment.create({
    data: {
      studentId: student.id,
      courseKey: orphanCourseKey,
      kind: 'SPECIALTY',
      source: 'ADMIN',
      verifiedById: null,
    },
  });

  const result = await checkEnrollmentIntegrity(prisma);
  expect(result.ok).toBe(false);
  expect(result.anomalies).toContainEqual(expect.objectContaining({
    anomaly: 'UNKNOWN_COURSE_KEY',
    courseKey: orphanCourseKey,
  }));
});

it('flags a derived/mandatory course wrongly persisted as a chosen enrollment (NON_CHOICE_STORED)', async () => {
  const student = await createStudent();
  await prisma.studentAcademicEnrollment.create({
    data: {
      studentId: student.id,
      // tc-philosophie-terminale is CORE (mandatory/derived), never a choice.
      courseKey: 'tc-philosophie-terminale',
      kind: 'SPECIALTY',
      source: 'ADMIN',
      verifiedById: null,
    },
  });

  const result = await checkEnrollmentIntegrity(prisma);
  expect(result.anomalies).toContainEqual(expect.objectContaining({
    anomaly: 'NON_CHOICE_STORED',
    courseKey: 'tc-philosophie-terminale',
  }));
});
