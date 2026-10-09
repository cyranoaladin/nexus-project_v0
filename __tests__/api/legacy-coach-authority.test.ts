import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { GET as notes, POST as createNote } from '@/app/api/coach/students/[studentId]/notes/route';
import { POST as survival } from '@/app/api/coach/students/[studentId]/survival-mode/route';
import { GET as dossier } from '@/app/api/coach/students/[studentId]/dossier/route';
import { POST as trajectory } from '@/app/api/coach/trajectory/route';
import { GET as eamSummary } from '@/app/api/coach/students/eam-summary/route';
import { GET as dashboard } from '@/app/api/coach/dashboard/route';
import { GET as students } from '@/app/api/coach/students/route';
import { GET as documents, POST as upload } from '@/app/api/coach/students/[studentId]/documents/route';
import { GET as report, POST as writeReport } from '@/app/api/coach/sessions/[sessionId]/report/route';
import { readAuthorizedDocument } from '@/lib/documents/read-authority';
import { GET, POST, DELETE } from '@/app/api/coaches/availability/route';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/guards', () => ({ requireRole: () => auth(), isErrorResponse: () => false }));
jest.mock('@/lib/rbac/coach-student-access', () => ({ assertCoachCanAccessStudent: jest.fn().mockResolvedValue(undefined), activeAssignmentWhere: () => ({}), getAssignedStudentsForCoach: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/csrf', () => ({ checkCsrf: () => null }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  coachProfile: { findUnique: jest.fn().mockResolvedValue(null) },
  student: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
  userDocument: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
  sessionReport: { findUnique: jest.fn().mockResolvedValue(null) },
  coachAvailability: {
    findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null),
    deleteMany: jest.fn(), createMany: jest.fn(), delete: jest.fn(),
  },
  sessionBooking: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
  $transaction: jest.fn().mockResolvedValue([]),
} }));

beforeEach(() => jest.clearAllMocks());

it.each(['CORE_V2', undefined].flatMap(authority => [dashboard, GET, POST, DELETE].map(handler => ({ authority, handler }))))('refuses V1 access for $authority through $handler', async ({ authority, handler }) => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'same-id-in-both-stores', role: 'COACH', authority } } as never);
  const request = new NextRequest('http://localhost/api/coaches/availability?id=slot', {
    method: 'POST', body: JSON.stringify({ type: 'weekly', schedule: [] }),
  });
  const readBody = jest.spyOn(request, 'json');
  {
    const response = await handler(request);
    expect(response.status).toBe(403);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Vary')).toContain('Cookie');
  }
  expect(readBody).not.toHaveBeenCalled();
  expect(prisma.coachProfile.findUnique).not.toHaveBeenCalled();
  expect(prisma.coachAvailability.findMany).not.toHaveBeenCalled();
  expect(prisma.coachAvailability.findFirst).not.toHaveBeenCalled();
  expect(prisma.coachAvailability.deleteMany).not.toHaveBeenCalled();
  expect(prisma.coachAvailability.createMany).not.toHaveBeenCalled();
  expect(prisma.coachAvailability.delete).not.toHaveBeenCalled();
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it('retains availability mutation for an explicit V1 coach', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'legacy-coach', role: 'COACH', authority: 'V1' } } as never);
  const response = await POST(new NextRequest('http://localhost/api/coaches/availability', {
    method: 'POST', body: JSON.stringify({ type: 'weekly', schedule: [] }),
  }));
  expect(response.status).toBe(200);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
});

const studentParams = { params: Promise.resolve({ studentId: 'legacy-student' }) };
const reportParams = { params: Promise.resolve({ sessionId: 'legacy-booking' }) };
const adjacentReaders = [
  students, trajectory, eamSummary,
  (request: NextRequest) => notes(request, studentParams),
  (request: NextRequest) => createNote(request, studentParams),
  (request: NextRequest) => survival(request, studentParams),
  (request: NextRequest) => dossier(request, studentParams),
  (request: NextRequest) => documents(request, studentParams),
  (request: NextRequest) => upload(request, studentParams),
  (request: NextRequest) => report(request, reportParams),
  (request: NextRequest) => writeReport(request, reportParams),
];
it.each(['CORE_V2', undefined].flatMap(authority => adjacentReaders.map(handler => ({ authority, handler }))))('refuses adjacent V1 coach data before lookup for $authority / $handler', async ({ authority, handler }) => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'same-id-in-both-stores', role: 'COACH', authority } } as never);
  const request = new NextRequest('http://localhost/api/coach/students', { method: 'POST', body: '{}' });
  const body = jest.spyOn(request, 'json');
  expect((await handler(request)).status).toBe(403);
  expect(body).not.toHaveBeenCalled();
  expect(prisma.coachProfile.findUnique).not.toHaveBeenCalled();
  expect(prisma.student.findFirst).not.toHaveBeenCalled();
  expect(prisma.student.findUnique).not.toHaveBeenCalled();
  expect(prisma.userDocument.findMany).not.toHaveBeenCalled();
  expect(prisma.userDocument.create).not.toHaveBeenCalled();
  expect(prisma.sessionBooking.findUnique).not.toHaveBeenCalled();
  expect(prisma.sessionReport.findUnique).not.toHaveBeenCalled();
});
it.each(['CORE_V2', undefined])('refuses generic document resolution for an unqualified coach authority %s', async authority => {
  const result = await readAuthorizedDocument('doc', { id: 'same-id-in-both-stores', role: 'COACH', authority });
  expect(result.status).toBe('DENIED');
  expect(prisma.userDocument.findUnique).not.toHaveBeenCalled();
});
