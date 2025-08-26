import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

describe('Konnect webhook additional status branches', () => {
  const SECRET = 'testsecret2';
  const originalEnv = process.env.KONNECT_WEBHOOK_SECRET;
  beforeAll(() => {
    process.env.KONNECT_WEBHOOK_SECRET = SECRET as any;
  });
  afterAll(() => {
    process.env.KONNECT_WEBHOOK_SECRET = originalEnv;
  });

  function signedRequest(body: any) {
    const raw = JSON.stringify(body);
    const sig = crypto.createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex');
    return {
      text: async () => raw,
      headers: new Map([['x-konnect-signature', sig]]),
      url: 'http://localhost/api/webhooks/konnect',
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).payment = (prisma as any).payment || {};
    (prisma as any).payment.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'p1', status: 'PENDING', type: 'CREDIT_PACK', metadata: {} });
    (prisma as any).payment.update = jest.fn().mockResolvedValue({});
  });

  it('returns 200 for unknown status branch (neither completed nor failed)', async () => {
    const { POST } = require('@/app/api/webhooks/konnect/route');
    const res = await POST(signedRequest({ payment_id: 'p1', status: 'pending' }));
    expect(res.status).toBe(200);
  });

  it('handles CREDIT_PACK type (no-op path) and returns 200', async () => {
    const { POST } = require('@/app/api/webhooks/konnect/route');
    const res = await POST(signedRequest({ payment_id: 'p1', status: 'completed' }));
    expect(res.status).toBe(200);
    expect((prisma as any).payment.update).toHaveBeenCalled();
  });
});
