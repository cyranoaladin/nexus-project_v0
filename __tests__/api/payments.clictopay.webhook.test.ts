/**
 * ClicToPay webhook: header-before-body property lock.
 * request.text() must NOT be called when the response can be determined from headers alone.
 */
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));

import { POST } from '@/app/api/payments/clictopay/webhook/route';

function makeRequest(opts: { signature?: string; secret?: string; body?: string }) {
  const textMock = jest.fn().mockResolvedValue(opts.body ?? '{}');
  const req = {
    headers: { get: (name: string) => name === 'x-clictopay-signature' ? (opts.signature ?? null) : null },
    text: textMock,
  } as any;
  if (opts.secret) process.env.CLICTOPAY_WEBHOOK_SECRET = opts.secret;
  else delete process.env.CLICTOPAY_WEBHOOK_SECRET;
  return { req, textMock };
}

const originalSecret = process.env.CLICTOPAY_WEBHOOK_SECRET;
afterEach(() => {
  if (originalSecret !== undefined) process.env.CLICTOPAY_WEBHOOK_SECRET = originalSecret;
  else delete process.env.CLICTOPAY_WEBHOOK_SECRET;
});

describe('POST /api/payments/clictopay/webhook', () => {
  it('returns 501 without consuming body when secret is not configured', async () => {
    const { req, textMock } = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(501);
    expect(textMock).not.toHaveBeenCalled();
  });

  it('returns 401 without consuming body when signature header is missing', async () => {
    const { req, textMock } = makeRequest({ secret: 'test-secret' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(textMock).not.toHaveBeenCalled();
  });

  it('consumes body only when signature is valid hex format for HMAC verification', async () => {
    // Use a valid 64-char hex string (wrong value) to reach HMAC verification
    const fakeHex = 'a'.repeat(64);
    const { req, textMock } = makeRequest({ secret: 'test-secret', signature: fakeHex, body: '{"ok":true}' });
    const res = await POST(req);
    expect(res.status).toBe(401); // wrong HMAC
    expect(textMock).toHaveBeenCalledTimes(1);
  });

  it('rejects non-hex signature without consuming body', async () => {
    const { req, textMock } = makeRequest({ secret: 'test-secret', signature: 'bad-sig', body: '{"ok":true}' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(textMock).not.toHaveBeenCalled();
  });
});
