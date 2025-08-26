import { prisma } from '@/lib/prisma';

describe('Konnect webhook catch block', () => {
  const SECRET = 'catchsecret';
  const originalEnv = process.env.KONNECT_WEBHOOK_SECRET;
  beforeAll(() => {
    process.env.KONNECT_WEBHOOK_SECRET = SECRET as any;
  });
  afterAll(() => {
    process.env.KONNECT_WEBHOOK_SECRET = originalEnv;
  });

  it('returns 500 when request.text throws', async () => {
    const { POST } = require('@/app/api/webhooks/konnect/route');
    const sig = 'any';
    const req = {
      text: async () => {
        throw new Error('read error');
      },
      headers: new Map([['x-konnect-signature', sig]]),
      url: 'http://localhost/api/webhooks/konnect',
    } as any;
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
