import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

/**
 * E2E tests: coach Maths Première Stage Printemps report API
 * Regression: POST /api/coach/maths-premiere-stage-printemps/students/[id]/report
 * was returning 400 due to Zod max() limits too restrictive for free-text inputs.
 */

const STUDENT_ID = 'cmomlhr20000jnx0u216pmr44';
const REPORT_URL = `/api/coach/maths-premiere-stage-printemps/students/${STUDENT_ID}/report`;

test.describe('coach maths-premiere-stage-printemps report API', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'coach');
  });

  test('POST with minimal draft payload returns 200, not 400', async ({ page }) => {
    const response = await page.request.post(REPORT_URL, {
      data: { action: 'draft' },
    });
    // Should be 200 (saved), 404 (student not found), or 403 (guard) — never 400
    expect([200, 403, 404]).toContain(response.status());
    if (response.status() === 400) {
      const body = await response.json();
      throw new Error(`Got 400 — Zod validation failed: ${JSON.stringify(body.details)}`);
    }
  });

  test('[REGRESSION] POST with long free-text fields does not return 400', async ({ page }) => {
    const longMethodsItem = 'Bien maîtriser la dérivée d\'un produit en appliquant la formule correctement, en vérifiant les conditions de dérivabilité sur l\'intervalle et en détaillant toutes les étapes du calcul intermédiaire';
    const longMainCoachMessage = 'L\'élève a montré une progression remarquable sur les chapitres de dérivation et de second degré, mais reste fragile sur les probabilités conditionnelles et les suites numériques. Il faut continuer le travail sur la rigueur rédactionnelle et la gestion du temps lors des épreuves. Avec de la régularité, les résultats devraient s\'améliorer significativement d\'ici les examens de spécialité.';
    const longParentMessage = 'Votre enfant a bien travaillé durant ce stage intensif et a montré une réelle volonté de progresser en mathématiques. Nous recommandons vivement de continuer les exercices réguliers à la maison, en particulier sur les probabilités conditionnelles. Un accompagnement ponctuel serait très bénéfique avant les épreuves de spécialité mathématiques.';
    const longDoNotSay = 'Ne pas mentionner les mauvaises notes obtenues en classe durant l\'année scolaire, ni faire de comparaison négative avec d\'autres élèves de la classe, ni remettre en question les méthodes pédagogiques des professeurs du lycée actuel.';

    expect(longMethodsItem.length).toBeGreaterThan(100);
    expect(longMainCoachMessage.length).toBeGreaterThan(300);
    expect(longParentMessage.length).toBeGreaterThan(300);
    expect(longDoNotSay.length).toBeGreaterThan(200);

    const response = await page.request.post(REPORT_URL, {
      data: {
        action: 'draft',
        globalDiagnostic: {
          overallProfile: 'STEADY_PROGRESS',
          workPace: 'FAST_BUT_CARELESS',
          mainCoachMessage: longMainCoachMessage,
        },
        chapterDiagnostics: {
          derivation: {
            mastery: 3,
            methodsAcquired: [longMethodsItem],
            vigilancePoints: ['Oublie parfois de vérifier si la fonction est bien dérivable sur l\'intervalle donné avant de commencer le calcul de la dérivée'],
            recurringErrors: ['Confusion entre dérivée d\'un produit et dérivée d\'une somme lors de calculs complexes avec plusieurs fonctions composées'],
            priorityRemediation: 'Il faut absolument retravailler la méthode de dérivation des fonctions composées en insistant sur la règle de la chaîne et la vérification systématique des domaines de dérivabilité avant tout calcul.',
          },
        },
        parentRecommendations: {
          parentTone: 'BALANCED',
          parentUrgency: 'WATCH',
          parentMainMessage: longParentMessage,
          parentDoNotSay: longDoNotSay,
        },
      },
    });

    // Never 400 — may be 200 (saved), 404 (student not in this e2e env), or 403 (guard)
    expect([200, 403, 404]).toContain(response.status());
    if (response.status() === 400) {
      const body = await response.json();
      throw new Error(`[REGRESSION] Got 400 — long fields rejected: ${JSON.stringify(body.details)}`);
    }
  });

  test('GET report returns 200 or 404, never 500', async ({ page }) => {
    const response = await page.request.get(REPORT_URL);
    expect([200, 403, 404]).toContain(response.status());
  });

  test('unauthenticated request to report API returns 401', async ({ page, context }) => {
    await context.clearCookies();
    const response = await page.request.post(REPORT_URL, {
      data: { action: 'draft' },
    });
    expect(response.status()).toBe(401);
  });

  test('student role cannot access coach report endpoint', async ({ page, context }) => {
    await context.clearCookies();
    await loginAsUser(page, 'student');
    const response = await page.request.post(REPORT_URL, {
      data: { action: 'draft' },
    });
    expect([401, 403]).toContain(response.status());
  });
});
