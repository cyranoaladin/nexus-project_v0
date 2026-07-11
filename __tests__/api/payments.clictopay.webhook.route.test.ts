/**
 * Payments ClicToPay Webhook API — Complete Test Suite
 *
 * Tests: POST /api/payments/clictopay/webhook
 *
 * Source: app/api/payments/clictopay/webhook/route.ts
 */

import { POST } from '@/app/api/payments/clictopay/webhook/route';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

function makeWebhookRequest(
  opts: {
    secret?: string;
    signatureHeader?: string | null;
    body?: string;
  } = {},
) {
  const payload = opts.body ?? JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.signatureHeader !== undefined && opts.signatureHeader !== null) {
    headers['x-clictopay-signature'] = opts.signatureHeader;
  }
  return new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
    method: 'POST',
    headers,
    body: payload,
  });
}

function computeValidSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

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
    const req = makeWebhookRequest();

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(501);
    expect(body.code).toBe('CLICTOPAY_NOT_CONFIGURED');
  });

  it('returns 401 when secret is configured but signature header is missing', async () => {
    process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
    const req = makeWebhookRequest({ signatureHeader: null });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Signature');
  });

  it('rejects an invalid webhook signature', async () => {
    process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
    const req = makeWebhookRequest({ signatureHeader: 'bad-signature' });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Signature');
  });

  describe('hex format validation', () => {
    it('rejects empty signature string', async () => {
      process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
      const req = makeWebhookRequest({ signatureHeader: '' });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('rejects non-hex characters in signature', async () => {
      process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
      const req = makeWebhookRequest({ signatureHeader: 'zzzz-not-hex-at-all!!!!' });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('rejects odd-length hex string', async () => {
      process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
      const req = makeWebhookRequest({ signatureHeader: 'abc' });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('rejects hex string with incorrect length for SHA-256 (not 64 chars)', async () => {
      process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
      const req = makeWebhookRequest({ signatureHeader: 'abcdef1234567890' });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('accepts uppercase hex and verifies correctly (case-insensitive)', async () => {
      process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
      const payload = JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' });
      const validSig = computeValidSignature('test-secret', payload).toUpperCase();
      const req = makeWebhookRequest({ signatureHeader: validSig, body: payload });

      const res = await POST(req);
      // Uppercase hex should be normalized and match → 501 (stub, not 401)
      expect(res.status).toBe(501);
    });

    it('accepts valid HMAC-SHA256 signature and returns 501 (stub)', async () => {
      process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
      const payload = JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' });
      const validSig = computeValidSignature('test-secret', payload);
      const req = makeWebhookRequest({ signatureHeader: validSig, body: payload });

      const res = await POST(req);
      const body = await res.json();

      // Valid signature → passes through to stub → 501
      expect(res.status).toBe(501);
      expect(body.code).toBe('CLICTOPAY_NOT_CONFIGURED');
    });

    it('rejects when payload is modified after signing', async () => {
      process.env.CLICTOPAY_WEBHOOK_SECRET = 'test-secret';
      const originalPayload = JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS' });
      const validSig = computeValidSignature('test-secret', originalPayload);
      const tamperedPayload = JSON.stringify({ orderId: 'ord-1', status: 'SUCCESS', amount: 0 });
      const req = makeWebhookRequest({ signatureHeader: validSig, body: tamperedPayload });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });
});
