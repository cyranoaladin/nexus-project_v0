import { expect, test } from '@playwright/test';
import { captureConsole } from './helpers';

const RUN = process.env.E2E_RUN === '1';

(RUN ? test.describe : test.describe.skip)('Uploads Analyse', () => {
  test('rejects unauthenticated upload', async ({ request, page }) => {
    const cap = captureConsole(page, test.info());
    try {
      const res = await request.post('/api/uploads/analyse', {
        headers: { 'Content-Type': 'application/pdf' },
        data: Buffer.from('%PDF-1.4 test')
      });
      expect(res.status()).toBe(401);
    } finally {
      await cap.attach('console.upload.analyse.json');
    }
  });
});
