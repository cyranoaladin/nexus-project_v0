import { test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './accessibility-check';
import { loginAs, captureConsole } from './helpers';
import { USERS } from './test-data';

const RUN = process.env.E2E_RUN === '1';

(RUN ? test.describe : test.describe.skip)('Upload Analyse - Accessibilité', () => {
  test('La page de gestion RAG (upload) ne doit avoir aucune violation critique', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await loginAs(page, USERS[0].email); // admin
      await page.goto('/dashboard/admin/rag-management');
      await expectNoCriticalA11yViolations(page);
    } finally {
      await cap.attach('console.upload.a11y.json');
    }
  });
});
