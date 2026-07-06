/**
 * Payments ClicToPay Webhook API — Complete Test Suite
 *
 * Tests: POST /api/payments/clictopay/webhook
 *
 * Source: app/api/payments/clictopay/webhook/route.ts
 */

import { POST } from '@/app/api/payments/clictopay/webhook/route';
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

describe('POST /api/payments/clictopay/webhook', () => {
  const originalSecret = process.env.CLICTOPAY_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CLICTOPAY_WEBHOOK_SECRET;
    } else {
      process.env.CLICTOPAY_WEBHOOK_SECRET = originalSecret;
    }
  });

  it('rejects unsigned webhooks before disabled integration handling', async () => {
    const req = new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe('CLICTOPAY_SIGNATURE_REQUIRED');
  });

  it('rejects an invalid webhook signature when the webhook secret is configured', async () => {
    process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
    const req = new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clictopay-signature': 'bad-signature',
      },
      body: JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Signature');
  });

  it('still returns 501 for a valid signed webhook while ClicToPay is not configured', async () => {
    process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
    const rawBody = JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' });
    const signature = createHmac('sha256', 'test-secret').update(rawBody).digest('hex');
    const req = new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clictopay-signature': signature,
      },
      body: rawBody,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(501);
    expect(body.code).toBe('CLICTOPAY_NOT_CONFIGURED');
  });
});
