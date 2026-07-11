/**
 * Payments ClicToPay Webhook API — Complete Test Suite
 *
 * Tests: POST /api/payments/clictopay/webhook
 *
 * Source: app/api/payments/clictopay/webhook/route.ts
 */

import { POST } from '@/app/api/payments/clictopay/webhook/route';
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

  it('returns 501 without consuming body when secret is not configured', async () => {
    delete process.env.CLICTOPAY_WEBHOOK_SECRET;
    const req = new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(501);
    expect(body.code).toBe('CLICTOPAY_NOT_CONFIGURED');
  });

  it('returns 401 when secret is configured but signature header is missing', async () => {
    process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
    const req = new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Signature');
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
});
