import { test, expect, Page } from '@playwright/test';

/**
 * E2E — Workflow COACH → RESSOURCE → ÉLÈVE (P1)
 *
 * Skippé par défaut. À activer dès qu'un `coach_student_assignments` actif existe
 * en production/staging, en fournissant les variables d'environnement :
 *   RUN_COACH_RESOURCE_E2E=1
 *   TEST_COACH_EMAIL                 (coach assigné à TEST_STUDENT_ASSIGNED)
 *   TEST_COACH_PWD
 *   TEST_STUDENT_ASSIGNED_EMAIL      (élève assigné au coach)
 *   TEST_STUDENT_ASSIGNED_PWD
 *   TEST_STUDENT_OTHER_EMAIL         (élève NON assigné, contrôle négatif)
 *   TEST_STUDENT_OTHER_PWD
 *
 * Référence checklist : docs/qa/COACH_RESOURCE_STUDENT_E2E_CHECKLIST.md
 */

const RUN = process.env.RUN_COACH_RESOURCE_E2E === '1';
const COACH_EMAIL = process.env.TEST_COACH_EMAIL || '';
const COACH_PWD = process.env.TEST_COACH_PWD || '';
const STUDENT_ASSIGNED_EMAIL = process.env.TEST_STUDENT_ASSIGNED_EMAIL || '';
const STUDENT_ASSIGNED_PWD = process.env.TEST_STUDENT_ASSIGNED_PWD || '';
const STUDENT_OTHER_EMAIL = process.env.TEST_STUDENT_OTHER_EMAIL || '';
const STUDENT_OTHER_PWD = process.env.TEST_STUDENT_OTHER_PWD || '';

const RESOURCE_TITLE = 'RECETTE - Ressource coach vers élève';

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/signin', { waitUntil: 'load' });
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('btn-signin').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

async function logout(page: Page) {
  await page.context().clearCookies();
}

test.describe('E2E — Coach → Ressource → Élève (P1)', () => {
  test.skip(
    !RUN ||
      !COACH_EMAIL ||
      !COACH_PWD ||
      !STUDENT_ASSIGNED_EMAIL ||
      !STUDENT_ASSIGNED_PWD ||
      !STUDENT_OTHER_EMAIL ||
      !STUDENT_OTHER_PWD,
    'RUN_COACH_RESOURCE_E2E != 1 ou variables de recette manquantes — test désactivé tant qu\'aucun assignment réel n\'existe',
  );

  let consoleErrors: string[] = [];
  let httpErrors: string[] = [];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    httpErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('response', (r) => {
      if (r.status() >= 500) httpErrors.push(`HTTP ${r.status()} ${r.url()}`);
    });
  });

  test('1. Coach voit uniquement ses élèves assignés', async ({ page }) => {
    await login(page, COACH_EMAIL, COACH_PWD);
    await page.goto('/dashboard/coach/students');
    await page.waitForLoadState('networkidle');

    const body = (await page.textContent('body')) || '';
    expect(body, 'élève assigné doit apparaître').toContain(STUDENT_ASSIGNED_EMAIL.split('@')[0]);
    expect(body, 'élève non assigné ne doit pas apparaître').not.toContain(
      STUDENT_OTHER_EMAIL.split('@')[0],
    );

    expect(httpErrors, `HTTP ≥500 détectés : ${httpErrors.join(', ')}`).toHaveLength(0);
  });

  test('2. Coach ouvre le dossier de son élève (200) et crée une ressource', async ({ page }) => {
    await login(page, COACH_EMAIL, COACH_PWD);
    await page.goto('/dashboard/coach/students');
    await page.waitForLoadState('networkidle');

    // Cliquer sur le premier lien élève assigné
    const studentLink = page
      .locator(`a[href*="/dashboard/coach/students/"]`)
      .filter({ hasText: STUDENT_ASSIGNED_EMAIL.split('@')[0] })
      .first();
    await studentLink.click();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toMatch(/\/dashboard\/coach\/students\/[^/]+/);

    // TODO: à compléter quand l'UI de dépôt de ressource est finalisée
    // await page.getByTestId('btn-add-resource').click();
    // await page.getByTestId('input-resource-title').fill(RESOURCE_TITLE);
    // await page.getByTestId('btn-resource-submit').click();
    // await expect(page.getByText(RESOURCE_TITLE)).toBeVisible();

    expect(httpErrors).toHaveLength(0);
  });

  test('3. Élève assigné voit la ressource', async ({ page }) => {
    await login(page, STUDENT_ASSIGNED_EMAIL, STUDENT_ASSIGNED_PWD);
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    // TODO: adapter quand la route de listing documents élève est confirmée
    // const body = (await page.textContent('body')) || '';
    // expect(body).toContain(RESOURCE_TITLE);

    expect(httpErrors).toHaveLength(0);
  });

  test('4. Élève NON assigné ne voit PAS la ressource', async ({ page }) => {
    await login(page, STUDENT_OTHER_EMAIL, STUDENT_OTHER_PWD);
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    const body = (await page.textContent('body')) || '';
    expect(body, 'ressource doit être invisible pour un autre élève').not.toContain(RESOURCE_TITLE);

    expect(httpErrors).toHaveLength(0);
  });

  test('5. Accès direct coach non assigné au dossier élève cible → 403/redirect', async ({
    page,
  }) => {
    // Ce test suppose qu'un second coach de recette existe, non assigné à STUDENT_ASSIGNED.
    // À compléter si un TEST_OTHER_COACH_EMAIL est fourni.
    test.skip(!process.env.TEST_OTHER_COACH_EMAIL, 'pas de second coach fourni');
    // ... cf checklist section 6
  });

  test.afterEach(() => {
    expect(
      consoleErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !e.includes('ResizeObserver') &&
          !e.includes('Hydration') &&
          !e.includes('Warning') &&
          !e.includes('NEXT_REDIRECT'),
      ),
      `Erreurs console inattendues : ${consoleErrors.join(' | ')}`,
    ).toHaveLength(0);
  });
});
