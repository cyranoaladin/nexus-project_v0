import { NextResponse } from 'next/server';
import { GET } from '@/app/api/student/sessions/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { RateLimitPresets } from '@/lib/middleware/rateLimit';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/middleware/rateLimit', () => ({
  RateLimitPresets: {
    api: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/logger', () => ({
  createLogger: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: { findMany: jest.fn() },
  },
}));

function makeRequest() {
  return {} as any;
}

const mockSession = {
  user: { id: 'student-1', role: 'ELEVE' },
};

function mockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    logRequest: jest.fn(),
  };
}

describe('GET /api/student/sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RateLimitPresets.api as jest.Mock).mockReturnValue(null);
    (requireRole as jest.Mock).mockResolvedValue(mockSession);
    (isErrorResponse as jest.Mock).mockReturnValue(false);
    (createLogger as jest.Mock).mockReturnValue(mockLogger());
  });

  it('returns 429 when rate limited', async () => {
    (RateLimitPresets.api as jest.Mock).mockReturnValue(
      NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(429);
  });

  it('returns auth error response when guard fails', async () => {
    const mockErrorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    (requireRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    (isErrorResponse as jest.Mock).mockReturnValue(true);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
  });

  it('returns formatted sessions', async () => {
    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([
      {
        id: 's1',
        title: 'Math',
        subject: 'MATHEMATIQUES',
        status: 'SCHEDULED',
        scheduledDate: new Date('2025-01-01'),
        startTime: '10:00',
        duration: 60,
        creditsUsed: 2,
        modality: 'ONLINE',
        type: 'INDIVIDUAL',
        coach: { id: 'c1', firstName: 'Coach', lastName: 'One' },
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].coach.firstName).toBe('Coach');
  });
});
