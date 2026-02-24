import { test, expect, Page } from '@playwright/test';

/**
 * REAL AUDIT — Dashboard pages (authenticated).
 * Tests real login → dashboard load → key elements → console/network errors.
 */

/** Helper: login via UI and navigate to dashboard */
async function loginAndGo(page: Page, email: string, password: string, expectedUrl: string) {
  await page.goto('/auth/signin', { waitUntil: 'load' });
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('btn-signin').click();
  await page.waitForURL(`**${expectedUrl}**`, { timeout: 15000 });
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────

test.describe('DASHBOARD — Admin (/dashboard/admin)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await loginAndGo(page, 'admin@nexus-reussite.com', 'admin123', '/dashboard/admin');
  });

  test('Page charge et affiche contenu admin', async ({ page }) => {
    await page.waitForTimeout(3000);
    const bodyText = (await page.textContent('body')) || '';
    const hasAdminContent = /admin|tableau|dashboard|utilisateur|gestion/i.test(bodyText);
    expect(hasAdminContent, 'Aucun contenu admin visible').toBe(true);
  });

  test('Navigation sidebar/header présente', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Check for navigation elements (sidebar or header nav)
    const navElements = page.locator('nav, aside, [role="navigation"]');
    const count = await navElements.count();
    console.log(`Admin nav elements: ${count}`);
    expect(count, 'Aucun élément de navigation trouvé').toBeGreaterThan(0);
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForTimeout(3000);
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning') &&
        !e.includes('next-dev') && !e.includes('NEXT_REDIRECT') &&
        !e.includes('Framing')
    );
    if (realErrors.length > 0) console.log('Admin console errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });
});

// ─── PARENT DASHBOARD ─────────────────────────────────────────────────────────

test.describe('DASHBOARD — Parent (/dashboard/parent)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await loginAndGo(page, 'parent@example.com', 'admin123', '/dashboard/parent');
  });

  test('Page charge et affiche contenu parent', async ({ page }) => {
    await page.waitForTimeout(3000);
    const bodyText = (await page.textContent('body')) || '';
    const hasParentContent = /parent|enfant|tableau|dashboard|session|abonnement|crédit/i.test(bodyText);
    expect(hasParentContent, 'Aucun contenu parent visible').toBe(true);
  });

  test('BilanGratuitBanner ou contenu principal visible', async ({ page }) => {
    await page.waitForTimeout(3000);
    // Either the bilan banner or the main dashboard content should be visible
    const hasBanner = await page.locator('[data-testid="bilan-banner"]').isVisible().catch(() => false);
    const hasMainContent = await page.locator('h1, h2, [role="tablist"]').first().isVisible().catch(() => false);
    console.log(`Bilan banner: ${hasBanner}, Main content: ${hasMainContent}`);
    expect(hasBanner || hasMainContent, 'Ni banner ni contenu principal visible').toBe(true);
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForTimeout(3000);
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning') &&
        !e.includes('next-dev') && !e.includes('NEXT_REDIRECT') &&
        !e.includes('Framing')
    );
    if (realErrors.length > 0) console.log('Parent console errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });
});

// ─── ÉLÈVE DASHBOARD ──────────────────────────────────────────────────────────

test.describe('DASHBOARD — Élève (/dashboard/eleve)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await loginAndGo(page, 'student@example.com', 'admin123', '/dashboard/eleve');
  });

  test('Page charge et affiche contenu élève', async ({ page }) => {
    await page.waitForTimeout(3000);
    const bodyText = (await page.textContent('body')) || '';
    const hasStudentContent = /élève|session|crédit|cours|progression|dashboard/i.test(bodyText);
    expect(hasStudentContent, 'Aucun contenu élève visible').toBe(true);
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForTimeout(3000);
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning') &&
        !e.includes('next-dev') && !e.includes('NEXT_REDIRECT') &&
        !e.includes('Framing')
    );
    if (realErrors.length > 0) console.log('Élève console errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });
});

// ─── COACH DASHBOARD ──────────────────────────────────────────────────────────

test.describe('DASHBOARD — Coach (/dashboard/coach)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await loginAndGo(page, 'helios@nexus-reussite.com', 'admin123', '/dashboard/coach');
  });

  test('Page charge et affiche contenu coach', async ({ page }) => {
    await page.waitForTimeout(3000);
    const bodyText = (await page.textContent('body')) || '';
    const hasCoachContent = /coach|session|disponibilité|planning|dashboard/i.test(bodyText);
    expect(hasCoachContent, 'Aucun contenu coach visible').toBe(true);
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForTimeout(3000);
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning') &&
        !e.includes('next-dev') && !e.includes('NEXT_REDIRECT') &&
        !e.includes('Framing')
    );
    if (realErrors.length > 0) console.log('Coach console errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });
});
