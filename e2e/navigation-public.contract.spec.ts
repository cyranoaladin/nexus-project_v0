import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/',
  '/offres',
  '/bilan-gratuit',
  '/bilan-gratuit/confirmation',
  '/stages',
  '/stages/fevrier-2026',
  '/stages/fevrier-2026/diagnostic',
  '/contact',
  '/accompagnement-scolaire',
  '/plateforme-aria',
  '/equipe',
  '/notre-centre',
  '/famille',
  '/academy',
  '/consulting',
  '/conditions',
  '/mentions-legales',
];

test.describe('Navigation publique - contrat', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`la page ${route} répond sans 404`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response).not.toBeNull();
      expect(response!.status()).toBeLessThan(400);
      await expect(page.locator('h1').first()).toBeVisible();
    });
  }

  test('les liens critiques homepage sont présents', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: /bilan gratuit/i }).first()).toHaveAttribute(
      'href',
      /\/bilan-gratuit/
    );
    await expect(page.getByRole('link', { name: /offres/i }).first()).toHaveAttribute('href', /\/offres/);
    await expect(page.getByRole('link', { name: /contact/i }).first()).toHaveAttribute('href', /\/contact/);
  });

  test('formulaire contact home appelle /api/contact', async ({ page }) => {
    await page.goto('/');

    let nameInput = page
      .locator('input[name="name"], input[name="nom"], [data-testid="input-contact-nom"]')
      .first();
    if (!(await nameInput.isVisible().catch(() => false))) {
      await page.goto('/contact');
      nameInput = page
        .locator('input[name="name"], input[name="nom"], [data-testid="input-contact-nom"]')
        .first();
    }
    await expect(nameInput).toBeVisible({ timeout: 10000 });

    const emailInput = page
      .locator('input[name="email"], [data-testid="input-contact-email"]')
      .first();
    const messageInput = page
      .locator('textarea[name="message"], textarea[name="content"], [data-testid="input-contact-message"]')
      .first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(messageInput).toBeVisible({ timeout: 10000 });

    await nameInput.fill('E2E Navigation');
    await emailInput.fill('e2e.navigation@test.com');
    await messageInput.fill('Test contact contractuel');

    const contactRequest = page.waitForRequest((req) => req.url().includes('/api/contact') && req.method() === 'POST');
    await page
      .locator('button[type="submit"], [data-testid="btn-submit-contact"]')
      .last()
      .click();
    await contactRequest;
  });

  test('liens internes de la home ne cassent pas', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href') || '').filter(Boolean)
    );

    const checked = new Set<string>();
    for (const href of hrefs) {
      if (href.startsWith('/#') || href === '/') continue;
      if (checked.has(href)) continue;
      checked.add(href);

      const response = await page.request.get(href, { failOnStatusCode: false });
      expect(response.status(), `Broken link ${href}`).toBeLessThan(400);
    }
  });
});
