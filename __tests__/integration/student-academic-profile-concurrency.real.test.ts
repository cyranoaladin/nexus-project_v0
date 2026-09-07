/**
 * Deux écritures concurrentes de la fiche scolaire d'un même élève, contre
 * un vrai Postgres jetable — pas de mock.
 *
 * Les deux appels lisent `expectedRevision = N` et écrivent en même temps :
 * exactement l'un des deux doit réussir (révision devient N+1, carte reflète
 * ses propres choix), l'autre doit échouer avec `ACADEMIC_REVISION_CONFLICT`
 * SANS AVOIR RIEN écrit — ni fusion, ni corruption des données du perdant.
 *
 * Optimiste, pas pessimiste : chaque écrivain fait
 * `UPDATE ... WHERE academicRevision = N`. Postgres sérialise les deux UPDATE
 * concurrents sur la même ligne (verrou ligne) ; celui qui obtient le verrou
 * en second ré-évalue son WHERE sur l'état commité par le premier — il ne
 * matche plus. Aucune synchronisation artificielle n'est nécessaire ici :
 * c'est exactement le mécanisme déjà utilisé par
 * `app/api/stages/.../confirm/route.ts` et
 * `app/api/assistante/family-requests/[requestId]/convert/route.ts`.
 */

jest.unmock('@/lib/prisma');

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import {
  AcademicRevisionConflictError,
  updateStudentAcademicProfile,
} from '@/lib/curriculum/student-academic-profile';

const prefix = 'academic-profile-concurrency-' + randomUUID();
let studentId = '';
let verified = false;

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  verified = true;

  const staff = await prisma.user.create({
    data: { id: `${prefix}-staff`, role: 'ASSISTANTE', lastName: prefix },
  });
  const parentUser = await prisma.user.create({
    data: { email: `${prefix}-parent@test.example`, role: 'PARENT', lastName: prefix },
  });
  const studentUser = await prisma.user.create({
    data: { email: `${prefix}-student@test.example`, role: 'ELEVE', lastName: prefix },
  });
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      parentId: parent.id,
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
    },
  });
  studentId = student.id;

  await prisma.studentAcademicEnrollment.create({
    data: {
      studentId,
      courseKey: 'eds-maths-terminale',
      kind: 'SPECIALTY',
      source: 'ADMIN',
      verifiedAt: new Date(),
      verifiedById: staff.id,
    },
  });
});

afterAll(async () => {
  if (!verified) return;
  const users = await prisma.user.findMany({ where: { lastName: prefix }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  await prisma.studentAcademicEnrollment.deleteMany({ where: { studentId } });
  await prisma.student.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.parentProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('deux écritures concurrentes: une seule réussit, l’autre échoue ACADEMIC_REVISION_CONFLICT sans rien écrire', async () => {
  const before = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { academicRevision: true },
  });
  expect(before.academicRevision).toBe(0);

  const writerA = updateStudentAcademicProfile(
    studentId,
    {},
    ['eds-nsi-terminale'],
    0,
    { source: 'ADMIN', verifiedById: `${prefix}-staff` },
  );
  const writerB = updateStudentAcademicProfile(
    studentId,
    {},
    ['eds-ses-terminale'],
    0,
    { source: 'ADMIN', verifiedById: `${prefix}-staff` },
  );

  const results = await Promise.allSettled([writerA, writerB]);

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);

  const conflict = rejected[0] as PromiseRejectedResult;
  expect(conflict.reason).toBeInstanceOf(AcademicRevisionConflictError);
  expect(conflict.reason).toMatchObject({ code: 'ACADEMIC_REVISION_CONFLICT' });

  const winner = (fulfilled[0] as PromiseFulfilledResult<Awaited<typeof writerA>>).value;
  expect(winner.academicRevision).toBe(1);

  // État final réellement en base : uniquement les changements du gagnant,
  // rien du perdant, rien de fusionné.
  const after = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { academicRevision: true },
  });
  expect(after.academicRevision).toBe(1);

  const enrollments = await prisma.studentAcademicEnrollment.findMany({
    where: { studentId },
    select: { courseKey: true },
    orderBy: { courseKey: 'asc' },
  });
  const courseKeys = enrollments.map((row) => row.courseKey);

  const winnerCourseKey = winner.courses.find(
    (view) => view.academicStatus === 'ENROLLED' && view.course.kind === 'SPECIALTY',
  )?.course.courseKey;
  expect(winnerCourseKey).toBeDefined();
  expect(courseKeys).toEqual([winnerCourseKey]);

  // Le choix du perdant n'a laissé AUCUNE trace.
  const loserCourseKey = winnerCourseKey === 'eds-nsi-terminale' ? 'eds-ses-terminale' : 'eds-nsi-terminale';
  expect(courseKeys).not.toContain(loserCourseKey);
  // L'ancien choix (eds-maths-terminale), remplacé par le gagnant, n'est plus là non plus.
  expect(courseKeys).not.toContain('eds-maths-terminale');
});
