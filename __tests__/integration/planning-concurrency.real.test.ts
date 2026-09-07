/**
 * Tâche 11 — course de deux créations concurrentes de séance gouvernée pour
 * EXACTEMENT le même créneau (même coach, même élève, même date, même
 * horaire) — contre un vrai Postgres jetable, pas de mock Prisma.
 *
 * Prouve que `materializePlanningSeries` (lib/planning/series.ts), exécutée
 * en transaction SERIALIZABLE, ne peut jamais laisser passer un double
 * booking : soit la contrainte d'exclusion PostgreSQL
 * (`SessionBooking_no_overlap_excl` / `SessionBooking_student_profile_no_overlap_excl`,
 * migration 20260906200000), soit un échec de sérialisation (40001/P2034),
 * arrête la seconde transaction — la route convertit les deux en 409 stable.
 * Résultat attendu, EXACTEMENT : success=1, conflict=1, doubleBooking=0.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireAnyRole: jest.fn(),
}));

import { randomUUID } from 'node:crypto';
import { POST } from '@/app/api/assistante/sessions/route';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const prefix = `planning-concurrency-${randomUUID()}`;
// Tronc commun Première/EDS_GENERALE : DERIVED (obligatoire), aucune ligne
// StudentAcademicEnrollment nécessaire — même choix que assignment-concurrency.real.test.ts.
const COURSE_KEY = 'tc-maths-anticipees-premiere';
const SCHEDULED_DATE = '2027-04-12';

let verified = false;
let staffId = '';
let parentId = '';
let studentId = '';
let coachId = '';
let assignmentId = '';

function makeRequest(body: unknown): any {
  return { json: async () => body };
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
    data: { userId: studentUser.id, parentId, gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' },
  });
  studentId = student.id;

  const coachUser = await prisma.user.create({
    data: { email: `${prefix}-coach@test.example`, role: 'COACH', lastName: prefix },
  });
  const coach = await prisma.coachProfile.create({
    data: { userId: coachUser.id, pseudonym: `${prefix}-coach`, subjects: JSON.stringify(['MATHEMATIQUES']) },
  });
  coachId = coach.id;

  const assignment = await prisma.coachStudentAssignment.create({
    data: {
      coachId,
      studentId,
      status: 'ACTIVE',
      academicCourseKeys: [COURSE_KEY],
      courseScopeState: 'STAFF_VERIFIED',
      startsAt: new Date('2020-01-01T00:00:00Z'),
    },
  });
  assignmentId = assignment.id;

  // Disponibilité récurrente large, un jour par ligne — la date choisie
  // (SCHEDULED_DATE) peut tomber n'importe quel jour de semaine.
  await prisma.coachAvailability.createMany({
    data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      coachId: coachUser.id,
      dayOfWeek,
      startTime: '08:00',
      endTime: '20:00',
      isAvailable: true,
      isRecurring: true,
      validFrom: new Date('2020-01-01T00:00:00Z'),
    })),
  });

  (requireAnyRole as jest.Mock).mockResolvedValue({
    user: { id: staffId, email: `${prefix}-staff@test.example`, role: 'ASSISTANTE' },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  });
});

afterAll(async () => {
  if (!verified) return;
  await prisma.sessionBooking.deleteMany({ where: { assignmentId } });
  // PlanningSeries.assignmentId est RESTRICT : la série créée par
  // materializePlanningSeries doit disparaître avant l'assignation.
  await prisma.planningSeries.deleteMany({ where: { assignmentId } });
  await prisma.coachStudentAssignment.deleteMany({ where: { id: assignmentId } });
  if (coachId) {
    const coach = await prisma.coachProfile.findUnique({ where: { id: coachId }, select: { userId: true } });
    await prisma.coachAvailability.deleteMany({ where: { coachId: coach?.userId } });
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

function sessionBody() {
  return {
    studentProfileId: studentId,
    coachProfileId: coachId,
    assignmentId,
    academicCourseKey: COURSE_KEY,
    scheduledDate: SCHEDULED_DATE,
    startTime: '10:00',
    endTime: '11:00',
    duration: 60,
    title: 'Séance concurrente',
  };
}

test('deux créations concurrentes pour EXACTEMENT le même créneau : success=1, conflict=1, doubleBooking=0', async () => {
  const [responseA, responseB] = await Promise.all([
    POST(makeRequest(sessionBody())),
    POST(makeRequest(sessionBody())),
  ]);

  const statuses = [responseA.status, responseB.status].sort((a, b) => a - b);
  const successCount = statuses.filter((s) => s === 201).length;
  const conflictCount = statuses.filter((s) => s === 409).length;

  // Jamais une 400/500 qui masquerait une régression ailleurs dans la pile.
  expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
  expect(successCount).toBe(1);
  expect(conflictCount).toBe(1);

  const bookings = await prisma.sessionBooking.findMany({
    where: {
      coachProfileId: coachId,
      studentProfileId: studentId,
      scheduledDate: new Date(`${SCHEDULED_DATE}T00:00:00.000Z`),
      status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
    },
  });

  // doubleBooking=0 : exactement une ligne active pour ce créneau contesté.
  expect(bookings).toHaveLength(1);
});
