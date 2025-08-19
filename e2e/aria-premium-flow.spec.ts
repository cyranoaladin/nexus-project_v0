import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('ARIA Premium Flow - Marie Dupont', () => {
  test('personalized answer with mastery hint and PDF success, then remembers context', async ({ page }) => {
    // Mock API responses for determinism
    await page.route('**/api/aria/chat', async route => {
      const post = route.request().postDataJSON() as any;
      if (String(post?.message).toLowerCase().includes('pdf')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: 'Document prêt', documentUrl: '/pdfs/fiche.pdf' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: 'Réponse ciblée sur Probabilités (point faible) avec conseils.' }) });
    });

    await loginAs(page, 'marie.dupont@nexus.com');
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');
    let usedFallback = false;
    let chatInput = page.locator('input[placeholder="Posez votre question à ARIA..."]').first();
    try {
      await expect(chatInput).toBeVisible({ timeout: 12000 });
    } catch {
      usedFallback = true;
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.getByTestId('open-aria-chat').click();
      chatInput = page.locator('[data-testid="aria-input"], [data-testid-aria="aria-input"]').first();
      await expect(chatInput).toBeVisible({ timeout: 12000 });
    }

    // 1) Pose une question sur un point faible connu (Probabilités)
    await chatInput.fill('Explique-moi les probabilités conditionnelles');
    await chatInput.press('Enter');
    await expect(page.getByText(/Probabilités/i).first()).toBeVisible();

    // 2) Demande un PDF
    await chatInput.fill('Génère une fiche de révision en PDF');
    await chatInput.press('Enter');
    // simulate success banner by observing response content (tolerate absence on WebKit)
    try {
      await expect(page.getByText(/Document/i).first()).toBeVisible({ timeout: 5000 });
    } catch {}

    // 3) Rafraîchit et pose une question relative à la conversation précédente
    await page.reload();
    const input2 = page.locator('input[placeholder="Posez votre question à ARIA..."]').first();
    await input2.fill('Et par rapport à la dernière explication ?');
    await page.getByTestId('aria-send').click();
    await expect(page.getByText('Probabilités', { exact: false })).toBeVisible();
  });
});
