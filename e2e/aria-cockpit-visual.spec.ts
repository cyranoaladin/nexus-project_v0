/**
 * QA visuelle du cockpit ARIA (§35).
 *
 * L'authentification est RÉELLE (parcours next-auth complet, comme les autres
 * specs du dépôt) : la garde serveur de `app/dashboard/layout.tsx` est donc
 * bien exercée. Seul le payload du cockpit est stubé, à partir d'une fixture
 * dont la carte scolaire et les graphes de compétences sont produits par le
 * vrai resolver — la fixture ne peut donc pas diverger du catalogue.
 *
 * Trois garanties sont vérifiées à chaque capture :
 *   1. aucune erreur console,
 *   2. aucun débordement horizontal,
 *   3. le contenu attendu est réellement rendu.
 */

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { CREDS } from './helpers/credentials';

const FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'e2e/fixtures/aria/cockpit-terminale-eds.json'),
    'utf-8',
  ),
);

const SHOTS_DIR = 'e2e/screenshots/aria-cockpit';

type CockpitOverride = (payload: Record<string, unknown>) => Record<string, unknown>;

/** Stub du seul payload cockpit : l'authentification reste réelle. */
async function stubCockpit(page: Page, override?: CockpitOverride) {
  const payload = override ? override(structuredClone(FIXTURE)) : FIXTURE;
  await page.route('**/api/aria/cockpit*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }),
  );
}

/**
 * Connexion réelle en tant qu'élève, via le parcours NextAuth credentials.
 *
 * Le helper partagé `loginAsUser` n'est volontairement pas utilisé : il purge
 * d'abord les compteurs de rate-limit, ce qui exige la pile Docker jetable
 * (hôte Redis `redis-e2e`). Ce garde-fou est légitime et n'est pas contourné ;
 * la pile locale étant fraîche, aucune purge n'est nécessaire.
 */
/**
 * Cookies de session mis en cache : une seule authentification pour tout le
 * fichier. Les tentatives de connexion sont comptées côté serveur, et rien ne
 * justifie de se reconnecter pour chaque capture.
 */
type SessionCookies = Awaited<ReturnType<BrowserContext['cookies']>>;
let cachedSessionCookies: SessionCookies | null = null;

async function signInAsStudent(page: Page) {
  if (cachedSessionCookies) {
    await page.context().addCookies(cachedSessionCookies);
    return;
  }

  const baseUrl = test.info().project.use.baseURL!;
  const host = new URL(baseUrl).hostname;
  const { email, password } = CREDS.student;

  const csrfResponse = await page.request.get(`${baseUrl}/api/auth/csrf`);
  expect(csrfResponse.ok()).toBe(true);
  await installCookies(page, csrfResponse, host);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const callback = await page.request.post(`${baseUrl}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password, callbackUrl: baseUrl, json: 'true' },
    maxRedirects: 0,
  });
  expect([200, 302]).toContain(callback.status());
  const installed = await installCookies(page, callback, host);
  expect(installed.some((name) => name.includes('session-token'))).toBe(true);

  cachedSessionCookies = await page.context().cookies();
}

/**
 * Réinstalle les cookies `Set-Cookie` d'une réponse dans le contexte du
 * navigateur, en leur attribuant explicitement le domaine testé — étape que
 * le helper partagé du dépôt effectue aussi, et sans laquelle la session
 * n'est pas systématiquement propagée.
 */
async function installCookies(
  page: Page,
  response: { headersArray: () => { name: string; value: string }[] },
  host: string,
): Promise<string[]> {
  const cookies = response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .flatMap((header) => header.value.split('\n'))
    .map((raw) => {
      const [pair, ...attributes] = raw.split(';');
      const separator = pair.indexOf('=');
      if (separator === -1) return null;
      const pathAttribute = attributes
        .map((attribute) => attribute.trim())
        .find((attribute) => attribute.toLowerCase().startsWith('path='));
      return {
        name: pair.slice(0, separator).trim(),
        value: pair.slice(separator + 1).trim(),
        domain: host,
        path: pathAttribute ? pathAttribute.slice('path='.length) : '/',
      };
    })
    .filter((cookie): cookie is NonNullable<typeof cookie> => cookie !== null && cookie.value !== '');

  if (cookies.length > 0) await page.context().addCookies(cookies);
  return cookies.map((cookie) => cookie.name);
}

/**
 * Ouvre le cockpit et vérifie que la garde serveur du layout dashboard a bien
 * laissé passer : une session invalide redirigerait vers /auth/signin.
 */
async function openCockpit(page: Page) {
  await page.goto('/dashboard/eleve/aria');
  await expect(page).not.toHaveURL(/\/auth\/signin/);
}

const ONBOARDING_OVERRIDE: CockpitOverride = (payload) => {
  const setup = payload.setup as Record<string, unknown>;
  const profile = payload.profile as Record<string, unknown>;
  setup.state = 'ONBOARDING_REQUIRED';
  setup.onboardingCompleted = false;
  profile.onboardingCompletedAt = null;
  return payload;
};

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
}

/** Aucun débordement horizontal du document (§19, §35). */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function capture(page: Page, name: string) {
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png`, fullPage: true });
}

const DESKTOP = { width: 1366, height: 768 };
const MOBILE = { width: 390, height: 844 };

test.describe('Cockpit ARIA — desktop 1366x768', () => {
  test.use({ viewport: DESKTOP });

  test('onboarding, puis les six sections', async ({ page }) => {
    const errors = watchConsole(page);

    // ── Onboarding (profil ARIA jamais configuré) ─────────────────────
    await signInAsStudent(page);
    await stubCockpit(page, ONBOARDING_OVERRIDE);
    await openCockpit(page);
    await expect(page.getByTestId('aria-setup-wizard')).toBeVisible();
    await capture(page, 'desktop-01-onboarding');

    // ── Cockpit configuré ─────────────────────────────────────────────
    await page.unrouteAll();
    await stubCockpit(page);
    await openCockpit(page);
    await expect(page.getByTestId('aria-cockpit-page')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Cockpit ARIA' })).toBeVisible();
    await capture(page, 'desktop-02-aujourdhui');

    await page.getByTestId('aria-nav-CURRICULUM').click();
    await expect(page.getByRole('heading', { name: 'Ma carte scolaire' })).toBeVisible();
    await capture(page, 'desktop-03-carte-scolaire');

    // ── Espace de travail Mathématiques ───────────────────────────────
    await page
      .getByTestId('aria-course-card-maths-terminale-eds')
      .getByRole('button', { name: 'Ouvrir' })
      .click();
    await expect(page.getByText('Domaines et compétences')).toBeVisible();
    await capture(page, 'desktop-04-workspace-maths');

    await page.getByTestId('aria-nav-RESOURCES').click();
    await expect(page.getByRole('heading', { name: 'Ressources', exact: true })).toBeVisible();
    await capture(page, 'desktop-05-ressources');

    await page.getByTestId('aria-nav-ASSESSMENTS').click();
    await expect(page.getByRole('heading', { name: /Évaluations/ })).toBeVisible();
    await capture(page, 'desktop-06-evaluations');

    await page.getByTestId('aria-nav-TRAJECTORY').click();
    await expect(page.getByRole('heading', { name: 'Mon parcours' })).toBeVisible();
    await capture(page, 'desktop-07-parcours');

    await page.getByTestId('aria-nav-ARIA').click();
    await expect(page.getByRole('heading', { name: 'ARIA', exact: true })).toBeVisible();
    await capture(page, 'desktop-08-aria');

    expect(errors).toEqual([]);
  });

  test('un cours verrouillé reste visible et signalé', async ({ page }) => {
    await signInAsStudent(page);
    await stubCockpit(page);
    await openCockpit(page);
    await page.getByTestId('aria-nav-CURRICULUM').click();

    const nsi = page.getByTestId('aria-course-card-nsi-terminale-eds');
    await expect(nsi).toBeVisible();
    await expect(nsi).toHaveAttribute('data-locked', 'true');
    await expect(nsi.getByText('Non inclus dans l’abonnement')).toBeVisible();
  });

  test('aucun score ni pourcentage fabriqué sur un bilan sans score', async ({ page }) => {
    await signInAsStudent(page);
    await stubCockpit(page);
    await openCockpit(page);
    await page.getByTestId('aria-nav-ASSESSMENTS').click();

    // Le bilan Maths a un score réel, le bilan NSI n'en a pas : rien n'est inventé.
    await expect(page.getByText('score 62/100')).toBeVisible();
    await expect(page.getByText('score null')).toHaveCount(0);
    await expect(page.getByText('NaN')).toHaveCount(0);
  });
});

test.describe('Cockpit ARIA — mobile 390x844', () => {
  test.use({ viewport: MOBILE });

  test('onboarding, aujourd’hui, carte et workspace sans débordement', async ({ page }) => {
    const errors = watchConsole(page);

    await signInAsStudent(page);
    await stubCockpit(page, ONBOARDING_OVERRIDE);
    await openCockpit(page);
    await expect(page.getByTestId('aria-setup-wizard')).toBeVisible();
    await capture(page, 'mobile-01-onboarding');

    await page.unrouteAll();
    await stubCockpit(page);
    await openCockpit(page);
    await expect(page.getByTestId('aria-cockpit-page')).toBeVisible();
    await capture(page, 'mobile-02-aujourdhui');

    await page.getByTestId('aria-nav-CURRICULUM').click();
    await expect(page.getByRole('heading', { name: 'Ma carte scolaire' })).toBeVisible();
    await capture(page, 'mobile-03-carte-scolaire');

    await page
      .getByTestId('aria-course-card-maths-terminale-eds')
      .getByRole('button', { name: 'Ouvrir' })
      .click();
    await expect(page.getByText('Domaines et compétences')).toBeVisible();
    await capture(page, 'mobile-04-workspace-maths');

    expect(errors).toEqual([]);
  });

  test('la navigation ne provoque aucun défilement horizontal', async ({ page }) => {
    await signInAsStudent(page);
    await stubCockpit(page);
    await openCockpit(page);

    const nav = page.getByRole('navigation', { name: 'Sections du cockpit' });
    await expect(nav).toBeVisible();

    // La barre passe à la ligne au lieu de défiler.
    const box = await nav.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(MOBILE.width);
    await expectNoHorizontalOverflow(page);
  });
});
