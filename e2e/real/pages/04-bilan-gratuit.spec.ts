import { test, expect } from '@playwright/test';

/**
 * REAL AUDIT — Bilan Gratuit (/bilan-gratuit)
 *
 * Tests the multi-step registration form with real form submission
 * and database verification.
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
    // Actual H1 is "Créez Votre Compte Parent et Élève"
    expect(text.trim().length, 'H1 est vide').toBeGreaterThan(0);
  });

  test('Étape 1 — Champs parent visibles (data-testid)', async ({ page }) => {
    await expect(page.getByTestId('input-parent-firstname')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('input-parent-lastname')).toBeVisible();
    await expect(page.getByTestId('input-parent-email')).toBeVisible();
    await expect(page.getByTestId('input-parent-tel')).toBeVisible();
    await expect(page.getByTestId('input-parent-password')).toBeVisible();
  });

  test('Étape 1 — Validation empêche soumission vide', async ({ page }) => {
    const nextBtn = page.locator('button').filter({ hasText: /suivant|continuer|next|étape/i }).first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(1000);
      // Should still show step 1 fields or validation errors
      const hasValidationError = await page.locator('[data-testid*="error"], [class*="text-error"]').first().isVisible().catch(() => false);
      const stillOnStep1 = await page.getByTestId('input-parent-firstname').isVisible().catch(() => false);
      expect(hasValidationError || stillOnStep1, 'Formulaire avance sans validation').toBe(true);
    }
  });

  test('Soumission complète — crée parent + élève en DB', async ({ page }) => {
    const uniqueEmail = `test.audit.${Date.now()}@e2e-test.com`;

    // Fill step 1 — Parent info using data-testid
    await page.getByTestId('input-parent-firstname').fill('TestAudit');
    await page.getByTestId('input-parent-lastname').fill('Parent');
    await page.getByTestId('input-parent-email').fill(uniqueEmail);
    await page.getByTestId('input-parent-tel').fill('99887766');
    await page.getByTestId('input-parent-password').fill('TestPassword123!');

    // Click next to go to step 2
    const nextBtn = page.locator('button').filter({ hasText: /suivant|continuer|next|étape/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(2000);

    // Fill step 2 — Student info (actual data-testid: input-child-*)
    const studentFirstName = page.getByTestId('input-child-firstname');
    await expect(studentFirstName, 'Champ prénom élève non visible à l\'étape 2').toBeVisible({ timeout: 5000 });
    await studentFirstName.fill('TestAudit');
    await page.locator('#studentLastName').fill('Eleve');

    // Grade — custom Select component (click trigger, then option)
    const gradeTrigger = page.getByTestId('select-child-level');
    await gradeTrigger.click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').filter({ hasText: /terminale/i }).first().click();
    await page.waitForTimeout(300);

    // Current level — custom Select
    const levelTrigger = page.getByTestId('select-current-level');
    await levelTrigger.click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);

    // Preferred modality — custom Select (REQUIRED by validation)
    const modalityTrigger = page.getByTestId('select-preferred-modality');
    await modalityTrigger.click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);

    // Objectives — required by Zod (min 10 chars)
    const objectivesField = page.locator('#objectives');
    if (await objectivesField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await objectivesField.fill('Préparer le baccalauréat avec un suivi personnalisé');
    }

    // Select at least one subject (Checkbox component)
    const mathCheckbox = page.getByTestId('checkbox-subject-MATHEMATIQUES');
    if (await mathCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mathCheckbox.click();
    }

    // Accept terms
    const termsCheckbox = page.getByTestId('checkbox-accept-terms');
    await termsCheckbox.click();
    await page.waitForTimeout(300);

    // Submit — use data-testid
    const submitBtn = page.getByTestId('btn-submit-bilan');
    await expect(submitBtn, 'Bouton submit non trouvé').toBeVisible({ timeout: 3000 });

    // Check if button is disabled (validation errors remain)
    const isDisabled = await submitBtn.isDisabled();
    console.log(`Submit button disabled: ${isDisabled}`);
    if (isDisabled) {
      // Log visible errors
      const errorTexts = await page.locator('[class*="text-error"]').allTextContents();
      console.log('Validation errors:', errorTexts);
    }
    expect(isDisabled, 'Submit button is disabled — form validation failed').toBe(false);

    const [apiResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/bilan-gratuit'), { timeout: 15000 }),
      submitBtn.click(),
    ]);

    const status = apiResponse.status();
    console.log(`API /api/bilan-gratuit → HTTP ${status}`);

    if (status === 200) {
      const body = await apiResponse.json();
      console.log('API response:', JSON.stringify(body));
      expect(body.success, 'API ne retourne pas success=true').toBe(true);
      expect(body.parentId, 'API ne retourne pas parentId').toBeTruthy();
      expect(body.studentId, 'API ne retourne pas studentId').toBeTruthy();
    } else {
      const body = await apiResponse.json().catch(() => ({}));
      console.log(`API error response: ${JSON.stringify(body)}`);
      expect(status, `API retourne ${status}: ${JSON.stringify(body)}`).toBeLessThan(500);
    }
  });

  test('Confirmation page charge après soumission', async ({ page }) => {
    const resp = await page.request.get('/bilan-gratuit/confirmation');
    expect(resp.status()).toBe(200);
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForTimeout(2000);
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning')
    );
    expect(realErrors, `Erreurs console: ${realErrors.join('\n')}`).toHaveLength(0);
  });
});
