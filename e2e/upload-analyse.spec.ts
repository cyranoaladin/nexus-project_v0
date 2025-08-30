import { expect, test, request as pwRequest } from '@playwright/test';

const RUN = process.env.E2E_RUN === '1';

(RUN ? test.describe : test.describe.skip)('Uploads Analyse', () => {
  test('rejects unauthenticated upload', async ({ baseURL }) => {
    const anon = await pwRequest.newContext({ baseURL, storageState: undefined });
    const res = await anon.post('/api/uploads/analyse', {
      headers: { 'Content-Type': 'application/pdf' },
      data: Buffer.from('%PDF-1.4 test'),
    });
    await anon.dispose();
    expect(res.status()).toBe(401);
  });
});
