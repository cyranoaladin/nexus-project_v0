import { POST } from '@/app/api/sessions/video/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const mockedFindFirst = prisma.sessionBooking.findFirst as jest.Mock;
const mockedUpdate = prisma.sessionBooking.update as jest.Mock;

function buildRequest(payload: unknown) {
  return new NextRequest('http://localhost/api/sessions/video', {
    method: 'POST',
    body: JSON.stringify(payload),
  } as any);
}

describe('POST /api/sessions/video', () => {
  let uuidSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'ELEVE' },
    });
    const now = new Date();
    const startTimeDate = new Date(now.getTime() - 5 * 60 * 1000);
    const startTime = startTimeDate.toISOString().substring(11, 16);
    mockedFindFirst.mockResolvedValue({
      id: 'session-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      parentId: null,
      status: 'SCHEDULED',
      subject: 'MATHEMATIQUES',
      scheduledDate: now,
      startTime,
      duration: 60,
      student: { firstName: 'Marie', lastName: 'Dupont' },
      coach: { firstName: 'Jean', lastName: 'Martin' },
      parent: null,
    });
    mockedUpdate.mockResolvedValue({ id: 'session-1' });
    uuidSpy = jest.spyOn(crypto, 'randomUUID').mockReturnValue('123e4567-e89b-12d3-a456-426614174000');
  });

  afterEach(() => {
    uuidSpy.mockRestore();
  });

  it('rejects unsupported action values', async () => {
    const req = buildRequest({ sessionId: 'session-1', action: 'INVALID' });
    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Validation failed');
    expect(mockedFindFirst).not.toHaveBeenCalled();
  });

  it('rejects missing sessionId', async () => {
    const req = buildRequest({ sessionId: '', action: 'JOIN' });
    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Validation failed');
    expect(mockedFindFirst).not.toHaveBeenCalled();
  });

  it('allows student to join session and marks it in progress', async () => {
    const req = buildRequest({ sessionId: 'session-1', action: 'JOIN' });
    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.sessionData.roomName).toContain('session-1');
    expect(payload.sessionData.jitsiUrl).toContain('123e4567-e89b-12d3-a456-426614174000');
    expect(mockedFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'session-1' }),
    }));
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    );
  });
});
