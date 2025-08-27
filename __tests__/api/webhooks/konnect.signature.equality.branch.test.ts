import crypto from 'crypto';

describe('Konnect webhook signature safeEqual false branch', () => {
  it('returns 401 when timingSafeEqual fails due to length mismatch', async () => {
    process.env.KONNECT_WEBHOOK_SECRET = 'sekret';
    const raw = JSON.stringify({ payment_id: 'p1', status: 'completed' });
    const badSig = crypto.createHmac('sha256', 'sekret').update(raw).digest('hex') + 'xx';
    const headers = { get: (k: string) => (k.toLowerCase() === 'x-konnect-signature' ? badSig : null) } as any;
    const req = { text: async () => raw, headers } as any;
    const { POST } = require('@/app/api/webhooks/konnect/route');
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
