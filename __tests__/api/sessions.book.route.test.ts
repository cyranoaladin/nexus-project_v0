import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/sessions/book/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { RateLimitPresets } from '@/lib/middleware/rateLimit';
import { parseBody } from '@/lib/api/helpers';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';

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
}));

jest.mock('@/lib/middleware/logger', () => ({
  createLogger: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

const mockSession = {
  user: {
    id: 'user-1',
    email: 'student@nexus.com',
    role: 'ELEVE' as const,
    firstName: 'Student',
    lastName: 'User',
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

function buildPayload(overrides: Partial<Record<string, any>> = {}) {
  return {
    coachId: 'coach-1',
    studentId: 'student-1',
    subject: 'MATHEMATIQUES',
    scheduledDate: '2025-01-06',
    startTime: '10:00',
    endTime: '11:00',
    duration: 60,
    type: 'INDIVIDUAL',
    modality: 'ONLINE',
    title: 'Algebra',
    description: 'Intro session',
    creditsToUse: 2,
    ...overrides,
  };
}

function mockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    logRequest: jest.fn(),
  };
}

function makeTransactionMocks(overrides: Partial<Record<string, any>> = {}) {
  return {
    coachProfile: {
      findFirst: jest.fn().mockResolvedValue({
        user: { id: 'coach-1', firstName: 'Coach', lastName: 'One', role: 'COACH' },
      }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'student-1',
        firstName: 'Student',
        lastName: 'User',
        role: 'ELEVE',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    parentProfile: {
      findFirst: jest.fn(),
    },
    student: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'student-record-1',
        userId: 'student-1',
      }),
    },
    coachAvailability: {
      findFirst: jest.fn().mockResolvedValue({ id: 'availability-1' }),
    },
    sessionBooking: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'session-1',
        studentId: 'student-1',
        coachId: 'coach-1',
        parentId: null,
        student: {},
        coach: {},
        parent: null,
      }),
    },
    creditTransaction: {
      findMany: jest.fn().mockResolvedValue([{ amount: 5 }]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    sessionNotification: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    sessionReminder: {
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    ...overrides,
  };
}

describe('POST /api/sessions/book', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 0, 1, 12, 0, 0));
    jest.clearAllMocks();

    (RateLimitPresets.expensive as jest.Mock).mockReturnValue(null);
    (requireAnyRole as jest.Mock).mockResolvedValue(mockSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    (parseBody as jest.Mock).mockResolvedValue(buildPayload());
    (createLogger as jest.Mock).mockReturnValue(mockLogger());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 429 when rate limited', async () => {
    (RateLimitPresets.expensive as jest.Mock).mockReturnValue(
      NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
    );

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));

    expect(response.status).toBe(429);
  });

  it('returns auth error response when guard fails', async () => {
    const mockErrorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAnyRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));

    expect(response.status).toBe(401);
  });

  it('rejects bookings more than 3 months in advance', async () => {
    (parseBody as jest.Mock).mockResolvedValue(buildPayload({ scheduledDate: '2025-05-02' }));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects weekend bookings', async () => {
    (parseBody as jest.Mock).mockResolvedValue(buildPayload({ scheduledDate: '2025-01-04' }));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects bookings outside business hours', async () => {
    (parseBody as jest.Mock).mockResolvedValue(buildPayload({ startTime: '07:00', endTime: '08:00' }));

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 409 for overlapping session exclusion constraint', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: '23P01' });

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('CONFLICT');
  });

  it('returns 409 for unique constraint on duplicate booking', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2002' });

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('CONFLICT');
  });

  it('returns 409 for serialization conflicts', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2034' });

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('CONFLICT');
  });

  it('creates booking and side effects on success', async () => {
    const tx = makeTransactionMocks();

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
      return callback(tx);
    });

    const response = await POST(createMockRequest('http://localhost:3000/api/sessions/book'));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.sessionId).toBe('session-1');

    expect(tx.sessionBooking.create).toHaveBeenCalled();
    expect(tx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: -2,
          sessionId: 'session-1',
        }),
      })
    );
    expect(tx.sessionNotification.createMany).toHaveBeenCalled();
    expect(tx.sessionReminder.createMany).toHaveBeenCalled();
  });
});
