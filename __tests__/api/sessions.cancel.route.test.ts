import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/sessions/cancel/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { parseBody, safeJsonParse } from '@/lib/api/helpers';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';
import { refundSessionBookingById, canCancelBooking } from '@/lib/credits';

jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn(),
}));

jest.mock('@/lib/api/helpers', () => ({
  parseBody: jest.fn(),
  safeJsonParse: jest.fn(),
  assertExists: jest.requireActual('@/lib/api/helpers').assertExists,
}));

jest.mock('@/lib/middleware/logger', () => ({
  createLogger: jest.fn(),
}));

jest.mock('@/lib/credits', () => ({
  refundSessionBookingById: jest.fn(),
  canCancelBooking: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: (() => { const database = {
    sessionBooking: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    sessionBookingCancellationAudit: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
  }; return { ...database, $transaction: jest.fn((operation: (tx: typeof database) => Promise<unknown>) => operation(database)) }; })(),
}));

const mockStudentSession = {
  user: {
    id: 'student-1',
    email: 'student@example.test',
    role: 'ELEVE' as const,
  },
};

const VALID_SESSION_ID = 'clh1234567890abcdefghij';

function createMockRequest(url: string, options?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  const request = new NextRequest(url, options);
  Object.defineProperty(request, 'nextUrl', {
    value: new URL(url),
    writable: false,
    configurable: true,
  });
  return request;
}

function mockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    logRequest: jest.fn(),
  };
}

let activeLogger: ReturnType<typeof mockLogger>;

function buildSession(overrides: Partial<{ studentId: string; coachId: string; status: string; planningSeriesId: string; occurrenceKey: string }> = {}) {
  return {
    id: VALID_SESSION_ID,
    studentId: 'student-1',
    coachId: 'coach-1',
    status: 'SCHEDULED',
    scheduledDate: new Date('2025-01-02T00:00:00.000Z'),
    startTime: '12:00',
    type: 'INDIVIDUAL',
    modality: 'ONLINE',
    ...overrides,
  };
}

describe('POST /api/sessions/cancel', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T10:00:00.000Z'));
    jest.clearAllMocks();

    (guardSensitiveRateLimit as jest.Mock).mockReturnValue(null);
    (requireAnyRole as jest.Mock).mockResolvedValue(mockStudentSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    (parseBody as jest.Mock).mockResolvedValue({ sessionId: VALID_SESSION_ID, reason: 'Change' });
    (safeJsonParse as jest.Mock).mockResolvedValue({ sessionId: VALID_SESSION_ID, reason: 'Change' });
    activeLogger = mockLogger();
    (createLogger as jest.Mock).mockReturnValue(activeLogger);
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue(buildSession());
    (prisma.sessionBooking.update as jest.Mock).mockResolvedValue({});
    (prisma.sessionBooking.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (canCancelBooking as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(['completed', 'reassigned'])('refuses cancellation when the session was %s after its read', async () => {
    (prisma.sessionBooking.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    expect(response.status).toBe(409);
    expect(prisma.sessionBooking.update).not.toHaveBeenCalled();
  });

  it.each(['NO_SHOW', 'RESCHEDULED'])('preserves the historical %s state instead of cancelling it', async status => {
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue(buildSession({ status }));
    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    expect(response.status).toBe(400);
    expect(prisma.sessionBooking.updateMany).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    (guardSensitiveRateLimit as jest.Mock).mockReturnValue(
      NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
    );

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));

    expect(response.status).toBe(429);
  });

  it('returns auth error response when guard fails', async () => {
    const mockErrorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAnyRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));

    expect(response.status).toBe(401);
  });

  it('returns 404 when session is missing', async () => {
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
  });

  it('blocks students from cancelling others sessions', async () => {
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue(
      buildSession({ studentId: 'student-2' })
    );

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('FORBIDDEN');
    expect(activeLogger.error).not.toHaveBeenCalled();
    expect(activeLogger.logRequest).toHaveBeenCalledWith(403);
  });

  it('returns 400 when session already cancelled', async () => {
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue(
      buildSession({ status: 'CANCELLED' })
    );

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when session is completed', async () => {
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue(
      buildSession({ status: 'COMPLETED' })
    );

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('cancels without refund when policy disallows refund', async () => {
    (canCancelBooking as jest.Mock).mockReturnValue(false);

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty('refunded');
    expect(refundSessionBookingById).not.toHaveBeenCalled();
  });

  it('cancels without altering historical balances even within notice period', async () => {
    (canCancelBooking as jest.Mock).mockReturnValue(true);

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty('refunded');
    expect(refundSessionBookingById).not.toHaveBeenCalled();
  });

  it('assistant cancellation never issues credits', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' as const },
    });
    (canCancelBooking as jest.Mock).mockReturnValue(false);

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty('refunded');
    expect(refundSessionBookingById).not.toHaveBeenCalled();
  });

  // Tâche 11 : cette route cancel un unique SessionBooking par id, que cette
  // occurrence appartienne ou non à une PlanningSeries — l'annulation en
  // masse "future-only" d'une série entière vit exclusivement dans
  // DELETE /api/assistante/planning/series/[seriesId]. Ce test verrouille la
  // coexistence : une occurrence liée à une série s'annule exactement comme
  // une réservation historique (planningSeriesId: null), sans effet de bord
  // sur la série ni sur ses autres occurrences.
  it('cancels a single occurrence belonging to a PlanningSeries exactly like a standalone booking', async () => {
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue(
      buildSession({ planningSeriesId: 'series-1', occurrenceKey: 'series-1:2' }),
    );

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.sessionBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_SESSION_ID, status: 'SCHEDULED', studentId: 'student-1', coachId: 'coach-1' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
    // Aucune requête ne touche `planning_series` ni d'autres réservations :
    // seule cette occurrence, identifiée par son propre id, est modifiée.
    expect(body.error).toBeUndefined();
  });
});
