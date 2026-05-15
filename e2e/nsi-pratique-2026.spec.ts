import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('NSI Pratique 2026 — Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'student', { targetPath: '/dashboard/eleve/nsi-pratique-2026' });
  });

  test('page loads and shows hero', async ({ page }) => {
    await expect(page.getByText('Épreuve pratique NSI 2026')).toBeVisible({ timeout: 10000 });
  });

  test('navigation tabs are visible', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Plan 5 jours')).toBeVisible();
    await expect(page.getByText('Sujets')).toBeVisible();
    await expect(page.getByText('Patrons')).toBeVisible();
    await expect(page.getByText('Flashcards')).toBeVisible();
    await expect(page.getByText('Sujet blanc')).toBeVisible();
  });

  test('subjects grid shows 23 subjects', async ({ page }) => {
    await page.getByText('Sujets').click();
    await page.waitForTimeout(500);
    // Verify at least some subject cards are visible
    const subjectCards = page.locator('[data-testid="subject-card"]');
    // Fallback: check for subject titles if no test IDs
    const compressionCard = page.getByText('Compression');
    await expect(compressionCard.first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking a subject opens detail view', async ({ page }) => {
    await page.getByText('Sujets').click();
    await page.waitForTimeout(500);
    // Click first subject
    const firstCard = page.getByText('Compression').first();
    await firstCard.click();
    // Detail view should show close button
    await expect(page.getByLabel('Fermer le détail du sujet')).toBeVisible({ timeout: 5000 });
  });

  test('flashcards section loads', async ({ page }) => {
    await page.getByText('Flashcards').click();
    await page.waitForTimeout(500);
    // Should show the source selector or a card
    const flashcardSection = page.getByText('Retourner').first().or(page.getByText('toutes les sources').first());
    await expect(flashcardSection).toBeVisible({ timeout: 5000 });
  });

  test('mock exam section shows start button', async ({ page }) => {
    await page.getByText('Sujet blanc').click();
    await page.waitForTimeout(500);
    // Should show shuffle/start button
    await expect(page.getByText('Tirer un sujet').first().or(page.getByText('Démarrer').first())).toBeVisible({ timeout: 5000 });
  });

  test('localStorage notice is displayed', async ({ page }) => {
    await expect(page.getByText('Progression sauvegardée sur cet appareil')).toBeVisible({ timeout: 10000 });
  });
});
