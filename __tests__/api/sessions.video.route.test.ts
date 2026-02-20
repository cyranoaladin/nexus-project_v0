import { POST } from '@/app/api/sessions/video/route';
import { prisma } from '@/lib/prisma';
import { SessionStatus } from '@prisma/client';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const baseSession = {
  user: {
    id: 'student-1',
    role: 'ELEVE',
  },
};

function makeRequest(body: any) {
  return {
    json: async () => body,
  } as Request;
}

function buildBooking(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'session-1',
    studentId: 'student-1',
    coachId: 'coach-1',
    parentId: 'parent-1',
    student: { firstName: 'Student', lastName: 'One' },
    coach: { firstName: 'Coach', lastName: 'One' },
    parent: { firstName: 'Parent', lastName: 'One' },
    scheduledDate: new Date(Date.UTC(2025, 0, 2, 12, 0, 0)),
    startTime: '10:00',
    duration: 60,
    status: SessionStatus.SCHEDULED,
    subject: 'MATHEMATIQUES',
    ...overrides,
  };
}

describe('POST /api/sessions/video', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 0, 2, 10, 0, 0));
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue(baseSession);
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(buildBooking());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ sessionId: 'session-1', action: 'JOIN' }) as any);

    expect(response.status).toBe(401);
  });

  it('returns 400 when missing params', async () => {
    const response = await POST(makeRequest({ sessionId: '', action: '' }) as any);

    expect(response.status).toBe(400);
  });

  it('returns 404 when session not found', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ sessionId: 'missing', action: 'JOIN' }) as any);

    expect(response.status).toBe(404);
  });

  it('blocks join when too early', async () => {
    jest.setSystemTime(new Date(2025, 0, 2, 9, 40, 0));

    const response = await POST(makeRequest({ sessionId: 'session-1', action: 'JOIN' }) as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('pas encore disponible');
  });

  it('joins session and marks in progress when scheduled', async () => {
    (prisma.sessionBooking.update as jest.Mock).mockResolvedValue({});

    const response = await POST(makeRequest({ sessionId: 'session-1', action: 'JOIN' }) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sessionData.roomName).toContain('nexus-reussite-session-session-1');
    expect(body.sessionData.isHost).toBe(false);
    expect(prisma.sessionBooking.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: SessionStatus.IN_PROGRESS },
    });
  });

  it('marks coach as host when joining', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: {
        id: 'coach-1',
        role: 'COACH',
      },
    });

    const response = await POST(makeRequest({ sessionId: 'session-1', action: 'JOIN' }) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sessionData.isHost).toBe(true);
  });

  it('joins session without update when already in progress', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(
      buildBooking({ status: SessionStatus.IN_PROGRESS })
    );

    const response = await POST(makeRequest({ sessionId: 'session-1', action: 'JOIN' }) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.sessionBooking.update).not.toHaveBeenCalled();
  });

  it('leaves session and marks completed', async () => {
    const response = await POST(makeRequest({ sessionId: 'session-1', action: 'LEAVE' }) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.sessionBooking.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: SessionStatus.COMPLETED, completedAt: expect.any(Date) },
    });
  });

  it('returns 400 for unsupported action', async () => {
    const response = await POST(makeRequest({ sessionId: 'session-1', action: 'PING' }) as any);

    expect(response.status).toBe(400);
  });
});
