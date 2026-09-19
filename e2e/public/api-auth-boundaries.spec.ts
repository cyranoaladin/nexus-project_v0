import { expect, test } from '@playwright/test';

/**
 * Les frontières d'authentification des routes d'administration, vues depuis
 * le réseau.
 *
 * Reprise de `__tests__/e2e/nexus-2-0-smoke.spec.ts`, un spec Playwright posé
 * hors de tout `testDir` : aucune configuration ne le collectait, donc rien ne
 * l'exécutait — ces garde-fous n'ont jamais gaté une fusion.
 *
 * Les mêmes routes ont des tests de route dédiés
 * (`__tests__/api/admin.directeur.stats.route.test.ts`,
 * `__tests__/api/admin.recompute-ssn.route.test.ts`,
 * `__tests__/rbac/complete-matrix.test.ts`), qui appellent le handler
 * directement. Ils prouvent la décision du garde ; ils ne prouvent pas que la
 * requête arrive jusqu'à lui — middleware, en-têtes et rendu compris. C'est ce
 * que ce fichier ajoute, et seulement cela.
 *
 * Ce qui n'est pas repris du spec d'origine : la soumission d'un bilan
 * renvoyant 201, qui dépend d'un jeu de questions semé et qu'un test de route
 * couvre déjà (`__tests__/api/assessments-submit.test.ts`) ; et une connexion
 * administrateur dont la seule assertion finale était que le corps de la page
 * n'était pas vide, là où `e2e/auth/admin-dashboard-audit.spec.ts` vérifie
 * réellement le tableau de bord.
 */
test.describe('Frontières d’authentification des API d’administration', () => {
  test('GET /api/admin/directeur/stats refuse une requête sans session', async ({ request }) => {
    const response = await request.get('/api/admin/directeur/stats');

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
  });

  test('POST /api/admin/recompute-ssn refuse une requête sans session', async ({ request }) => {
    const response = await request.post('/api/admin/recompute-ssn', {
      data: { type: 'MATHS' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
  });

  test('le refus précède toute lecture de données', async ({ request }) => {
    // Un corps invalide et une absence de session : c'est l'absence de session
    // qui doit décider, sinon la validation du corps fuirait l'existence de la
    // route à un appelant non authentifié.
    const response = await request.post('/api/admin/recompute-ssn', {
      data: { type: 'CE_TYPE_N_EXISTE_PAS' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
  });
});
