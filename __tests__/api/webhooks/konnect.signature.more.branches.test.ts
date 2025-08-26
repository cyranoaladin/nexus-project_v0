import crypto from 'crypto';

describe('Konnect webhook additional branches', () => {
  const secret = 'shhh';
  const build = (body: any) => {
    const raw = JSON.stringify(body);
    const sig = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
    const headers = {
      get: (k: string) => (k.toLowerCase() === 'x-konnect-signature' ? sig : null),
    } as any;
    const req = { text: async () => raw, headers } as any;
    return { req, raw, sig };
  };

  beforeEach(() => {
    process.env.KONNECT_WEBHOOK_SECRET = secret;
    jest.resetModules();
  });

  it('400 when payload missing payment_id or status', async () => {
    const { POST } = require('@/app/api/webhooks/konnect/route');
    const { req } = build({});
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
