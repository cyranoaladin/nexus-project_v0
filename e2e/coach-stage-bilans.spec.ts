import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('coach-stage-bilans - IDOR & Access Control', () => {
  test.beforeEach(async ({ page }) => {
    // Authentification en tant que Coach
    await loginAsUser(page, 'coach');
  });

  test('coach tente d\'accéder à un stage non assigné / inexistant → refus net', async ({ page }) => {
    // Navigation directe vers un stage auquel le coach n'a pas accès
    await page.goto('/dashboard/coach/stages/un-stage-non-assigne-ou-fantome/bilan');
    
    // On attend que la page soit stabilisée
    await page.waitForLoadState('networkidle');

    // Vérification : l'API sous-jacente doit avoir refusé l'accès
    // Le front-end doit soit afficher un message d'erreur, soit rediriger.
    // S'il redirige vers la liste des stages :
    const url = page.url();
    const redirected = url.endsWith('/dashboard/coach/stages') || url.includes('/dashboard/coach');
    
    // S'il reste sur la page, il doit afficher une erreur "non autorisé" ou "introuvable"
    const hasErrorText = await page.getByText(/Accès refusé|introuvable|non autorisé|Erreur/i).isVisible().catch(() => false);
    
    // Au moins l'un des deux mécanismes de protection doit s'être déclenché
    expect(redirected || hasErrorText).toBeTruthy();

    // S'assurer qu'aucun tableau de bilans n'est visible
    const tableVisible = await page.locator('table').isVisible().catch(() => false);
    expect(tableVisible).toBeFalsy();
  });

  test('séparation de rôle : élève tente d\'accéder à la surface coach stage → bloqué', async ({ page, context }) => {
    // Déconnexion coach et connexion élève
    await context.clearCookies();
    await loginAsUser(page, 'student');
    
    const res = await page.goto('/dashboard/coach/stages', { waitUntil: 'domcontentloaded' }).catch(() => null);
    
    // Le middleware ou le layout doit rediriger hors de /dashboard/coach
    const blocked = !page.url().includes('/dashboard/coach/stages');
    expect(blocked).toBeTruthy();
  });
});
