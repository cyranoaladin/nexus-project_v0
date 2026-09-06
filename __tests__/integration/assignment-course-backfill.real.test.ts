/**
 * Backfill des périmètres de cours canoniques — contre un vrai Postgres
 * jetable, pas de mock.
 *
 * Couvre les quatre cas réels du plan `2026-09-06-core-family-academic-
 * planning` (Task 8) :
 *   - un cas BACKFILL_AUTO propre (un seul cours suivi correspond à la
 *     matière historique et le coach sait l'enseigner) ;
 *   - un cas BACKFILL_UNRESOLVED (l'élève ne suit aucun cours de cette
 *     matière) ;
 *   - un cas BACKFILL_AMBIGUOUS (fixture réelle Première : tronc commun
 *     maths anticipées + spécialité maths, tous deux suivis simultanément) ;
 *   - une ligne déjà STAFF_VERIFIED, qui ne doit JAMAIS être touchée.
 *
 * Le script est rejoué une seconde fois pour vérifier l'idempotence :
 * aucune ligne déjà classée ne doit être réécrite (updatedAt inchangé).
 */

jest.unmock('@/lib/prisma');

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import {
  createPrismaBackfillPort,
  runBackfill,
} from '@/scripts/core/backfill-assignment-course-keys';
import { loadCoreMigrationState } from '@/scripts/core/report-core-migration-state';

const prefix = `assignment-course-backfill-${randomUUID()}`;

let verified = false;
let staffId = '';
let parentId = '';
const studentIds: Record<'auto' | 'unresolved' | 'ambiguous' | 'verified', string> = {
  auto: '',
  unresolved: '',
  ambiguous: '',
  verified: '',
};
const coachIds: Record<'auto' | 'unresolved' | 'ambiguous' | 'verified', string> = {
  auto: '',
  unresolved: '',
  ambiguous: '',
  verified: '',
};
const assignmentIds: Record<'auto' | 'unresolved' | 'ambiguous' | 'verified', string> = {
  auto: '',
  unresolved: '',
  ambiguous: '',
  verified: '',
};

async function createStudent(key: string, academicTrack: 'EDS_GENERALE' = 'EDS_GENERALE') {
  const studentUser = await prisma.user.create({
    data: { email: `${prefix}-student-${key}@test.example`, role: 'ELEVE', lastName: prefix },
  });
  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      parentId,
      gradeLevel: 'PREMIERE',
      academicTrack,
    },
  });
  return student.id;
}

async function createCoach(key: string, subjects: readonly string[]) {
  const coachUser = await prisma.user.create({
    data: { email: `${prefix}-coach-${key}@test.example`, role: 'COACH', lastName: prefix },
  });
  const coach = await prisma.coachProfile.create({
    data: {
      userId: coachUser.id,
      pseudonym: `${prefix}-coach-${key}`,
      subjects: JSON.stringify(subjects),
    },
  });
  return coach.id;
}

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  verified = true;

  const staffUser = await prisma.user.create({
    data: { id: `${prefix}-staff`, role: 'ASSISTANTE', lastName: prefix },
  });
  staffId = staffUser.id;
  const parentUser = await prisma.user.create({
    data: { email: `${prefix}-parent@test.example`, role: 'PARENT', lastName: prefix },
  });
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  parentId = parent.id;

  studentIds.auto = await createStudent('auto');
  studentIds.unresolved = await createStudent('unresolved');
  studentIds.ambiguous = await createStudent('ambiguous');
  studentIds.verified = await createStudent('verified');

  coachIds.auto = await createCoach('auto', ['NSI']);
  coachIds.unresolved = await createCoach('unresolved', ['SES']);
  coachIds.ambiguous = await createCoach('ambiguous', ['MATHEMATIQUES']);
  coachIds.verified = await createCoach('verified', ['MATHEMATIQUES']);

  // AUTO: l'élève suit la spécialité NSI, seul cours de cette matière — un candidat.
  await prisma.studentAcademicEnrollment.create({
    data: {
      studentId: studentIds.auto,
      courseKey: 'eds-nsi-premiere',
      kind: 'SPECIALTY',
      source: 'ADMIN',
      verifiedAt: new Date(),
      verifiedById: staffId,
    },
  });

  // UNRESOLVED: l'élève suit maths, pas SES — zéro cours de la matière assignée.
  await prisma.studentAcademicEnrollment.create({
    data: {
      studentId: studentIds.unresolved,
      courseKey: 'eds-maths-premiere',
      kind: 'SPECIALTY',
      source: 'ADMIN',
      verifiedAt: new Date(),
      verifiedById: staffId,
    },
  });

  // AMBIGUOUS: fixture réelle — spécialité maths ET tronc commun maths anticipées
  // sont simultanément suivis, tous deux legacySubject MATHEMATIQUES.
  await prisma.studentAcademicEnrollment.create({
    data: {
      studentId: studentIds.ambiguous,
      courseKey: 'eds-maths-premiere',
      kind: 'SPECIALTY',
      source: 'ADMIN',
      verifiedAt: new Date(),
      verifiedById: staffId,
    },
  });

  const auto = await prisma.coachStudentAssignment.create({
    data: {
      coachId: coachIds.auto,
      studentId: studentIds.auto,
      assignedById: staffId,
      subjects: ['NSI'],
      status: 'ACTIVE',
    },
  });
  assignmentIds.auto = auto.id;

  const unresolved = await prisma.coachStudentAssignment.create({
    data: {
      coachId: coachIds.unresolved,
      studentId: studentIds.unresolved,
      assignedById: staffId,
      subjects: ['SES'],
      status: 'ACTIVE',
    },
  });
  assignmentIds.unresolved = unresolved.id;

  const ambiguous = await prisma.coachStudentAssignment.create({
    data: {
      coachId: coachIds.ambiguous,
      studentId: studentIds.ambiguous,
      assignedById: staffId,
      subjects: ['MATHEMATIQUES'],
      status: 'ACTIVE',
    },
  });
  assignmentIds.ambiguous = ambiguous.id;

  const staffVerified = await prisma.coachStudentAssignment.create({
    data: {
      coachId: coachIds.verified,
      studentId: studentIds.verified,
      assignedById: staffId,
      subjects: ['MATHEMATIQUES'],
      status: 'ACTIVE',
      courseScopeState: 'STAFF_VERIFIED',
      academicCourseKeys: ['eds-maths-premiere'],
    },
  });
  assignmentIds.verified = staffVerified.id;
});

afterAll(async () => {
  if (!verified) return;
  await prisma.coachStudentAssignment.deleteMany({
    where: { id: { in: Object.values(assignmentIds).filter(Boolean) } },
  });
  await prisma.studentAcademicEnrollment.deleteMany({
    where: { studentId: { in: Object.values(studentIds).filter(Boolean) } },
  });
  const coachUserIds = (await prisma.coachProfile.findMany({
    where: { id: { in: Object.values(coachIds).filter(Boolean) } },
    select: { userId: true },
  })).map((row) => row.userId);
  await prisma.coachProfile.deleteMany({ where: { id: { in: Object.values(coachIds).filter(Boolean) } } });
  const studentUserIds = (await prisma.student.findMany({
    where: { id: { in: Object.values(studentIds).filter(Boolean) } },
    select: { userId: true },
  })).map((row) => row.userId);
  await prisma.student.deleteMany({ where: { id: { in: Object.values(studentIds).filter(Boolean) } } });
  await prisma.parentProfile.deleteMany({ where: { id: parentId } });
  const users = await prisma.user.findMany({ where: { lastName: prefix }, select: { id: true } });
  const userIds = [...new Set([...users.map((u) => u.id), ...coachUserIds, ...studentUserIds])];
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('backfill classe AUTO/UNRESOLVED/AMBIGUOUS sans jamais toucher une ligne STAFF_VERIFIED, et reste idempotent', async () => {
  const before = await loadCoreMigrationState(prisma);

  const port = createPrismaBackfillPort(
    prisma as unknown as Parameters<typeof createPrismaBackfillPort>[0],
  );
  const summary = await runBackfill(port, { apply: true });

  expect(summary.scanned).toBeGreaterThanOrEqual(3);

  const [autoRow, unresolvedRow, ambiguousRow, verifiedRow] = await Promise.all([
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.auto } }),
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.unresolved } }),
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.ambiguous } }),
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.verified } }),
  ]);

  expect(autoRow.courseScopeState).toBe('BACKFILL_AUTO');
  expect(autoRow.academicCourseKeys).toEqual(['eds-nsi-premiere']);

  expect(unresolvedRow.courseScopeState).toBe('BACKFILL_UNRESOLVED');
  expect(unresolvedRow.academicCourseKeys).toEqual([]);

  expect(ambiguousRow.courseScopeState).toBe('BACKFILL_AMBIGUOUS');
  expect(ambiguousRow.academicCourseKeys).toEqual([]);

  // Jamais touchée: état ET clés inchangés, exactement comme seedés.
  expect(verifiedRow.courseScopeState).toBe('STAFF_VERIFIED');
  expect(verifiedRow.academicCourseKeys).toEqual(['eds-maths-premiere']);

  // `before` est déjà pris APRÈS le seed (les 4 lignes existent, à l'état
  // par défaut BACKFILL_UNRESOLVED sauf la ligne STAFF_VERIFIED) : le backfill
  // ne fait donc migrer QUE `auto` et `ambiguous` hors du panier UNRESOLVED.
  const after = await loadCoreMigrationState(prisma);
  expect(after.ACTIVE_ASSIGNMENT_UNRESOLVED - before.ACTIVE_ASSIGNMENT_UNRESOLVED).toBe(-2);
  expect(after.ACTIVE_ASSIGNMENT_AMBIGUOUS - before.ACTIVE_ASSIGNMENT_AMBIGUOUS).toBe(1);
  expect(
    after.activeAssignmentsByCourseScopeState.BACKFILL_AUTO
      - before.activeAssignmentsByCourseScopeState.BACKFILL_AUTO,
  ).toBe(1);
  expect(
    after.activeAssignmentsByCourseScopeState.STAFF_VERIFIED
      - before.activeAssignmentsByCourseScopeState.STAFF_VERIFIED,
  ).toBe(0);

  // ── Idempotence : rejouer ne doit RIEN réécrire ────────────────────────────
  const beforeSecondRun = await Promise.all([
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.auto } }),
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.unresolved } }),
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.ambiguous } }),
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.verified } }),
  ]);

  const secondSummary = await runBackfill(port, { apply: true });
  expect(secondSummary.changed).toBe(0);

  const afterSecondRun = await Promise.all([
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.auto } }),
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.unresolved } }),
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.ambiguous } }),
    prisma.coachStudentAssignment.findUniqueOrThrow({ where: { id: assignmentIds.verified } }),
  ]);

  beforeSecondRun.forEach((rowBefore, index) => {
    const rowAfter = afterSecondRun[index]!;
    expect(rowAfter.updatedAt.getTime()).toBe(rowBefore.updatedAt.getTime());
    expect(rowAfter.courseScopeState).toBe(rowBefore.courseScopeState);
    expect(rowAfter.academicCourseKeys).toEqual(rowBefore.academicCourseKeys);
  });
});
