jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

import { POST } from '@/app/api/auth/resend-activation/route';
import { sendMail } from '@/lib/email/mailer';
import { NextRequest } from 'next/server';

const mockSendMail = sendMail as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
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
