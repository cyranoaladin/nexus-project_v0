import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test.describe('NSI Pratique 2026 — Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'student', { targetPath: '/dashboard/eleve/nsi-pratique-2026' });
    await expect(page.getByRole('button', { name: "Vue d'ensemble", exact: true })).toHaveAttribute('aria-current', 'page');
  });

  async function openSection(page: import('@playwright/test').Page, name: string) {
    const button = page.locator('main nav').getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-current', 'page');
  }

  test('page loads and shows hero', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Opération commando NSI 2026' })).toBeVisible({ timeout: 10000 });
  });

  test('navigation tabs are visible', async ({ page }) => {
    const navigation = page.locator('main nav').filter({ has: page.getByRole('button', { name: 'Plan 5 jours', exact: true }) });
    await expect(navigation).toBeVisible({ timeout: 10000 });
    for (const label of ['Plan 5 jours', 'Sujets', 'Patrons', 'Flashcards', 'Sujet blanc']) {
      await expect(navigation.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('subjects grid shows 23 subjects', async ({ page }) => {
    await openSection(page, 'Sujets');
    await expect(page.getByText("Compression d'images en niveaux de gris", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('clicking a subject opens detail view', async ({ page }) => {
    await openSection(page, 'Sujets');
    await page.getByRole('button', { name: 'Réviser', exact: true }).first().click();
    await expect(page.getByLabel('Fermer le détail du sujet')).toBeVisible({ timeout: 5000 });
  });

  test('flashcards section loads', async ({ page }) => {
    await openSection(page, 'Flashcards');
    await expect(page.getByText('Toutes les cartes', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Cliquez pour retourner la carte/i)).toBeVisible();
  });

  test('mock exam section shows start button', async ({ page }) => {
    await openSection(page, 'Sujet blanc');
    await expect(page.getByRole('button', { name: /Tirer un sujet au hasard/i })).toBeVisible({ timeout: 5000 });
  });

  test('server synchronization notice is displayed', async ({ page }) => {
    await expect(page.getByText(/Progression synchronisée avec le serveur/i)).toBeVisible({ timeout: 10000 });
  });
});
