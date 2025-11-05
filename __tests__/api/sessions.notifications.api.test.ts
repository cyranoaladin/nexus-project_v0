import { GET } from '@/app/api/sessions/notifications/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionNotification: {
      findMany: jest.fn(),
    },
  },
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const mockedFindMany = prisma.sessionNotification.findMany as jest.Mock;

const notificationFixture = {
  id: 'notif-1',
  type: 'REMINDER',
  title: 'Rappel de session',
  message: 'Votre session commence bientôt',
  status: 'SENT',
  method: 'EMAIL',
  createdAt: new Date('2025-10-30T09:00:00Z'),
  sentAt: new Date('2025-10-30T09:05:00Z'),
  readAt: null,
  user: {
    id: 'parent-1',
    firstName: 'Alice',
    lastName: 'Martin',
    role: 'PARENT',
  },
  session: {
    id: 'session-1',
    title: 'Cours de mathématiques',
    subject: 'MATHEMATIQUES',
    scheduledDate: new Date('2025-11-01T00:00:00Z'),
    startTime: '10:00',
    endTime: '11:00',
    duration: 60,
    status: 'CONFIRMED',
    type: 'INDIVIDUAL',
    modality: 'ONLINE',
    creditsUsed: 2,
    studentId: 'student-1',
    coachId: 'coach-1',
    parentId: 'parent-1',
    student: {
      id: 'student-1',
      firstName: 'Lea',
      lastName: 'Durand',
    },
    coach: {
      id: 'coach-1',
      firstName: 'Marc',
      lastName: 'Dupuis',
    },
    parent: {
      id: 'parent-1',
      firstName: 'Alice',
      lastName: 'Martin',
    },
    createdAt: new Date('2025-10-20T12:00:00Z'),
  },
};

describe('GET /api/sessions/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
    mockedFindMany.mockResolvedValue([notificationFixture]);
  });

  it('returns normalized notifications for authenticated user', async () => {
    const req = new NextRequest('http://localhost/api/sessions/notifications?status=SENT&limit=5');
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(payload.notifications)).toBe(true);
    expect(payload.notifications[0]).toMatchObject({
      id: 'notif-1',
      status: 'SENT',
      user: {
        id: 'parent-1',
        firstName: 'Alice',
        lastName: 'Martin',
        role: 'PARENT',
      },
      session: {
        id: 'session-1',
        title: 'Cours de mathématiques',
        student: {
          id: 'student-1',
        },
        coach: {
          id: 'coach-1',
        },
      },
    });

    const callArgs = mockedFindMany.mock.calls[0][0];
    expect(callArgs.take).toBe(5);
    expect(callArgs.include).toBeDefined();
  });

  it('rejects invalid query parameters', async () => {
    const req = new NextRequest('http://localhost/api/sessions/notifications?status=UNKNOWN');
    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Invalid query parameters');
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it('returns 401 when session is missing', async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/sessions/notifications');
    const res = await GET(req as any);

    expect(res.status).toBe(401);
    expect(mockedFindMany).not.toHaveBeenCalled();
  });
});
