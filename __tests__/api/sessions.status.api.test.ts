import { PATCH } from '@/app/api/sessions/[id]/status/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      update: jest.fn(),
    },
  },
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const mockedUpdate = prisma.sessionBooking.update as jest.Mock;

const sessionFixture = {
  id: 's1',
  title: 'Cours Maths',
  subject: 'MATHEMATIQUES',
  scheduledDate: new Date('2025-10-20T00:00:00Z'),
  startTime: '14:00',
  endTime: '15:00',
  duration: 60,
  status: 'COMPLETED',
  type: 'INDIVIDUAL',
  modality: 'ONLINE',
  creditsUsed: 1,
  studentId: 'stu1',
  coachId: 'coach1',
  parentId: null,
  createdAt: new Date('2025-10-01T10:00:00Z'),
  student: { id: 'stu1', firstName: 'Marie', lastName: 'Dupont' },
  coach: { id: 'coach1', firstName: 'Pierre', lastName: 'Martin' },
  parent: null,
};

describe('PATCH /api/sessions/[id]/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    mockedUpdate.mockResolvedValue(sessionFixture);
  });

  it('updates session status when role is assistant', async () => {
    const req = new NextRequest('http://localhost/api/sessions/s1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED', notes: ' OK ' }),
    } as any);
    const res = await PATCH(req as any, { params: { id: 's1' } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.session.id).toBe('s1');
    expect(data.session.status).toBe('COMPLETED');
    expect(data.session.coach).toEqual({ id: 'coach1', firstName: 'Pierre', lastName: 'Martin' });
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
      }),
    );
    const updateArgs = mockedUpdate.mock.calls[0][0];
    expect(updateArgs.data.coachNotes).toBe('OK');
    expect(updateArgs.include).toBeDefined();
  });

  it('rejects invalid status values', async () => {
    const req = new NextRequest('http://localhost/api/sessions/s1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'UNKNOWN' }),
    } as any);
    const res = await PATCH(req as any, { params: { id: 's1' } });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Validation failed');
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('rejects notes longer than 1000 characters', async () => {
    const longNotes = 'a'.repeat(1001);
    const req = new NextRequest('http://localhost/api/sessions/s1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED', notes: longNotes }),
    } as any);
    const res = await PATCH(req as any, { params: { id: 's1' } });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Validation failed');
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});

