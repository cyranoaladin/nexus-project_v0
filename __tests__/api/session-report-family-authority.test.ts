/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('server-only', () => ({}));
jest.mock('@/lib/families/student-access-authority', () => ({
  ...jest.requireActual('@/lib/families/student-access-authority'), resolveParentStudentAccess: jest.fn(),
}));
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { GET } from '@/app/api/coach/sessions/[sessionId]/report/route';
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT' } } as never);
  jest.mocked(prisma.sessionBooking.findUnique).mockResolvedValue({ id: 'synthetic-session',
    studentId: 'synthetic-student-user', parentId: 'synthetic-parent', coachId: 'synthetic-coach' } as never);
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ id: 'synthetic-student' } as never);
  jest.mocked(prisma.sessionReport.findUnique).mockResolvedValue({ id: 'synthetic-report', summary: 'Synthetic summary' } as never);
});
const invoke = () => GET(new NextRequest('https://nexusreussite.academy/api/coach/sessions/synthetic-session/report'),
  { params: Promise.resolve({ sessionId: 'synthetic-session' }) });
it.each([
  { status: 'DENIED' as const, expected: 403 },
  { status: 'AUTHORITY_UNAVAILABLE' as const, expected: 503 },
])('refuses historical parent access when current family authority is $status before loading report content', async ({ status, expected }) => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status });
  const response = await invoke();
  expect(response.status).toBe(expected);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(prisma.sessionReport.findUnique).not.toHaveBeenCalled();
});
it('allows a verified family read and binds the report to the booking student', async () => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: 'CORE_VERIFIED_READ' });
  expect((await invoke()).status).toBe(200);
  expect(resolveParentStudentAccess).toHaveBeenCalledWith('synthetic-parent', 'synthetic-student', 'read');
  expect(jest.mocked(prisma.sessionReport.findUnique).mock.calls[0]?.[0]).not.toHaveProperty('include');
  expect(prisma.sessionReport.findUnique).toHaveBeenCalledWith(expect.objectContaining({
    where: { sessionId: 'synthetic-session', student: { userId: 'synthetic-student-user' } },
  }));
});
it('refuses a missing canonical student mapping without loading content', async () => {
  jest.mocked(prisma.student.findUnique).mockResolvedValue(null);
  expect((await invoke()).status).toBe(403);
  expect(prisma.sessionReport.findUnique).not.toHaveBeenCalled();
});
it('refuses an unrelated student even if no report exists', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-other-student', role: 'ELEVE' } } as never);
  jest.mocked(prisma.sessionReport.findUnique).mockResolvedValue(null);
  expect((await invoke()).status).toBe(403);
  expect(prisma.sessionReport.findUnique).not.toHaveBeenCalled();
});

it.each([
  { id: 'synthetic-coach', role: 'COACH', authority: 'V1' },
  { id: 'synthetic-student-user', role: 'ELEVE' },
  { id: 'synthetic-admin', role: 'ADMIN' },
  { id: 'synthetic-assistant', role: 'ASSISTANTE' },
])('preserves the authorized $role read without using a family fallback', async user => {
  jest.mocked(auth).mockResolvedValue({ user } as never);
  expect((await invoke()).status).toBe(200);
  expect(resolveParentStudentAccess).not.toHaveBeenCalled();
});
it('preserves an explicitly authorized legacy read in V1-only compatibility', async () => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: 'LEGACY_ALLOWED' });
  expect((await invoke()).status).toBe(200);
});
it('does not reuse a historical coach identity after the account becomes a parent', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-coach', role: 'PARENT' } } as never);
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: 'DENIED' });
  expect((await invoke()).status).toBe(403);
  expect(prisma.sessionReport.findUnique).not.toHaveBeenCalled();
});
