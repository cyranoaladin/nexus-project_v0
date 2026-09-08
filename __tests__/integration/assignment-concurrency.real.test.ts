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
import { PATCH } from '@/app/api/assistante/assignments/[id]/route';
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

beforeEach(async () => {
  await prisma.coachStudentAssignment.deleteMany({ where: { coachId, studentId } });
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

function patchAssignment(id: string, body: unknown) {
  return PATCH(makeRequest(body), { params: Promise.resolve({ id }) });
}

async function suspended(assignmentType: 'PRIMARY' | 'SECONDARY') {
  return prisma.coachStudentAssignment.create({ data: {
    coachId, studentId, assignedById: staffId, assignmentType, status: 'SUSPENDED',
    academicCourseKeys: [COURSE_KEY], courseScopeState: 'STAFF_VERIFIED', subjects: ['MATHEMATIQUES'],
  } });
}

async function expectOneActive() {
  expect(await prisma.coachStudentAssignment.count({ where: { coachId, studentId, status: 'ACTIVE' } })).toBe(1);
}

test('deux créations concurrentes de types différents préservent un seul couple actif', async () => {
  const responses = await Promise.all(['PRIMARY', 'SECONDARY'].map((assignmentType) => POST(makeRequest({
    coachId, studentIds: [studentId], assignmentType, courseKeys: [COURSE_KEY],
  }))));
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  await expectOneActive();
});

test('deux réactivations concurrentes de types différents préservent un seul couple actif', async () => {
  const [first, second] = await Promise.all([suspended('PRIMARY'), suspended('SECONDARY')]);
  const responses = await Promise.all([first, second].map((row) => patchAssignment(row.id, { status: 'ACTIVE' })));
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  await expectOneActive();
});

test('création et réactivation concurrentes ne peuvent contourner l’unicité entre types', async () => {
  const row = await suspended('PRIMARY');
  const responses = await Promise.all([
    patchAssignment(row.id, { status: 'ACTIVE' }),
    POST(makeRequest({ coachId, studentIds: [studentId], assignmentType: 'SECONDARY', courseKeys: [COURSE_KEY] })),
  ]);
  expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  expect(responses.filter((response) => response.status === 200 || response.status === 201)).toHaveLength(1);
  await expectOneActive();
});

test('un scope vide et une réécriture terminale laissent la ligne PostgreSQL intacte', async () => {
  const row = await suspended('PRIMARY');
  expect((await patchAssignment(row.id, { courseKeys: [] })).status).toBe(400);
  expect(await prisma.coachStudentAssignment.findUnique({ where: { id: row.id } })).toEqual(row);
  expect((await patchAssignment(row.id, { status: 'ENDED' })).status).toBe(200);
  const ended = await prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: row.id } });
  expect((await patchAssignment(row.id, { courseKeys: [COURSE_KEY], status: 'ACTIVE' })).status).toBe(409);
  expect(await prisma.coachStudentAssignment.findUnique({ where: { id: row.id } })).toEqual(ended);
});

test('une modification concurrente ne réécrit pas le scope après la clôture', async () => {
  const row = await suspended('PRIMARY');
  let release!: () => void;
  let locked!: () => void;
  const acquired = new Promise<void>((resolve) => { locked = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  const lock = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "coach_student_assignments" WHERE "id" = ${row.id} FOR UPDATE`;
    locked();
    await held;
  }, { timeout: 10000 });
  const requests: Promise<Response>[] = [];
  try {
    await acquired;
    const waitForWriters = async (count: number) => {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const [result] = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
          AND wait_event_type = 'Lock' AND query LIKE '%UPDATE%coach_student_assignments%'
        `;
        if (Number(result.count) >= count) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error('Les écritures concurrentes n’ont pas atteint le verrou de test');
    };
    requests.push(patchAssignment(row.id, { status: 'ENDED' }));
    await waitForWriters(1);
    requests.push(patchAssignment(row.id, { courseKeys: [COURSE_KEY] }));
    await waitForWriters(2);
    release();
    await lock;
    const responses = await Promise.all(requests);
    expect(responses.map((response) => response.status)).toEqual([200, 409]);
    const result = await prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: row.id } });
    expect(result.status).toBe('ENDED');
    expect(result.academicCourseKeys).toEqual(row.academicCourseKeys);
  } finally {
    release();
    await lock;
    await Promise.allSettled(requests);
  }
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
