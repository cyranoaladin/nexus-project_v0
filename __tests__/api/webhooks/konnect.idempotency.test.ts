import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

describe('Konnect webhook idempotency', () => {
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
    return {
      text: async () => raw,
      headers: new Map([["x-konnect-signature", sig]]),
      url: 'http://localhost/api/webhooks/konnect',
    } as any;
  }

  it('processes once and returns idempotent=true on duplicate', async () => {
    const txId = 'tx-1';

    // First delivery: not processed yet
    (prisma as any).payment.findUnique = jest.fn().mockResolvedValue({
      id: 'p1',
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      amount: 450,
      metadata: { studentId: 's1', itemKey: 'HYBRIDE' },
    });
    (prisma as any).payment.update = jest.fn().mockResolvedValue({});
    (prisma as any).student.findUnique = jest.fn().mockResolvedValue({ id: 's1' });
    (prisma as any).subscription.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    (prisma as any).subscription.create = jest.fn().mockResolvedValue({ id: 'sub1' });
    (prisma as any).subscription.findFirst = jest.fn().mockResolvedValue({ id: 'sub1', creditsPerMonth: 8 });
    (prisma as any).creditTransaction.create = jest.fn().mockResolvedValue({});

    const { POST } = require('@/app/api/webhooks/konnect/route');
    let res = await POST(signedRequest({ payment_id: 'p1', status: 'completed', transaction_id: txId }));
    expect(res.status).toBe(200);
    expect((prisma as any).payment.update).toHaveBeenCalled();
    expect((prisma as any).creditTransaction.create).toHaveBeenCalledTimes(1);

    // Second delivery: already processed (processedKeys contains txId)
    (prisma as any).payment.findUnique = jest.fn().mockResolvedValue({
      id: 'p1',
      status: 'COMPLETED',
      type: 'SUBSCRIPTION',
      amount: 450,
      metadata: { studentId: 's1', itemKey: 'HYBRIDE', processedKeys: [txId] },
    });

    res = await POST(signedRequest({ payment_id: 'p1', status: 'completed', transaction_id: txId }));
    expect(res.status).toBe(200);
    const body = await (res as any).json();
    expect(body.idempotent).toBe(true);
    // No additional credit allocation on duplicate
    expect((prisma as any).creditTransaction.create).toHaveBeenCalledTimes(1);
  });
});
