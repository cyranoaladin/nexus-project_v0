import { POST } from '@/app/api/payments/clictopay/webhook/route';
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

function request(body: unknown, signature?: string) {
  return new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'x-clictopay-signature': signature } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('ClicToPay webhook disabled product decision', () => {
  const originalSecret = process.env.CLICTOPAY_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CLICTOPAY_WEBHOOK_SECRET;
    } else {
      process.env.CLICTOPAY_WEBHOOK_SECRET = originalSecret;
    }
  });

  it('does not mutate payment, invoice or entitlement state while disabled', async () => {
    process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
    const rawBody = JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS', amount: 450000 });
    const signature = createHmac('sha256', 'test-secret').update(rawBody).digest('hex');

    const response = await POST(request(JSON.parse(rawBody), signature));
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.code).toBe('CLICTOPAY_NOT_CONFIGURED');
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.invoice?.update).not.toHaveBeenCalled();
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });
});
