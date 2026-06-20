import { expect, test } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:3000';
const BASE_URL = '/programme/maths-1ere';
const APP_HOST = new URL(APP_URL).hostname;

const STATIC_CREDS = {
  parent: { email: 'parent@example.com', password: 'admin123' },
  student: { email: 'student@example.com', password: 'admin123' },
  student2: { email: 'student2@example.com', password: 'admin123' },
  coach: { email: 'helios@nexus-reussite.com', password: 'admin123' },
  assistante: { email: 'assistante@nexus-reussite.com', password: 'admin123' },
  admin: { email: 'admin@nexus-reussite.com', password: 'admin123' },
} as const;

async function expectMathsPremierePage(page: import('@playwright/test').Page) {
  await expect(page).toHaveURL(/127\.0\.0\.1:3000\/programme\/maths-1ere/);
  await expect(page.getByText(/NEXUS MATHS LAB/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: /Tableau de bord/i })).toBeVisible();
}

async function loginViaUi(
  page: import('@playwright/test').Page,
  role: keyof typeof STATIC_CREDS
) {
  const { email, password } = STATIC_CREDS[role];
  const csrfResponse = await page.request.get(`${APP_URL}/api/auth/csrf`, {
    timeout: 15000,
  });
  const csrfJson = (await csrfResponse.json()) as { csrfToken: string };
  const csrfCookies = getSetCookieHeaders(csrfResponse).flatMap(parseSetCookie);

  const callbackResponse = await page.request.post(`${APP_URL}/api/auth/callback/credentials`, {
    form: {
      csrfToken: csrfJson.csrfToken,
      email,
      password,
      callbackUrl: `${APP_URL}/dashboard`,
      json: 'true',
    },
    headers: {
      cookie: csrfCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
    },
    timeout: 15000,
  });

  const authCookies = [...csrfCookies, ...getSetCookieHeaders(callbackResponse).flatMap(parseSetCookie)]
    .map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: APP_HOST,
      path: cookie.path || '/',
      httpOnly: true,
      sameSite: 'Lax' as const,
    }))
    .filter((cookie) => cookie.name && cookie.value);

  await page.context().addCookies(authCookies);
}

function parseSetCookie(setCookieHeader?: string | string[]) {
  if (!setCookieHeader) return [];
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader.join(',') : setCookieHeader;
  return raw
    .split(/,(?=[^;]+?=)/)
    .map((cookieStr) => {
      const [pair, ...attrs] = cookieStr.split(';').map((part) => part.trim());
      const [name, value] = pair.split('=');
      const pathAttr = attrs.find((attr) => attr.toLowerCase().startsWith('path='));
      const path = pathAttr ? pathAttr.split('=')[1] : '/';
      if (!name || typeof value === 'undefined') {
        return null;
      }
      return { name, value, path };
    })
    .filter((cookie): cookie is { name: string; value: string; path: string } => !!cookie);
}

function getSetCookieHeaders(response: { headersArray: () => { name: string; value: string }[] }) {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value);
}

test.describe('Maths 1ere access control and navigation', () => {
  test('parent can access and navigate the main tabs', async ({ page }) => {
    await loginViaUi(page, 'parent');
    await page.goto(`${APP_URL}${BASE_URL}`, { waitUntil: 'domcontentloaded' });

    await expectMathsPremierePage(page);

    await page.getByRole('button', { name: /Fiches de cours/i }).click();
    await expect(page.getByText(/Dérivation|Second Degré|Suites/i).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Quiz & exos/i }).click();
    await expect(page.getByText(/Partie Automatismes|Session thématique|Simulation EAM/i).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Formulaire/i }).click();
    await expect(page.getByText(/Formulaire de Première/i)).toBeVisible({ timeout: 15000 });
  });

  test('Premiere student can access the page', async ({ page }) => {
    await loginViaUi(page, 'student2');
    await page.goto(`${APP_URL}${BASE_URL}`, { waitUntil: 'domcontentloaded' });

    await expectMathsPremierePage(page);
  });

  test('non-Premiere student is redirected to the student dashboard', async ({ page }) => {
    await loginViaUi(page, 'student');
    await page.goto(`${APP_URL}${BASE_URL}`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/127\.0\.0\.1:3000\/dashboard\/eleve/);
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
