jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

import { POST } from '@/app/api/auth/resend-activation/route';
import { sendMail } from '@/lib/email/mailer';
import { NextRequest } from 'next/server';
import { _resetStoreForTests } from '@/lib/rate-limit';

const mockSendMail = sendMail as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  _resetStoreForTests();
  delete process.env.NEXTAUTH_URL;
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/resend-activation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/resend-activation', () => {
  it('returns 400 for invalid email', async () => {
    const res = await POST(makeRequest({ email: 'bad-email' }));

    expect(res.status).toBe(400);
  });

  it('returns success for unknown email without sending mail', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ email: 'unknown@example.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('returns success for already activated account without sending mail', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'active@example.com',
      activatedAt: new Date(),
      firstName: 'Active',
    });

    const res = await POST(makeRequest({ email: 'active@example.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('stores a new activation token and sends email for inactive student', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'inactive@example.com',
      firstName: 'Ines',
      activatedAt: null,
      role: 'ELEVE',
    });
    prisma.user.update.mockResolvedValue({});

    const res = await POST(makeRequest({ email: 'inactive@example.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-2' },
        data: expect.objectContaining({
          activationToken: expect.any(String),
          activationExpiry: expect.any(Date),
        }),
      })
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'inactive@example.com',
        subject: expect.stringContaining('Activation'),
        html: expect.stringContaining('/auth/activate?token='),
      })
    );
  });

  it('silently throttles repeated requests within 15 minutes', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-3',
      email: 'throttle@example.com',
      firstName: 'Theo',
      activatedAt: null,
      role: 'ELEVE',
    });
    prisma.user.update.mockResolvedValue({});

    const first = await POST(makeRequest({ email: 'throttle@example.com' }));
    const second = await POST(makeRequest({ email: 'throttle@example.com' }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });
});

// ── Rate Limiting (resendActivation preset: 3 req/15min) ─────────────────

function makeRequestWithIp(email: string, ip: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/resend-activation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email }),
  });
}

describe('POST /api/auth/resend-activation — rate limiting', () => {
  beforeEach(() => {
    _resetStoreForTests();
  });

  it('allows the first 3 requests then blocks the 4th with 429', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    for (let i = 0; i < 3; i++) {
      const resp = await POST(makeRequestWithIp(`test${i}@example.com`, '10.10.10.1'));
      expect(resp.status).toBe(200);
    }

    const blocked = await POST(makeRequestWithIp('test4@example.com', '10.10.10.1'));
    expect(blocked.status).toBe(429);
  });

  it('includes Retry-After header on 429', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    for (let i = 0; i < 3; i++) {
      await POST(makeRequestWithIp(`r${i}@example.com`, '10.10.10.2'));
    }

    const resp = await POST(makeRequestWithIp('r3@example.com', '10.10.10.2'));
    expect(resp.status).toBe(429);
    const retryAfter = parseInt(resp.headers.get('Retry-After') || '0', 10);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(900);
  });

  it('never reveals whether the email exists (200 for allowed, 429 for blocked)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const resp = await POST(makeRequestWithIp('unknown@example.com', '10.10.10.3'));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Si ce compte existe');
  });

  it('different IPs have separate rate limits', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    // Exhaust IP A
    for (let i = 0; i < 3; i++) {
      await POST(makeRequestWithIp(`a${i}@example.com`, '10.10.10.4'));
    }
    expect((await POST(makeRequestWithIp('a3@example.com', '10.10.10.4'))).status).toBe(429);

    // IP B should still work
    expect((await POST(makeRequestWithIp('b0@example.com', '10.10.10.5'))).status).toBe(200);
  });
});
