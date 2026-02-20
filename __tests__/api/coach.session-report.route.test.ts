import { auth } from '@/auth';
import { GET, POST } from '@/app/api/coach/sessions/[sessionId]/report/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    sessionReport: { findUnique: jest.fn(), create: jest.fn() },
    coachProfile: { findUnique: jest.fn() },
    student: { findFirst: jest.fn() },
    sessionNotification: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/email-service', () => ({
  sendSessionReportNotification: jest.fn().mockResolvedValue(undefined),
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

const validReport = {
  summary: 'This is a detailed session summary.',
  topicsCovered: 'Algebra and equations',
  performanceRating: 4,
  progressNotes: 'Good progress on key concepts.',
  recommendations: 'Keep practicing daily.',
  attendance: true,
};

describe('coach session report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).setImmediate = (cb: any) => cb();
  });

  it('POST returns 401 when not coach', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest(validReport), { params: Promise.resolve({ sessionId: 's1' }) });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('POST returns 400 on invalid input', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });

    const response = await POST(makeRequest({}), { params: Promise.resolve({ sessionId: 's1' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('POST returns 403 when not session coach', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({
      id: 's1',
      coachId: 'coach-2',
      status: 'CONFIRMED',
    });

    const response = await POST(makeRequest(validReport), { params: Promise.resolve({ sessionId: 's1' }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain('Forbidden');
  });

  it('POST creates report for valid session', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({
      id: 's1',
      coachId: 'coach-1',
      status: 'CONFIRMED',
      subject: 'MATHEMATIQUES',
      scheduledDate: new Date('2025-01-01'),
      student: {},
      coach: {},
      parent: { email: 'p@test.com' },
      parentId: 'parent-1',
      studentId: 'student-1',
    });
    (prisma.sessionReport.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-entity-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        sessionReport: { create: jest.fn().mockResolvedValue({ id: 'report-1' }) },
        sessionBooking: { update: jest.fn().mockResolvedValue({}) },
        sessionNotification: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    const response = await POST(makeRequest(validReport), { params: Promise.resolve({ sessionId: 's1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reportId).toBe('report-1');
  });

  it('GET returns report when authorized', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.sessionReport.findUnique as jest.Mock).mockResolvedValue({ id: 'report-1' });
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      coachId: 'coach-1',
      studentId: 'student-1',
      parentId: 'parent-1',
    });

    const response = await GET(makeRequest(), { params: Promise.resolve({ sessionId: 's1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.report.id).toBe('report-1');
  });
});
