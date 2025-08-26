import { POST as konnectWebhook } from '@/app/api/webhooks/konnect/route';

function hmacSha256Hex(secret: string, body: string) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

describe('Konnect webhook signature', () => {
  const secret = 'test_secret';
  const payload = { payment_id: 'pay_1', status: 'completed', amount: 100, currency: 'TND' };
  const raw = JSON.stringify(payload);

  it('rejects when signature missing', async () => {
    const req: any = {
      text: async () => raw,
      headers: new Map(),
      url: 'http://localhost/api/webhooks/konnect',
    };
    const res = await konnectWebhook(req as any);
    expect(res.status).toBe(401);
  });

  it('rejects when signature invalid', async () => {
    process.env.KONNECT_WEBHOOK_SECRET = secret;
    const req: any = {
      text: async () => raw,
      headers: new Map([['x-konnect-signature', 'invalid']]),
      url: 'http://localhost/api/webhooks/konnect',
    };
    const res = await konnectWebhook(req as any);
    expect(res.status).toBe(401);
  });

  it('accepts when signature valid', async () => {
    process.env.KONNECT_WEBHOOK_SECRET = secret;
    const sig = hmacSha256Hex(secret, raw);

    // Mock prisma before importing the handler
    jest.resetModules();
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        payment: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              id: 'pay_1',
              status: 'PENDING',
              type: 'SUBSCRIPTION',
              metadata: { studentId: 's1', itemKey: 'PLAN' },
              user: {},
            }),
          update: jest.fn().mockResolvedValue({}),
        },
        student: { findUnique: jest.fn().mockResolvedValue({ id: 's1' }) },
        subscription: {
          updateMany: jest.fn().mockResolvedValue({}),
          findFirst: jest.fn().mockResolvedValue({ creditsPerMonth: 0 }),
        },
        creditTransaction: { create: jest.fn().mockResolvedValue({}) },
      },
    }));
    const { POST } = require('@/app/api/webhooks/konnect/route');

    const req: any = {
      text: async () => raw,
      headers: new Map([['x-konnect-signature', sig]]),
      url: 'http://localhost/api/webhooks/konnect',
      json: async () => payload,
    };

    const res = await POST(req as any);
    expect([200, 201]).toContain(res.status);
  });
});
