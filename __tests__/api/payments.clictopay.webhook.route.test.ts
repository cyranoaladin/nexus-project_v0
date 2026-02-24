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
  it('should return 501 (not configured)', async () => {
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
});
