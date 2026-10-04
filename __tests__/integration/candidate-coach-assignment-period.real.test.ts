/** @jest-environment node */
jest.unmock('@/lib/prisma');
jest.mock('server-only', () => ({}));

import { randomUUID } from 'node:crypto';
import { AssignmentStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AuthSession } from '@/lib/guards';
import { getDiagnosticForActor, getStudentForActor } from '@/lib/diagnostics/candidat-libre/access.server';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';
import { cleanupDisposableTestFixture } from '../helpers/real-db-fixture-cleanup';

const now = new Date('2026-10-04T10:00:00.000Z');
const prefix = `candidate-period-${randomUUID()}`;
const fixtureUserIds = new Set<string>();
let studentId: string;
let diagnosticId: string;
let assignmentId: string;
let coachSession: AuthSession;

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  const parent = await prisma.user.create({ data: { role: 'PARENT', email: `${prefix}-parent@synthetic.test` } });
  fixtureUserIds.add(parent.id);
  const parentProfile = await prisma.parentProfile.create({ data: { userId: parent.id } });
  const studentUser = await prisma.user.create({ data: { role: 'ELEVE', email: `${prefix}-student@synthetic.test` } });
  fixtureUserIds.add(studentUser.id);
  const student = await prisma.student.create({ data: { userId: studentUser.id, parentId: parentProfile.id, gradeLevel: 'PREMIERE' } });
  studentId = student.id;
  const coach = await prisma.user.create({ data: { role: 'COACH', email: `${prefix}-coach@synthetic.test` } });
  fixtureUserIds.add(coach.id);
  coachSession = { user: { id: coach.id, email: coach.email!, role: UserRole.COACH }, expires: '2027-01-01T00:00:00Z' };
  const profile = await prisma.coachProfile.create({ data: { userId: coach.id, pseudonym: prefix, subjects: [] } });
  const assignment = await prisma.coachStudentAssignment.create({ data: { coachId: profile.id, studentId, startsAt: now } });
  assignmentId = assignment.id;
  const diagnostic = await prisma.candidateDiagnostic.create({ data: {
    studentId, createdById: coach.id, diagnosticKey: prefix, definitionVersion: 'synthetic-v1', targetSession: 2027,
  } });
  diagnosticId = diagnostic.id;
});

afterAll(async () => {
  try {
    if (fixtureUserIds.size) await cleanupDisposableTestFixture(prisma, { userIds: [...fixtureUserIds] });
  } finally {
    await prisma.$disconnect();
  }
});

const cases = [
  { label: 'future', startsAt: new Date(now.getTime() + 1), endsAt: null, status: AssignmentStatus.ACTIVE, allowed: false },
  { label: 'expired', startsAt: new Date(now.getTime() - 1000), endsAt: new Date(now.getTime() - 1), status: AssignmentStatus.ACTIVE, allowed: false },
  { label: 'starts exactly now', startsAt: now, endsAt: null, status: AssignmentStatus.ACTIVE, allowed: true },
  { label: 'ends exactly now', startsAt: new Date(now.getTime() - 1000), endsAt: now, status: AssignmentStatus.ACTIVE, allowed: true },
  { label: 'open-ended current', startsAt: new Date(now.getTime() - 1000), endsAt: null, status: AssignmentStatus.ACTIVE, allowed: true },
  { label: 'suspended', startsAt: new Date(now.getTime() - 1000), endsAt: null, status: AssignmentStatus.SUSPENDED, allowed: false },
];

describe.each(['student', 'diagnostic'] as const)('candidate coach %s authorization on real PostgreSQL', target => {
  test.each(cases)('$label assignment follows its effective period', async ({ label: _label, allowed, ...data }) => {
    await prisma.coachStudentAssignment.update({ where: { id: assignmentId }, data });
    const detailedRead = jest.spyOn(target === 'student' ? prisma.student : prisma.candidateDiagnostic, 'findUnique');
    try {
      const result = target === 'student'
        ? await getStudentForActor(coachSession, studentId, 'read', now)
        : await getDiagnosticForActor(coachSession, diagnosticId, 'read', now);
      if (allowed) {
        expect(result).not.toBeInstanceOf(Response);
        expect(result).toMatchObject({ id: target === 'student' ? studentId : diagnosticId });
      } else {
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(403);
        expect(detailedRead.mock.calls.some(([query]) => query?.include !== undefined)).toBe(false);
      }
    } finally {
      detailedRead.mockRestore();
    }
  });
});
