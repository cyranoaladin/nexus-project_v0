/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('server-only', () => ({}));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/video-mode', () => ({ getVideoMode: jest.fn().mockReturnValue('ENABLED') }));
jest.mock('@/lib/families/student-access-authority', () => ({
  ...jest.requireActual('@/lib/families/student-access-authority'), resolveParentStudentAccess: jest.fn(),
}));
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { GET, POST } from '@/app/api/sessions/[sessionId]/route';
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-10-04T09:00:00Z'));
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT' } } as never);
  jest.mocked(prisma.sessionBooking.findFirst).mockResolvedValue({ id: 'synthetic-session',
    studentId: 'synthetic-student-user', parentId: 'synthetic-parent', coachId: 'synthetic-coach',
    student: { firstName: 'Synthetic', lastName: 'Student' }, coach: { firstName: 'Synthetic', lastName: 'Coach' },
    scheduledDate: new Date('2026-10-04T00:00:00Z'), startTime: '10:00', duration: 60,
    status: 'SCHEDULED', subject: 'MATHEMATIQUES' } as never);
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ id: 'synthetic-student' } as never);
  jest.mocked(prisma.sessionBooking.updateMany).mockResolvedValue({ count: 1 });
});
afterEach(() => jest.useRealTimers());
describe.each([{ name: 'GET', handler: GET, action: 'read' }, { name: 'POST', handler: POST, action: 'mutation' }])('$name current family authority', ({ name, handler, action }) => {
  const invoke = () => handler(new NextRequest('https://nexusreussite.academy/api/sessions/synthetic-session', { method: name }),
    { params: Promise.resolve({ sessionId: 'synthetic-session' }) });
  it.each([{ status: 'DENIED' as const, code: 404 }, { status: 'AUTHORITY_UNAVAILABLE' as const, code: 503 }])('refuses $status before reading private names or producing a room', async ({ status, code }) => {
    jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status });
    const response = await invoke();
    expect(response.status).toBe(code);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).not.toHaveProperty('roomName');
    expect(prisma.sessionBooking.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.sessionBooking.findFirst).toHaveBeenCalledWith({ where: { id: 'synthetic-session' }, select: { studentId: true } });
    expect(prisma.sessionBooking.updateMany).not.toHaveBeenCalled();
  });
  it('passes the operation type to the authority before loading private booking details', async () => {
    jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: 'LEGACY_ALLOWED' });
    expect((await invoke()).status).toBe(200);
    expect(resolveParentStudentAccess).toHaveBeenCalledWith('synthetic-parent', 'synthetic-student', action);
    expect(jest.mocked(prisma.sessionBooking.findFirst).mock.calls[1]?.[0]?.where).toEqual({
      id: 'synthetic-session', studentId: 'synthetic-student-user',
    });
  });
});

it('allows a verified Core family read of the room', async () => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: 'CORE_VERIFIED_READ' });
  const response = await GET(new NextRequest('https://nexusreussite.academy/api/sessions/synthetic-session'),
    { params: Promise.resolve({ sessionId: 'synthetic-session' }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toHaveProperty('roomName');
  expect(prisma.sessionBooking.updateMany).not.toHaveBeenCalled();
});
it('never turns a Core read grant into a V1 join mutation', async () => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: 'CORE_VERIFIED_READ' });
  const response = await POST(new NextRequest('https://nexusreussite.academy/api/sessions/synthetic-session', { method: 'POST' }),
    { params: Promise.resolve({ sessionId: 'synthetic-session' }) });
  expect(response.status).toBe(404);
  expect(prisma.sessionBooking.updateMany).not.toHaveBeenCalled();
  expect(prisma.sessionBooking.findFirst).toHaveBeenCalledTimes(1);
});

it('pins both participant identities in the join compare-and-swap', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-student-user', role: 'ELEVE' } } as never);
  expect((await POST(new NextRequest('https://nexusreussite.academy/api/sessions/synthetic-session', { method: 'POST' }),
    { params: Promise.resolve({ sessionId: 'synthetic-session' }) })).status).toBe(200);
  expect(prisma.sessionBooking.updateMany).toHaveBeenCalledWith({
    where: { id: 'synthetic-session', status: 'SCHEDULED', studentId: 'synthetic-student-user', coachId: 'synthetic-coach' },
    data: { status: 'IN_PROGRESS' },
  });
});
it('does not expose a room as a successful join when a participant change defeats the compare-and-swap', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-student-user', role: 'ELEVE' } } as never);
  jest.mocked(prisma.sessionBooking.updateMany).mockResolvedValue({ count: 0 });
  const response = await POST(new NextRequest('https://nexusreussite.academy/api/sessions/synthetic-session', { method: 'POST' }),
    { params: Promise.resolve({ sessionId: 'synthetic-session' }) });
  expect(response.status).toBe(409);
  expect(await response.json()).not.toHaveProperty('roomName');
});
