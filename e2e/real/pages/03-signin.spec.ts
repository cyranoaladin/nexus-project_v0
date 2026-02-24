import { test, expect } from '@playwright/test';

/**
 * REAL AUDIT — Sign In (/auth/signin)
 *
 * Tests real authentication with seed users against the actual database.
 * No mocks, no skips.
 */

test.describe('REAL — Sign In (/auth/signin)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
  });

  test('HTTP 200 — Page charge', async ({ page }) => {
    const resp = await page.request.get('/auth/signin');
    expect(resp.status()).toBe(200);
  });

  test('Champs email et password présents avec data-testid', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('input-email')).toBeVisible();
    await expect(page.getByTestId('input-password')).toBeVisible();
    await expect(page.getByTestId('btn-signin')).toBeVisible();
  });

  test('Page distingue visuellement parent et élève', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    const bodyText = (await page.textContent('body')) || '';
    const mentionsParent = bodyText.toLowerCase().includes('parent');
    const mentionsEleve = bodyText.toLowerCase().includes('élève') || bodyText.toLowerCase().includes('eleve');
    expect(mentionsParent || mentionsEleve, 'La page ne distingue pas parent/élève').toBe(true);
  });

  // REAL AUTH — Admin login
  test('CONNEXION RÉELLE — Admin → /dashboard/admin', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await page.getByTestId('input-email').fill('admin@nexus-reussite.com');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('btn-signin').click();

    await page.waitForURL('**/dashboard/admin**', { timeout: 15000 });
    expect(page.url()).toContain('/dashboard/admin');
  });

  // REAL AUTH — Parent login
  test('CONNEXION RÉELLE — Parent → /dashboard/parent', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await page.getByTestId('input-email').fill('parent@example.com');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('btn-signin').click();

    await page.waitForURL('**/dashboard/parent**', { timeout: 15000 });
    expect(page.url()).toContain('/dashboard/parent');
  });

  // REAL AUTH — Student login
  test('CONNEXION RÉELLE — Élève → /dashboard/eleve', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await page.getByTestId('input-email').fill('student@example.com');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('btn-signin').click();

    await page.waitForURL('**/dashboard/eleve**', { timeout: 15000 });
    expect(page.url()).toContain('/dashboard/eleve');
  });

  // REAL AUTH — Coach login
  test('CONNEXION RÉELLE — Coach → /dashboard/coach', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await page.getByTestId('input-email').fill('helios@nexus-reussite.com');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('btn-signin').click();

    await page.waitForURL('**/dashboard/coach**', { timeout: 15000 });
    expect(page.url()).toContain('/dashboard/coach');
  });

  // Wrong password
  test('Mauvais password → message erreur, reste sur /auth/signin', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await page.getByTestId('input-email').fill('admin@nexus-reussite.com');
    await page.getByTestId('input-password').fill('WRONG_PASSWORD');
    await page.getByTestId('btn-signin').click();

    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/auth/signin');

    const errorMsg = page.getByText(/incorrect|invalide|erreur|error|échoué/i);
    await expect(errorMsg, 'Aucun message d\'erreur pour mauvais password').toBeVisible({ timeout: 5000 });
  });

  // Email inexistant
  test('Email inexistant → message erreur générique', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await page.getByTestId('input-email').fill('nexiste.pas@jamais.com');
    await page.getByTestId('input-password').fill('test1234');
    await page.getByTestId('btn-signin').click();

    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/auth/signin');
    await expect(page.getByText(/incorrect|invalide|erreur|error|échoué/i)).toBeVisible({ timeout: 5000 });
  });

  // Role separation — Parent cannot access /dashboard/eleve
  test('Séparation rôles — Parent connecté ne peut pas accéder à /dashboard/eleve', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await page.getByTestId('input-email').fill('parent@example.com');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('btn-signin').click();
    await page.waitForURL('**/dashboard/parent**', { timeout: 15000 });

    // Try accessing eleve dashboard
    await page.goto('/dashboard/eleve');
    await page.waitForTimeout(2000);
    expect(page.url(), 'Parent a accédé au dashboard élève !').not.toContain('/dashboard/eleve');
  });

  // Role separation — Student cannot access /dashboard/admin
  test('Séparation rôles — Élève connecté ne peut pas accéder à /dashboard/admin', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await page.getByTestId('input-email').fill('student@example.com');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('btn-signin').click();
    await page.waitForURL('**/dashboard/eleve**', { timeout: 15000 });

    await page.goto('/dashboard/admin');
    await page.waitForTimeout(2000);
    expect(page.url(), 'Élève a accédé au dashboard admin !').not.toContain('/dashboard/admin');
  });
});
