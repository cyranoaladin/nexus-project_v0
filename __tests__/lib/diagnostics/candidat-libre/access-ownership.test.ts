/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  requireParentOwnsStudent: jest.fn(),
  isErrorResponse: (value: unknown) => value instanceof Response,
}));

import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireParentOwnsStudent, type AuthSession } from '@/lib/guards';
import { getDiagnosticForActor, getStudentForActor } from '@/lib/diagnostics/candidat-libre/access.server';

const actor = (role: UserRole): AuthSession => ({
  user: { id: 'synthetic-viewer', email: 'viewer@synthetic.test', role },
  expires: '2027-01-01T00:00:00Z',
});
const minimal = { id: 'synthetic-diagnostic', studentId: 'synthetic-student',
  student: { userId: 'synthetic-other-user' } };
const full = { ...minimal, modules: [{ answers: 'synthetic-confidential-answer' }], documents: [] };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.coachStudentAssignment.findFirst).mockResolvedValue(null);
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ id: 'synthetic-student' } as never);
  jest.mocked(prisma.candidateDiagnostic.findUnique).mockReset();
  jest.mocked(prisma.candidateDiagnostic.findUnique)
    .mockResolvedValueOnce(minimal as never).mockResolvedValue(full as never);
  jest.mocked(requireParentOwnsStudent).mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
});

test('an unassigned coach cannot resolve another student or load their profile', async () => {
  const result = await getStudentForActor(actor(UserRole.COACH), 'synthetic-student', 'read');
  expect(result).toBeInstanceOf(Response);
  expect((result as Response).status).toBe(403);
  expect(prisma.student.findUnique).not.toHaveBeenCalled();
});

test('an assigned coach resolves the student only after the active assignment check', async () => {
  jest.mocked(prisma.coachStudentAssignment.findFirst).mockResolvedValue({ id: 'synthetic-assignment' } as never);
  expect(await getStudentForActor(actor(UserRole.COACH), 'synthetic-student', 'read')).toEqual({ id: 'synthetic-student' });
  expect(prisma.coachStudentAssignment.findFirst).toHaveBeenCalledWith({
    where: { studentId: 'synthetic-student', coach: { userId: 'synthetic-viewer' }, status: 'ACTIVE' },
    select: { id: true },
  });
  expect(jest.mocked(prisma.coachStudentAssignment.findFirst).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(prisma.student.findUnique).mock.invocationCallOrder[0]!);
});

test.each([UserRole.COACH, UserRole.PARENT, UserRole.ELEVE])(
  'a refused %s never loads diagnostic answers, documents or names', async role => {
    const result = await getDiagnosticForActor(actor(role), 'synthetic-diagnostic', 'read');
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(prisma.candidateDiagnostic.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.candidateDiagnostic.findUnique).toHaveBeenCalledWith({
      where: { id: 'synthetic-diagnostic' },
      select: { id: true, studentId: true, student: { select: { userId: true } } },
    });
  });

test.each([UserRole.ADMIN, UserRole.ASSISTANTE])('an authorized staff %s loads details after the scope lookup', async role => {
  expect(await getDiagnosticForActor(actor(role), 'synthetic-diagnostic', 'read')).toEqual(full);
  expect(prisma.candidateDiagnostic.findUnique).toHaveBeenCalledTimes(2);
});

test('an assigned coach can load the diagnostic after authorization', async () => {
  jest.mocked(prisma.coachStudentAssignment.findFirst).mockResolvedValue({ id: 'synthetic-assignment' } as never);
  expect(await getDiagnosticForActor(actor(UserRole.COACH), 'synthetic-diagnostic', 'read')).toEqual(full);
  expect(jest.mocked(prisma.coachStudentAssignment.findFirst).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(prisma.candidateDiagnostic.findUnique).mock.invocationCallOrder[1]!);
});

test('a Core authority outage cannot load details or become legacy access', async () => {
  jest.mocked(requireParentOwnsStudent).mockResolvedValue(NextResponse.json({ error: 'Unavailable' }, { status: 503 }));
  const result = await getDiagnosticForActor(actor(UserRole.PARENT), 'synthetic-diagnostic', 'read');
  expect((result as Response).status).toBe(503);
  expect(prisma.candidateDiagnostic.findUnique).toHaveBeenCalledTimes(1);
  expect(jest.mocked(prisma.candidateDiagnostic.findUnique).mock.calls[0]?.[0].select).toBeDefined();
});

test('a verified parent mutation retains the explicit mutation intent', async () => {
  jest.mocked(requireParentOwnsStudent).mockResolvedValue(true);
  expect(await getDiagnosticForActor(actor(UserRole.PARENT), 'synthetic-diagnostic', 'mutation')).toEqual(full);
  expect(requireParentOwnsStudent).toHaveBeenCalledWith('synthetic-viewer', 'synthetic-student', 'mutation');
});
