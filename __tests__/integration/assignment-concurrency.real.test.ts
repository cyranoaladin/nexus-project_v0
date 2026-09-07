/**
 * Course de deux créations concurrentes de la même assignation
 * coach/élève — contre un vrai Postgres jetable, pas de mock Prisma.
 *
 * Couvre le dernier item du checklist de la Task 9 (`docs/superpowers/plans/
 * 2026-09-06-core-family-academic-planning.md`) : la nouvelle validation de
 * périmètre de cours (reload Student + CoachProfile, `courseKeys` validés)
 * introduite dans `POST /api/assistante/assignments` ne doit JAMAIS affaiblir
 * la garantie d'unicité déjà assurée par l'index partiel
 * `coach_student_assignments_active_unique` + le catch P2002 de la route :
 * deux requêtes concurrentes pour le même couple (coach, élève, type) ne
 * doivent jamais produire deux lignes ACTIVE.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { randomUUID } from 'node:crypto';
import { POST } from '@/app/api/assistante/assignments/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const prefix = `assignment-concurrency-${randomUUID()}`;
// Tronc commun Première/EDS_GENERALE : DERIVED (obligatoire) sans qu'aucune
// ligne `StudentAcademicEnrollment` ne soit nécessaire pour ce test.
const COURSE_KEY = 'tc-maths-anticipees-premiere';

let verified = false;
let staffId = '';
let parentId = '';
let studentId = '';
let coachId = '';
const createdAssignmentIds: string[] = [];

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/assistante/assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  verified = true;

  const staffUser = await prisma.user.create({
    data: { email: `${prefix}-staff@test.example`, role: 'ASSISTANTE', lastName: prefix },
  });
  staffId = staffUser.id;

  const parentUser = await prisma.user.create({
    data: { email: `${prefix}-parent@test.example`, role: 'PARENT', lastName: prefix },
  });
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  parentId = parent.id;

  const studentUser = await prisma.user.create({
    data: { email: `${prefix}-student@test.example`, role: 'ELEVE', lastName: prefix },
  });
  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      parentId,
      gradeLevel: 'PREMIERE',
      academicTrack: 'EDS_GENERALE',
    },
  });
  studentId = student.id;

  const coachUser = await prisma.user.create({
    data: { email: `${prefix}-coach@test.example`, role: 'COACH', lastName: prefix },
  });
  const coach = await prisma.coachProfile.create({
    data: {
      userId: coachUser.id,
      pseudonym: `${prefix}-coach`,
      subjects: JSON.stringify(['MATHEMATIQUES']),
    },
  });
  coachId = coach.id;

  (auth as jest.Mock).mockResolvedValue({
    user: { id: staffId, email: `${prefix}-staff@test.example`, role: 'ASSISTANTE' },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  });
});

afterAll(async () => {
  if (!verified) return;
  await prisma.coachStudentAssignment.deleteMany({
    where: { OR: [{ coachId }, { id: { in: createdAssignmentIds } }] },
  });
  if (coachId) {
    const coach = await prisma.coachProfile.findUnique({ where: { id: coachId }, select: { userId: true } });
    await prisma.coachProfile.delete({ where: { id: coachId } });
    if (coach) await prisma.user.delete({ where: { id: coach.userId } }).catch(() => undefined);
  }
  if (studentId) {
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } });
    await prisma.student.delete({ where: { id: studentId } });
    if (student) await prisma.user.delete({ where: { id: student.userId } }).catch(() => undefined);
  }
  if (parentId) {
    const parent = await prisma.parentProfile.findUnique({ where: { id: parentId }, select: { userId: true } });
    await prisma.parentProfile.delete({ where: { id: parentId } });
    if (parent) await prisma.user.delete({ where: { id: parent.userId } }).catch(() => undefined);
  }
  await prisma.user.deleteMany({ where: { lastName: prefix } });
  await prisma.$disconnect();
});

test('deux POST concurrents pour le même coach/élève ne créent qu\'une seule assignation active', async () => {
  const body = {
    coachId,
    studentIds: [studentId],
    courseKeys: [COURSE_KEY],
  };

  const [responseA, responseB] = await Promise.all([
    POST(makeRequest(body)),
    POST(makeRequest(body)),
  ]);

  const [bodyA, bodyB] = await Promise.all([responseA.json(), responseB.json()]);
  const statuses = [responseA.status, responseB.status].sort();

  // Exactement une création (201) et un conflit propre (409) — jamais deux
  // succès, jamais une 500 qui masquerait une régression de la garde P2002.
  expect(statuses).toEqual([201, 409]);

  const successBody = responseA.status === 201 ? bodyA : bodyB;
  const conflictBody = responseA.status === 409 ? bodyA : bodyB;
  expect(successBody.success).toBe(true);
  expect(successBody.assignments).toHaveLength(1);
  createdAssignmentIds.push(successBody.assignments[0].id);
  expect(conflictBody.error).toBe('Conflict');

  const activeAssignments = await prisma.coachStudentAssignment.findMany({
    where: { coachId, studentId, status: 'ACTIVE' },
  });
  expect(activeAssignments).toHaveLength(1);
  expect(activeAssignments[0]?.academicCourseKeys).toEqual([COURSE_KEY]);
  expect(activeAssignments[0]?.courseScopeState).toBe('STAFF_VERIFIED');
});
