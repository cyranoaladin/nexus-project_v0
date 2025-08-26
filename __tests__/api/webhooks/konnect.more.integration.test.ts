import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

describe('API /api/webhooks/konnect additional branches', () => {
  const SECRET = 'testsecret';
  const originalEnv = process.env.KONNECT_WEBHOOK_SECRET;

  beforeAll(() => {
    process.env.KONNECT_WEBHOOK_SECRET = SECRET as any;
  });
  afterAll(() => {
    process.env.KONNECT_WEBHOOK_SECRET = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).payment = (prisma as any).payment || {};
    (prisma as any).student = (prisma as any).student || {};
    (prisma as any).subscription = (prisma as any).subscription || {};
    (prisma as any).creditTransaction = (prisma as any).creditTransaction || {};
  });

  function signedRequest(body: any, signature?: string) {
    const raw = JSON.stringify(body);
    const sig = signature ?? crypto.createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex');
    // Minimal mock of NextRequest that the handler expects: text(), headers.get(), url
    return {
      text: async () => raw,
      headers: new Map([['x-konnect-signature', sig]]),
      url: 'http://localhost/api/webhooks/konnect',
    } as any;
  }

  it('401 when signature missing or invalid', async () => {
    const { POST } = require('@/app/api/webhooks/konnect/route');
    let res = await POST({
      text: async () => '{}',
      headers: new Map(),
      url: 'http://localhost/api/webhooks/konnect',
    } as any);
    expect(res.status).toBe(401);

    res = await POST(signedRequest({ payment_id: 'p1', status: 'completed' }, 'bad-sign'));
    expect(res.status).toBe(401);
  });

  it('404 when payment not found', async () => {
    (prisma as any).payment.findUnique = jest.fn().mockResolvedValue(null);
    const { POST } = require('@/app/api/webhooks/konnect/route');
    const res = await POST(signedRequest({ payment_id: 'unknown', status: 'completed' }));
    expect(res.status).toBe(404);
  });

  it('handles completed subscription and allocates credits', async () => {
    (prisma as any).payment.findUnique = jest
      .fn()
      .mockResolvedValue({
        id: 'p1',
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        metadata: { studentId: 's1', itemKey: 'ACCÈS PLATEFORME' },
      });
    (prisma as any).payment.update = jest.fn().mockResolvedValue({});
    (prisma as any).student.findUnique = jest.fn().mockResolvedValue({ id: 's1' });
    (prisma as any).subscription.updateMany = jest.fn().mockResolvedValue({});
    (prisma as any).subscription.findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'sub1', creditsPerMonth: 4 });
    (prisma as any).creditTransaction.create = jest.fn().mockResolvedValue({});

    const { POST } = require('@/app/api/webhooks/konnect/route');
    const res = await POST(signedRequest({ payment_id: 'p1', status: 'completed' }));
    expect(res.status).toBe(200);
    expect((prisma as any).payment.update).toHaveBeenCalled();
    expect((prisma as any).creditTransaction.create).toHaveBeenCalled();
  });

  it('handles failed status', async () => {
    (prisma as any).payment.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'p1', status: 'PENDING', type: 'SUBSCRIPTION', metadata: {} });
    (prisma as any).payment.update = jest.fn().mockResolvedValue({});
    const { POST } = require('@/app/api/webhooks/konnect/route');
    const res = await POST(signedRequest({ payment_id: 'p1', status: 'failed' }));
    expect(res.status).toBe(200);
  });
});
