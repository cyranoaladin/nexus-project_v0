/**
 * Nexus Planning Studio — matrice d'accès réelle (middleware + auth).
 *
 * Vérifie, avec le vrai middleware Next et de vrais comptes seedés :
 *   - anonyme → redirection /auth/signin avec callbackUrl vers /planning ;
 *   - PARENT / ELEVE → renvoyés vers leur tableau de bord ;
 *   - ADMIN / ASSISTANTE / COACH → grille du planning rendue ;
 *   - chaque asset statique déployé est protégé de la même manière ;
 *   - le retour après connexion aboutit bien sur /planning.
 *
 * Pré-requis : app démarrée avec middleware actif (pas SKIP_MIDDLEWARE) et
 * e2e/.credentials.json produit par scripts/seed-e2e-db.ts.
 */
import { test, expect, type Page } from '@playwright/test';
import { logoutUser, type UserType } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const BASE_URL_HOST = new URL(BASE_URL).hostname;

/**
 * Connexion par le vrai flux NextAuth (CSRF → callback credentials), sans
 * remise à zéro du limiteur : cette matrice n'effectue que quelques connexions
 * et doit pouvoir tourner hors du stack Docker (Redis local quelconque).
 */
async function loginAsUser(page: Page, role: UserType) {
  const { email, password } = CREDS[role];
  await page.context().clearCookies();
  const csrfRes = await page.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const res = await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password, callbackUrl: `${BASE_URL}/planning`, json: 'true' },
    maxRedirects: 0,
  });
  expect([200, 302], `login ${role}`).toContain(res.status());
  const session = await page.request.get(`${BASE_URL}/api/auth/session`);
  const body = (await session.json()) as { user?: { email?: string } };
  expect(body.user?.email?.toLowerCase(), `session ${role}`).toBe(email.toLowerCase());
  void BASE_URL_HOST;
}

const PLANNING_PATHS = [
  '/planning',
  '/planning/index.html',
  '/planning/assets/app.js',
  '/planning/assets/styles.css',
  '/planning/data/default-data.js',
  '/planning/data/planning.default.json',
];

async function statusAndLocation(page: Page, path: string) {
  const res = await page.request.get(path, { maxRedirects: 0 });
  return { status: res.status(), location: res.headers()['location'] ?? '' };
}

test.describe('Planning Studio — anonyme', () => {
  test('tous les chemins sont redirigés vers la connexion avec callbackUrl', async ({ page }) => {
    await page.context().clearCookies();
    for (const path of PLANNING_PATHS) {
      const { status, location } = await statusAndLocation(page, path);
      expect(status, path).toBe(307);
      expect(location, path).toContain('/auth/signin?callbackUrl=');
      expect(decodeURIComponent(location), path).toContain(path);
    }
  });

  test('/planning/ (barre finale) rejoint /planning puis la connexion', async ({ page }) => {
    await page.context().clearCookies();
    const res = await page.request.get('/planning/', { maxRedirects: 0 });
    expect([307, 308]).toContain(res.status());
  });
});

for (const role of ['parent', 'student'] as UserType[]) {
  test.describe(`Planning Studio — ${role} (refusé)`, () => {
    test('renvoyé vers son tableau de bord, aucun asset servi', async ({ page }) => {
      await loginAsUser(page, role);
      for (const path of PLANNING_PATHS) {
        const { status, location } = await statusAndLocation(page, path);
        expect(status, path).toBe(307);
        expect(location, path).toMatch(/\/dashboard\/(parent|eleve)/);
      }
      await page.goto('/planning');
      await expect(page).toHaveURL(/\/dashboard\/(parent|eleve)/);
      await logoutUser(page);
    });
  });
}

for (const role of ['admin', 'assistante', 'coach'] as UserType[]) {
  test.describe(`Planning Studio — ${role} (autorisé)`, () => {
    test('grille rendue et assets servis', async ({ page }) => {
      await loginAsUser(page, role);
      for (const path of PLANNING_PATHS) {
        const { status } = await statusAndLocation(page, path);
        expect(status, path).toBe(200);
      }
      await page.goto('/planning');
      await expect(page).toHaveURL(/\/planning$/);
      await expect(page).toHaveTitle(/Nexus Planning Studio/);
      await expect(page.locator('.card').first()).toBeVisible();
      const cards = await page.locator('.card').count();
      expect(cards).toBeGreaterThanOrEqual(44);
      await logoutUser(page);
    });
  });
}

test.describe('Planning Studio — retour après connexion', () => {
  test('anonyme → formulaire → /planning (callbackUrl honoré, pas de boucle)', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/planning');
    await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=%2Fplanning/);
    const { email, password } = CREDS.assistante;
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await Promise.all([
      page.waitForURL(/\/planning$/, { timeout: 30_000 }),
      page.getByTestId('btn-signin').click(),
    ]);
    await expect(page.locator('.card').first()).toBeVisible();
    await logoutUser(page);
  });

  test('lien « Planning hebdomadaire » du tableau de bord assistante', async ({ page }) => {
    await loginAsUser(page, 'assistante');
    await page.goto('/dashboard/assistante', { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[href="/planning"]').first();
    await expect(link).toBeVisible();
    await Promise.all([page.waitForURL(/\/planning$/), link.click()]);
    await expect(page.locator('.card').first()).toBeVisible();
    await logoutUser(page);
  });
});
