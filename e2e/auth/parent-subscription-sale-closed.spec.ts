import { expect, type Page, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

/**
 * La vente d'abonnements et d'add-ons ARIA est fermée.
 *
 * Ce fichier remplace `parent-subscription-requests-visible.spec.ts`, qui
 * prouvait le chemin inverse : qu'une demande d'abonnement partie de l'espace
 * parent arrivait bien dans la file de l'assistante. Ce chemin a été fermé
 * volontairement — les trois formules et les deux add-ons reposent sur ARIA,
 * qui ne délivre aucune matière. Le parcours n'est donc plus « visible dans la
 * file », il doit être refusé.
 *
 * Les deux tests couvrent les deux moitiés de la fermeture, car retirer les
 * boutons sans fermer l'API laisserait passer une requête forgée.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3002';

async function selectYasmine(page: Page) {
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: /Yasmine Dupont/i }).click();
  await expect(page.getByText(/Formule actuelle - Yasmine/i)).toBeVisible();
}

test("l'espace parent ne propose plus de souscrire un abonnement ni un add-on", async ({ page }) => {
  test.setTimeout(60_000);

  await loginAsUser(page, 'parent', { targetPath: '/dashboard/parent/abonnements' });
  await expect(page.getByRole('heading', { name: /Formules et accompagnements/i })).toBeVisible();
  await selectYasmine(page);

  // Plus aucun bouton de souscription : ni changement de formule, ni add-on.
  await expect(page.getByRole('button', { name: /Changer pour/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Ajouter cet Add-on/i })).toHaveCount(0);

  // À la place, le vrai chemin d'inscription est proposé.
  await expect(page.getByRole('heading', { name: /Inscrire Yasmine à un parcours/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /En parler avec un conseiller/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Voir tous les parcours/i })).toBeVisible();
});

test('une demande forgée est refusée par le serveur, pas seulement masquée', async ({ page }) => {
  test.setTimeout(60_000);

  await loginAsUser(page, 'parent', { targetPath: '/dashboard/parent/abonnements' });

  for (const payload of [
    { requestType: 'PLAN_CHANGE', planName: 'ACCES_PLATEFORME' },
    { requestType: 'ARIA_ADDON', planName: 'ANALYSE_APPROFONDIE' },
  ]) {
    const response = await page.request.post(`${BASE}/api/parent/subscription-requests`, {
      data: { studentId: 'any-student', ...payload },
    });

    expect(response.status(), `${payload.requestType} doit être refusé`).toBe(409);
    expect((await response.json()).code).toBe('SALE_SUSPENDED');
  }
});
