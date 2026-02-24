/**
 * Coach Sessions Report API — Complete Test Suite
 *
 * Tests: GET & POST /api/coach/sessions/[sessionId]/report
 *
 * Source: app/api/coach/sessions/[sessionId]/report/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/validation/session-report', () => ({
  reportSubmissionSchema: {
    safeParse: jest.fn(),
  },
}));

import { GET, POST } from '@/app/api/coach/sessions/[sessionId]/report/route';
import { auth } from '@/auth';
import { reportSubmissionSchema } from '@/lib/validation/session-report';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const mockSafeParse = (reportSubmissionSchema as any).safeParse as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

function makePostRequest(sessionId: string, body: Record<string, unknown>): [NextRequest, { params: Promise<{ sessionId: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/coach/sessions/${sessionId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return [req, makeParams(sessionId)];
}

function makeGetRequest(sessionId: string): [NextRequest, { params: Promise<{ sessionId: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/coach/sessions/${sessionId}/report`, { method: 'GET' });
  return [req, makeParams(sessionId)];
}

// ─── POST ────────────────────────────────────────────────────────────────────

describe('POST /api/coach/sessions/[sessionId]/report', () => {
  const validReport = {
    summary: 'Good session',
    topicsCovered: ['Algebra'],
    performanceRating: 4,
    progressNotes: 'Improving',
    recommendations: 'Practice more',
    attendance: true,
  };

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(...makePostRequest('s1', validReport));
    expect(res.status).toBe(401);
  });

  it('should return 401 for non-COACH role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } } as any);

    const res = await POST(...makePostRequest('s1', validReport));
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid input', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } } as any);
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'Required' }] } });

    const res = await POST(...makePostRequest('s1', {}));
    expect(res.status).toBe(400);
  });

  it('should return 404 when session not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } } as any);
    mockSafeParse.mockReturnValue({ success: true, data: validReport });
    prisma.sessionBooking.findFirst.mockResolvedValue(null);

    const res = await POST(...makePostRequest('nonexistent', validReport));
    expect(res.status).toBe(404);
  });

  it('should return 403 when coach does not own session', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } } as any);
    mockSafeParse.mockReturnValue({ success: true, data: validReport });
    prisma.sessionBooking.findFirst.mockResolvedValue({
      id: 's1', coachId: 'other-coach', status: 'CONFIRMED',
      student: {}, coach: {}, parent: {},
    });

    const res = await POST(...makePostRequest('s1', validReport));
    expect(res.status).toBe(403);
  });

  it('should return 400 for invalid session status', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } } as any);
    mockSafeParse.mockReturnValue({ success: true, data: validReport });
    prisma.sessionBooking.findFirst.mockResolvedValue({
      id: 's1', coachId: 'c1', status: 'COMPLETED',
      student: {}, coach: {}, parent: {},
    });

    const res = await POST(...makePostRequest('s1', validReport));
    expect(res.status).toBe(400);
  });

  it('should return 409 when report already exists', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } } as any);
    mockSafeParse.mockReturnValue({ success: true, data: validReport });
    prisma.sessionBooking.findFirst.mockResolvedValue({
      id: 's1', coachId: 'c1', status: 'CONFIRMED',
      student: {}, coach: {}, parent: {},
    });
    prisma.sessionReport.findUnique.mockResolvedValue({ id: 'r1' });

    const res = await POST(...makePostRequest('s1', validReport));
    expect(res.status).toBe(409);
  });

  it('should create report successfully', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } } as any);
    mockSafeParse.mockReturnValue({ success: true, data: validReport });
    prisma.sessionBooking.findFirst.mockResolvedValue({
      id: 's1', coachId: 'c1', studentId: 'stu-u1', parentId: 'p1',
      status: 'CONFIRMED', subject: 'MATHS',
      scheduledDate: new Date('2026-03-01'),
      student: {}, coach: {}, parent: { email: 'p@test.com' },
    });
    prisma.sessionReport.findUnique.mockResolvedValue(null);
    prisma.coachProfile.findUnique.mockResolvedValue({ id: 'cp-1', userId: 'c1' });
    prisma.student.findFirst.mockResolvedValue({ id: 'stu-1' });
    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        sessionReport: { create: jest.fn().mockResolvedValue({ id: 'report-1' }) },
        sessionBooking: { update: jest.fn().mockResolvedValue({}) },
        sessionNotification: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const res = await POST(...makePostRequest('s1', validReport));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reportId).toBe('report-1');
  });

  it('should return 500 on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } } as any);
    mockSafeParse.mockReturnValue({ success: true, data: validReport });
    prisma.sessionBooking.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await POST(...makePostRequest('s1', validReport));
    expect(res.status).toBe(500);
  });
});

// ─── GET ─────────────────────────────────────────────────────────────────────

describe('GET /api/coach/sessions/[sessionId]/report', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET(...makeGetRequest('s1'));
    expect(res.status).toBe(401);
  });

  it('should return null report when none exists', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } } as any);
    prisma.sessionReport.findUnique.mockResolvedValue(null);

    const res = await GET(...makeGetRequest('s1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report).toBeNull();
  });

  it('should return 403 for unauthorized user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'other', role: 'ELEVE' } } as any);
    prisma.sessionReport.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.sessionBooking.findUnique.mockResolvedValue({
      id: 's1', coachId: 'c1', studentId: 'stu-1', parentId: 'p1',
    });

    const res = await GET(...makeGetRequest('s1'));
    expect(res.status).toBe(403);
  });

  it('should return report for authorized coach', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } } as any);
    prisma.sessionReport.findUnique.mockResolvedValue({
      id: 'r1', summary: 'Good session',
    });
    prisma.sessionBooking.findUnique.mockResolvedValue({
      id: 's1', coachId: 'c1', studentId: 'stu-1', parentId: 'p1',
    });

    const res = await GET(...makeGetRequest('s1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report.summary).toBe('Good session');
  });

  it('should return report for ADMIN', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as any);
    prisma.sessionReport.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.sessionBooking.findUnique.mockResolvedValue({
      id: 's1', coachId: 'c1', studentId: 'stu-1', parentId: 'p1',
    });

    const res = await GET(...makeGetRequest('s1'));
    expect(res.status).toBe(200);
  });
});
