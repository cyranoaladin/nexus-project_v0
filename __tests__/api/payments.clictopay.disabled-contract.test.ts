import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { POST as webhookPOST } from '@/app/api/payments/clictopay/webhook/route';
import { POST as initPOST } from '@/app/api/payments/clictopay/init/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

function webhookRequest(body: unknown, signature?: string) {
  return new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'x-clictopay-signature': signature } : {}),
    },
    body: JSON.stringify(body),
  });
}

function initRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/payments/clictopay/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('ClicToPay disabled contract', () => {
  const originalSecret = process.env.CLICTOPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-clictopay-webhook-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CLICTOPAY_WEBHOOK_SECRET;
    } else {
      process.env.CLICTOPAY_WEBHOOK_SECRET = originalSecret;
    }
  });

  it('rejects unsigned and invalid webhook calls without mutation', async () => {
    const unsigned = await webhookPOST(webhookRequest({ orderId: 'ord-1', status: 'SUCCESS' }));
    const invalid = await webhookPOST(
      webhookRequest({ orderId: 'ord-1', status: 'SUCCESS' }, 'bad-signature'),
    );

    expect(unsigned.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.entitlement.create).not.toHaveBeenCalled();
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('returns 501 for validly signed webhook payloads while integration is disabled', async () => {
    const payload = JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS', amount: 450000 });
    const signature = createHmac('sha256', process.env.CLICTOPAY_WEBHOOK_SECRET!)
      .update(payload)
      .digest('hex');

    const response = await webhookPOST(
      new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clictopay-signature': signature,
        },
        body: payload,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toEqual({
      error: 'Webhook ClicToPay en cours de configuration',
      code: 'CLICTOPAY_NOT_CONFIGURED',
    });
    expect(JSON.stringify(body)).not.toContain('rawPayload');
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.entitlement.create).not.toHaveBeenCalled();
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('keeps init disabled for authenticated parents', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });

    const response = await initPOST(
      initRequest({
        amount: 450000,
        description: 'Formule Nexus',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.code).toBe('CLICTOPAY_NOT_CONFIGURED');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
