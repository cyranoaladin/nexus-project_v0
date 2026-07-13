import { auth } from '@/auth';
jest.mock('@/lib/prisma', () => ({
  prisma: {
    stageReservation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/email', () => ({
  sendStageDiagnosticInvitation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimit: jest.fn().mockReturnValue(null),
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));

jest.mock('@/lib/telegram/client', () => ({
  telegramSendMessage: jest.fn(),
}));

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { POST } from '@/app/api/reservation/route';
import { prisma } from '@/lib/prisma';
import { telegramSendMessage } from '@/lib/telegram/client';

function makeRequest(body?: any) {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
    url: 'http://localhost:3000/api/reservation',
    nextUrl: { searchParams: new URLSearchParams() },
  } as any;
}

const validBody = {
  parent: 'Jean Dupont',
  email: 'jean@test.com',
  phone: '+216 99 19 28 29',
  classe: 'Terminale',
  academyId: 'academy-1',
  academyTitle: 'Académie Maths Février',
  price: 150,
};

describe('POST /api/reservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
    // No existing reservation by default
    (prisma.stageReservation.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.stageReservation.create as jest.Mock).mockResolvedValue({ id: 'res-1' });
    (telegramSendMessage as jest.Mock).mockResolvedValue({
      ok: true,
      skipped: true,
      status: 'disabled',
    });
  });

  it('returns 400 when missing fields', async () => {
    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 201 when creating new reservation (telegram not configured)', async () => {
    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(prisma.stageReservation.create).toHaveBeenCalledTimes(1);
    expect(telegramSendMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps the reservation when the secondary Telegram notification fails', async () => {
    (telegramSendMessage as jest.Mock).mockResolvedValue({
      ok: false,
      status: 'failed',
      error: 'request_failed',
    });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(201);
    expect(prisma.stageReservation.create).toHaveBeenCalledTimes(1);
  });
});
