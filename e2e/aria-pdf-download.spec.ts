import { expect, test } from '@playwright/test';

// Validates that ARIA renders a dedicated download button when a PDF URL is returned
// and that the button points to a downloadable link.
test.describe('ARIA PDF download button', () => {
  test('shows a Télécharger le PDF button with a valid href', async ({ page }) => {
    await page.route('**/api/aria/chat', async (route) => {
      const body = JSON.stringify({
        response: 'Document prêt',
        documentUrl: '/generated/test.pdf',
      });
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    });

    await page.goto('/aria');
    // The /aria page might render the ChatWindow directly or we fall back to the home widget
    let chatInput = page.locator('input[placeholder="Posez votre question à ARIA..."]').first();
    try {
      await expect(chatInput).toBeVisible({ timeout: 10000 });
    } catch {
      await page.goto('/');
      await page.getByTestId('open-aria-chat').click();
      chatInput = page
        .locator(
          '[data-testid="aria-input"], [data-testid-aria="aria-input"], input[placeholder="Posez votre question à ARIA..."]'
        )
        .first();
      await expect(chatInput).toBeVisible({ timeout: 10000 });
    }

    await chatInput.fill('Génère un PDF complet de révision');
    await chatInput.press('Enter');

    const btn = page.getByTestId('aria-download-pdf');
    await expect(btn).toBeVisible();

    // Ensure the parent anchor has a valid href
    const href = await btn.evaluate((el) =>
      (el.parentElement as HTMLAnchorElement)?.getAttribute('href')
    );
    expect(href).toBeTruthy();
    expect(href!).toMatch(/\/generated\/.+\.pdf$|\/pdfs\/.+\.pdf$/);
  });
});
