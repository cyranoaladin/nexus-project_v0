import { POST } from '@/app/api/payments/clictopay/webhook/route';
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

const forbiddenFields = ['rawWebhook', 'rawPayload', 'metadata', 'stack', 'bankReference'];

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

function expectNoForbiddenFields(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const field of forbiddenFields) {
    expect(serialized).not.toContain(field);
  }
}

describe('ClicToPay webhook disabled security contract', () => {
  const originalSecret = process.env.CLICTOPAY_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CLICTOPAY_WEBHOOK_SECRET;
    } else {
      process.env.CLICTOPAY_WEBHOOK_SECRET = originalSecret;
    }
  });

  it('rejects unsigned webhooks before disabled integration handling', async () => {
    delete process.env.CLICTOPAY_WEBHOOK_SECRET;

    const response = await POST(request({ orderId: 'ord-1', status: 'SUCCESS' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('CLICTOPAY_SIGNATURE_REQUIRED');
    expectNoForbiddenFields(body);
  });

  it('rejects invalid signatures when a webhook secret is configured', async () => {
    process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';

    const response = await POST(request({ orderId: 'ord-1', status: 'SUCCESS' }, 'bad-signature'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('CLICTOPAY_SIGNATURE_INVALID');
    expectNoForbiddenFields(body);
  });

  it('returns 501 for a valid signed webhook while integration remains disabled', async () => {
    process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
    const rawBody = JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' });
    const signature = createHmac('sha256', 'test-secret').update(rawBody).digest('hex');
    const response = await POST(
      new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clictopay-signature': signature,
        },
        body: rawBody,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.code).toBe('CLICTOPAY_NOT_CONFIGURED');
    expectNoForbiddenFields(body);
  });
});
