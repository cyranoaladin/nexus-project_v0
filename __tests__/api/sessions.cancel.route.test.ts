import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/sessions/cancel/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { RateLimitPresets } from '@/lib/middleware/rateLimit';
import { parseBody } from '@/lib/api/helpers';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';
import { refundSessionBookingById, canCancelBooking } from '@/lib/credits';

jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/middleware/rateLimit', () => ({
  RateLimitPresets: {
    expensive: jest.fn(),
  },
}));

jest.mock('@/lib/api/helpers', () => ({
  parseBody: jest.fn(),
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
  prisma: {
    sessionBooking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockStudentSession = {
  user: {
    id: 'student-1',
    email: 'student@nexus.com',
    role: 'ELEVE' as const,
  },
};

function createMockRequest(url: string, options?: RequestInit): NextRequest {
  const request = new NextRequest(url, options as any);
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

function buildSession(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'session-1',
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

    (RateLimitPresets.expensive as jest.Mock).mockReturnValue(null);
    (requireAnyRole as jest.Mock).mockResolvedValue(mockStudentSession);
    (isErrorResponse as jest.Mock).mockReturnValue(false);
    (parseBody as jest.Mock).mockResolvedValue({ sessionId: 'session-1', reason: 'Change' });
    (createLogger as jest.Mock).mockReturnValue(mockLogger());
    (prisma.sessionBooking.findUnique as jest.Mock).mockResolvedValue(buildSession());
    (prisma.sessionBooking.update as jest.Mock).mockResolvedValue({});
    (canCancelBooking as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 429 when rate limited', async () => {
    (RateLimitPresets.expensive as jest.Mock).mockReturnValue(
      NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
    );

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));

    expect(response.status).toBe(429);
  });

  it('returns auth error response when guard fails', async () => {
    const mockErrorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAnyRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    (isErrorResponse as jest.Mock).mockReturnValue(true);

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
    expect(body.refunded).toBe(false);
    expect(refundSessionBookingById).not.toHaveBeenCalled();
  });

  it('refunds when policy allows refund', async () => {
    (canCancelBooking as jest.Mock).mockReturnValue(true);

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.refunded).toBe(true);
    expect(refundSessionBookingById).toHaveBeenCalledWith('session-1', 'Change');
  });

  it('assistant role overrides refund policy', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' as const },
    });
    (canCancelBooking as jest.Mock).mockReturnValue(false);

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/cancel'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.refunded).toBe(true);
    expect(refundSessionBookingById).toHaveBeenCalled();
  });
});
