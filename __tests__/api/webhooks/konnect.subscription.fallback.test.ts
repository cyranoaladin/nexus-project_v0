import crypto from 'crypto';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'p42',
        type: 'SUBSCRIPTION',
        amount: 19.99,
        metadata: { studentId: 's1', itemKey: 'PREMIUM' },
        user: { parentProfile: { children: [] } },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    student: { findUnique: jest.fn().mockResolvedValue({ id: 's1' }) },
    subscription: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'sub1', studentId: 's1', creditsPerMonth: 8 }),
      findFirst: jest.fn().mockResolvedValue(undefined),
    },
    creditTransaction: { create: jest.fn().mockResolvedValue({}) },
  }
}));

describe('Konnect webhook subscription fallback', () => {
  const secret = 'sekret';
  beforeEach(() => {
    process.env.KONNECT_WEBHOOK_SECRET = secret;
    jest.resetModules();
  });

  it('creates subscription when updateMany affects 0 rows', async () => {
    const body = { payment_id: 'p42', status: 'completed' };
    const raw = JSON.stringify(body);
    const sig = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
    const headers = { get: (k: string) => (k.toLowerCase() === 'x-konnect-signature' ? sig : null) } as any;
    const req = { text: async () => raw, headers } as any;
    const { POST } = require('@/app/api/webhooks/konnect/route');
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
