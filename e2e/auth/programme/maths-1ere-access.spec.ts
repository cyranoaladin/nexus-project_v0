import { expect, test } from '@playwright/test';
import { loginAsUser, type UserType } from '../../helpers/auth';

const APP_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3002';
const BASE_URL = '/programme/maths-1ere';

async function expectMathsPremierePage(page: import('@playwright/test').Page) {
  await expect(page).toHaveURL(new RegExp(`${BASE_URL.replace('/', '\\/')}(?:[?#]|$)`));
  await expect(page.getByRole('heading', { name: 'Nexus Maths' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: /Cockpit Pédagogique/i })).toBeVisible();
}

async function loginViaUi(
  page: import('@playwright/test').Page,
  role: UserType
) {
  await loginAsUser(page, role, { navigate: false });
}

test.describe('Maths 1ere access control and navigation', () => {
  test('parent can access and navigate the main tabs', async ({ page }) => {
    await loginViaUi(page, 'parent');
    await page.goto(`${APP_URL}${BASE_URL}`, { waitUntil: 'domcontentloaded' });

    await expectMathsPremierePage(page);

    await page.getByRole('button', { name: /Programme & Cours/i }).click();
    await expect(page.getByText(/Second degré/i).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Objectif Épreuve/i }).click();
    await expect(page.getByRole('heading', { name: /Blanc — Format Officiel 2026/i })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Mon Plan Final/i }).click();
    await expect(page.getByRole('heading', { name: /Bilan & Plan de révision/i })).toBeVisible({ timeout: 15000 });
  });

  test('Premiere student is routed to the canonical student programme', async ({ page }) => {
    await loginViaUi(page, 'student2');
    await page.goto(`${APP_URL}${BASE_URL}`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/dashboard\/eleve\/programme\/maths(?:[?#]|$)/);
  });

  test('student access never falls through to the staff programme', async ({ page }) => {
    await loginViaUi(page, 'student');
    await page.goto(`${APP_URL}${BASE_URL}`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/dashboard\/eleve\/programme\/maths(?:[?#]|$)/);
  });

  test('coach can access the page', async ({ page }) => {
    await loginViaUi(page, 'coach');
    await page.goto(`${APP_URL}${BASE_URL}`, { waitUntil: 'domcontentloaded' });

    await expectMathsPremierePage(page);
  });

  test('assistante can access the page', async ({ page }) => {
    await loginViaUi(page, 'assistante');
    await page.goto(`${APP_URL}${BASE_URL}`, { waitUntil: 'domcontentloaded' });

    await expectMathsPremierePage(page);
  });

  test('admin can access the page', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.goto(`${APP_URL}${BASE_URL}`, { waitUntil: 'domcontentloaded' });

    await expectMathsPremierePage(page);
  });
});
