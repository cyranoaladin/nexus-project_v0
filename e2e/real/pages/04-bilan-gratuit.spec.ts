import { test, expect } from '@playwright/test';

/**
 * REAL AUDIT — Bilan Gratuit (/bilan-gratuit)
 *
 * Tests the low-friction bilan request form with real form submission.
 * The public page must not ask for a password before qualification.
 */

test.describe('REAL — Bilan Gratuit (/bilan-gratuit)', () => {
  let consoleErrors: string[] = [];
  let networkErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    networkErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('response', (resp) => {
      if (resp.status() >= 400) networkErrors.push(`[${resp.status()}] ${resp.url()}`);
    });
    await page.goto('/bilan-gratuit', { waitUntil: 'load' });
  });

  test('HTTP 200 — Page charge', async ({ page }) => {
    const resp = await page.request.get('/bilan-gratuit');
    expect(resp.status()).toBe(200);
  });

  test('H1 visible et pertinent', async ({ page }) => {
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    const text = (await h1.textContent()) || '';
    console.log(`Bilan H1: "${text.trim()}"`);
    expect(text.trim().length, 'H1 est vide').toBeGreaterThan(0);
  });

  test('Formulaire de demande visible sans mot de passe', async ({ page }) => {
    await expect(page.locator('#parentFirstName')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#parentLastName')).toBeVisible();
    await expect(page.locator('#parentEmail')).toBeVisible();
    await expect(page.locator('#parentPhone')).toBeVisible();
    await expect(page.locator('#studentFirstName')).toBeVisible();
    await expect(page.locator('#studentGrade')).toBeVisible();
    await expect(page.locator('#studentSchool')).toBeVisible();
    await expect(page.locator('#objectives')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('Validation empêche soumission vide', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i });
    await submitBtn.click();
    await expect(page.locator('text=Email invalide')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#parentFirstName')).toBeVisible();
  });

  test('Soumission complète — contrat public sécurisé et confirmation', async ({ page }) => {
    const uniqueEmail = `test.audit.${Date.now()}@e2e-test.com`;

    await page.locator('#parentFirstName').fill('TestAudit');
    await page.locator('#parentLastName').fill('Parent');
    await page.locator('#parentEmail').fill(uniqueEmail);
    await page.locator('#parentPhone').fill('99887766');
    await page.locator('#studentFirstName').fill('TestAudit');
    await page.locator('#studentGrade').selectOption('terminale');
    await page.locator('#studentSchool').fill('Lycée Pierre Mendès France');
    await page.locator('label').filter({ hasText: 'Mathématiques' }).click();
    await page.locator('#objectives').fill('Préparer le baccalauréat avec un suivi personnalisé');
    await page.locator('label').filter({ hasText: /j’accepte d’être contacté/i }).click();

    const submitBtn = page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i });
    await expect(submitBtn, 'Bouton submit non trouvé').toBeVisible({ timeout: 3000 });

    const [apiResponse] = await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes('/api/bilan-gratuit') && resp.request().method() === 'POST',
        { timeout: 15000 }
      ),
      submitBtn.click(),
    ]);

    const status = apiResponse.status();
    console.log(`API /api/bilan-gratuit → HTTP ${status}`);

    const body = await apiResponse.json();

    expect(status, `API retourne ${status}: ${JSON.stringify(body)}`).toBe(200);
    expect(body.success, 'API ne retourne pas success=true').toBe(true);
    expect(body.message, 'API ne retourne pas de message de confirmation').toBeTruthy();
    expect(body).not.toHaveProperty('parentId');
    expect(body).not.toHaveProperty('studentId');
    expect(body).not.toHaveProperty('token');
    expect(body).not.toHaveProperty('assessmentToken');
    expect(body).not.toHaveProperty('leadEmailHash');
    expect(JSON.stringify(body)).not.toMatch(/parentId|studentId|token|assessmentToken|leadEmailHash/i);

    await page.waitForURL('**/bilan-gratuit/confirmation', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /votre demande de bilan a bien été enregistrée/i })).toBeVisible();
  });

  test('Confirmation page charge après soumission', async ({ page }) => {
    const resp = await page.request.get('/bilan-gratuit/confirmation');
    expect(resp.status()).toBe(200);
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning')
    );
    expect(realErrors, `Erreurs console: ${realErrors.join('\n')}`).toHaveLength(0);
  });
});
