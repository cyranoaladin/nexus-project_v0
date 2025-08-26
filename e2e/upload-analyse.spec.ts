import { expect, test } from '@playwright/test';

const RUN = process.env.E2E_RUN === '1';

(RUN ? test.describe : test.describe.skip)('Uploads Analyse', () => {
  test('rejects unauthenticated upload', async ({ request }) => {
    const res = await request.post('/api/uploads/analyse', {
      headers: { 'Content-Type': 'application/pdf' },
      data: Buffer.from('%PDF-1.4 test'),
    });
    expect(res.status()).toBe(401);
  });
});
