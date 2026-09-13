import { auth } from '@/auth';
import { GET, POST } from '@/app/api/sessions/[sessionId]/route';
import { prisma } from '@/lib/prisma';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { SessionStatus } from '@prisma/client';
import { resolveJitsiRoomNameForSession } from '@/lib/jitsi-server';

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

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));

const baseSession = {
  user: { id: 'student-1', role: 'ELEVE' },
};

function makeRequest(): Request {
  return { headers: new Headers() } as unknown as Request;
}

function params(sessionId = 'session-1') {
  return { params: Promise.resolve({ sessionId }) };
}

// Tunis wall-clock 10:00 == UTC 09:00 (fixed UTC+1, no DST).
const SCHEDULED_DATE = new Date(Date.UTC(2025, 0, 2, 0, 0, 0));
const START_TIME = '10:00';
const SESSION_START_UTC = new Date(Date.UTC(2025, 0, 2, 9, 0, 0));

function buildBooking(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'session-1',
    studentId: 'student-1',
    coachId: 'coach-1',
    parentId: 'parent-1',
    student: { firstName: 'Student', lastName: 'One' },
    coach: { firstName: 'Coach', lastName: 'One' },
    scheduledDate: SCHEDULED_DATE,
    startTime: START_TIME,
    duration: 60,
    status: SessionStatus.SCHEDULED,
    subject: 'MATHEMATIQUES',
    ...overrides,
  };
}

describe.each([
  ['GET', GET],
  ['POST', POST],
] as const)('%s /api/sessions/[sessionId] — shared eligibility checks', (_label, handler) => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(SESSION_START_UTC);
    (auth as jest.Mock).mockResolvedValue(baseSession);
    (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null);
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(buildBooking());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await handler(makeRequest() as any, params());

    expect(response.status).toBe(401);
  });

  it('returns 429 before querying the booking when rate limited', async () => {
    (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: 'RATE_LIMIT' }), { status: 429 })
    );

    const response = await handler(makeRequest() as any, params());

    expect(response.status).toBe(429);
    expect(prisma.sessionBooking.findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when the booking is not found or not owned by this user', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await handler(makeRequest() as any, params('missing'));

    expect(response.status).toBe(404);
  });

  it('scopes the booking lookup server-side to the authenticated student/coach/parent — never a client-supplied id', async () => {
    await handler(makeRequest() as any, params());

    expect(prisma.sessionBooking.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'session-1',
        OR: [
          { studentId: 'student-1' },
          { coachId: 'student-1' },
          { parentId: 'student-1' },
        ],
      },
    }));
  });

  it('rejects a CANCELLED booking regardless of the time window', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(
      buildBooking({ status: SessionStatus.CANCELLED })
    );

    const response = await handler(makeRequest() as any, params());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain('annulée');
    expect(prisma.sessionBooking.update).not.toHaveBeenCalled();
  });

  it('rejects an already-COMPLETED booking regardless of the time window', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(
      buildBooking({ status: SessionStatus.COMPLETED })
    );

    const response = await handler(makeRequest() as any, params());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain('déjà terminée');
  });

  it('blocks join more than 15 minutes before the real Tunis (UTC+1) start time', async () => {
    jest.setSystemTime(new Date(SESSION_START_UTC.getTime() - 20 * 60 * 1000));

    const response = await handler(makeRequest() as any, params());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('pas encore disponible');
  });

  it('allows join exactly at the 15-minute-early boundary', async () => {
    jest.setSystemTime(new Date(SESSION_START_UTC.getTime() - 15 * 60 * 1000));

    const response = await handler(makeRequest() as any, params());

    expect(response.status).toBe(200);
  });

  it('allows join up to 30 minutes after the scheduled end (duration 60min)', async () => {
    jest.setSystemTime(new Date(SESSION_START_UTC.getTime() + 90 * 60 * 1000));

    const response = await handler(makeRequest() as any, params());

    expect(response.status).toBe(200);
  });

  it('rejects join more than 30 minutes after the scheduled end — there was previously NO upper bound at all', async () => {
    jest.setSystemTime(new Date(SESSION_START_UTC.getTime() + 91 * 60 * 1000));

    const response = await handler(makeRequest() as any, params());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain('expiré');
  });

  it('returns a room name that is deterministic — the same sessionId always yields the same room', async () => {
    const response1 = await handler(makeRequest() as any, params());
    const body1 = await response1.json();
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(buildBooking());
    const response2 = await handler(makeRequest() as any, params());
    const body2 = await response2.json();

    expect(body1.roomName).toBe(body2.roomName);
    expect(body1.roomName).toBe(resolveJitsiRoomNameForSession('session-1'));
  });

  it('the coach and the student get the exact same room name for the same booking (the bug this replaces)', async () => {
    const studentResponse = await handler(makeRequest() as any, params());
    const studentBody = await studentResponse.json();

    (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(buildBooking());
    const coachResponse = await handler(makeRequest() as any, params());
    const coachBody = await coachResponse.json();

    expect(coachBody.roomName).toBe(studentBody.roomName);
  });

  it('a room name for a different sessionId is different', async () => {
    const response1 = await handler(makeRequest() as any, params('session-1'));
    const body1 = await response1.json();

    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(
      buildBooking({ id: 'session-2' })
    );
    const response2 = await handler(makeRequest() as any, params('session-2'));
    const body2 = await response2.json();

    expect(body1.roomName).not.toBe(body2.roomName);
  });
});

describe('GET /api/sessions/[sessionId] — read-only, never mutates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(SESSION_START_UTC);
    (auth as jest.Mock).mockResolvedValue(baseSession);
    (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('never transitions a SCHEDULED booking, and reports it as still SCHEDULED', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(buildBooking());

    const response = await GET(makeRequest() as any, params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.sessionBooking.update).not.toHaveBeenCalled();
    expect(body.status).toBe(SessionStatus.SCHEDULED);
  });

  it('reports an already-IN_PROGRESS booking as such, without writing', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(
      buildBooking({ status: SessionStatus.IN_PROGRESS })
    );

    const response = await GET(makeRequest() as any, params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.sessionBooking.update).not.toHaveBeenCalled();
    expect(body.status).toBe(SessionStatus.IN_PROGRESS);
  });
});

describe('POST /api/sessions/[sessionId] — explicit join, mutates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(SESSION_START_UTC);
    (auth as jest.Mock).mockResolvedValue(baseSession);
    (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks a SCHEDULED booking IN_PROGRESS on join', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(buildBooking());
    (prisma.sessionBooking.update as jest.Mock).mockResolvedValue({});

    const response = await POST(makeRequest() as any, params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.sessionBooking.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: SessionStatus.IN_PROGRESS },
    });
    expect(body.status).toBe(SessionStatus.IN_PROGRESS);
  });

  it('does not re-update an already-IN_PROGRESS booking', async () => {
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(
      buildBooking({ status: SessionStatus.IN_PROGRESS })
    );

    const response = await POST(makeRequest() as any, params());

    expect(response.status).toBe(200);
    expect(prisma.sessionBooking.update).not.toHaveBeenCalled();
  });
});
