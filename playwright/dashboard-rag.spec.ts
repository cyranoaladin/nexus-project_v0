import { test, expect } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const studentEmail = process.env.E2E_STUDENT_EMAIL ?? 'student@test.local';
const studentPassword = process.env.E2E_STUDENT_PASSWORD ?? 'password';

test.describe('Dashboard RAG', () => {
  test('élève recherche une ressource et ouvre la fiche', async ({ page }) => {
    const csrfResponse = await page.request.get(`${baseURL}/api/auth/csrf`);
    expect(csrfResponse.ok()).toBeTruthy();
    const { csrfToken } = await csrfResponse.json();

    const authResponse = await page.request.post(`${baseURL}/api/auth/callback/credentials`, {
      form: {
        csrfToken,
        email: studentEmail,
        password: studentPassword,
        callbackUrl: `${baseURL}/dashboard`,
        json: 'true',
      },
    });
    expect(authResponse.ok()).toBeTruthy();

    await page.goto(`${baseURL}/dashboard`);
    const dashboardHeading = page.getByRole('heading', { name: /indicateurs clés/i });
    await expect(dashboardHeading).toBeVisible({ timeout: 15_000 });

    await page.goto(`${baseURL}/ressources`);
    const ressourcesHeading = page.getByRole('heading', { name: /bibliothèque/i });
    await expect(ressourcesHeading).toBeVisible({ timeout: 15_000 });

    const searchBox = page.getByPlaceholder(/Rechercher une ressource/i);
    await expect(searchBox).toBeVisible();
    await searchBox.fill('dérivées');
    await searchBox.press('Enter');

    const searchResponse = await page.waitForResponse((response) => {
      return response.url().includes('/pyapi/rag/search') && response.request().method() === 'GET';
    });
    expect(searchResponse.ok()).toBeTruthy();

    const firstCard = page
      .getByRole('link')
      .filter({ hasText: /Analyse - dérivées/i })
      .first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    await Promise.all([
      page.waitForURL(/\/rag\/doc\//, { timeout: 15_000 }),
      firstCard.click(),
    ]);

    await expect(page).toHaveURL(/\/rag\/doc\//);
    const docHeading = page.getByRole('heading', { level: 1, name: /dérivées/i });
    await expect(docHeading).toBeVisible({ timeout: 10_000 });
  });
});