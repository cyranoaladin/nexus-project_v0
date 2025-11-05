import { POST } from '@/app/api/sessions/cancel/route';
import { prisma } from '@/lib/prisma';
import { refundSessionBookingById } from '@/lib/credits';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/credits', () => ({
  refundSessionBookingById: jest.fn(),
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const mockedFindUnique = prisma.sessionBooking.findUnique as jest.Mock;
const mockedUpdate = prisma.sessionBooking.update as jest.Mock;
const mockedRefund = refundSessionBookingById as jest.Mock;

const cancelledSessionFixture = {
  id: 'session-1',
  title: 'Cours Maths',
  subject: 'MATHEMATIQUES',
  scheduledDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
  startTime: '10:00',
  endTime: '11:00',
  duration: 60,
  status: 'CANCELLED',
  type: 'INDIVIDUAL',
  modality: 'ONLINE',
  creditsUsed: 1,
  studentId: 'student-1',
  coachId: 'coach-1',
  parentId: null,
  createdAt: new Date(),
  student: { id: 'student-1', firstName: 'Alice', lastName: 'Martin' },
  coach: { id: 'coach-1', firstName: 'Pierre', lastName: 'Dupont' },
  parent: null,
};

function buildRequest(payload: unknown) {
  return new NextRequest('http://localhost/api/sessions/cancel', {
    method: 'POST',
    body: JSON.stringify(payload),
  } as any);
}

describe('POST /api/sessions/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    mockedFindUnique.mockResolvedValue({
      id: 'session-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      type: 'INDIVIDUAL',
      modality: 'ONLINE',
      scheduledDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      startTime: '10:00',
    });
    mockedUpdate.mockResolvedValue(cancelledSessionFixture);
    mockedRefund.mockResolvedValue(undefined);
  });

  it('rejects empty sessionId', async () => {
    const req = buildRequest({ sessionId: '', reason: 'test' });
    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Validation failed');
    expect(mockedFindUnique).not.toHaveBeenCalled();
  });

  it('rejects reason longer than 500 characters', async () => {
    const req = buildRequest({ sessionId: 'session-1', reason: 'a'.repeat(501) });
    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Validation failed');
    expect(mockedFindUnique).not.toHaveBeenCalled();
  });

  it('cancels session with valid payload and assistant role', async () => {
    const req = buildRequest({ sessionId: 'session-1', reason: 'Conflit' });
    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.refunded).toBe(true);
    expect(payload.session.id).toBe('session-1');
    expect(payload.session.status).toBe('CANCELLED');
    expect(mockedFindUnique).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    const updateArgs = mockedUpdate.mock.calls[0][0];
    expect(updateArgs.data.coachNotes).toContain('Conflit');
    expect(updateArgs.include).toBeDefined();
    expect(mockedRefund).toHaveBeenCalledWith('session-1', 'Conflit');
  });
});
