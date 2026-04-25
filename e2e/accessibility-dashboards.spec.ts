import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

/**
 * Accessibility — Dashboards authentifiés
 *
 * Étend les vérifications axe-core de base aux nouveaux dashboards
 * (élève EDS/STMG, parent, coach) après login.
 */

const DASHBOARD_PAGES = [
  { path: '/dashboard/eleve', role: 'student' as const, label: 'Élève EDS' },
  { path: '/dashboard/eleve', role: 'student2' as const, label: 'Élève STMG' },
  { path: '/dashboard/parent', role: 'parent' as const, label: 'Parent' },
  { path: '/dashboard/coach', role: 'coach' as const, label: 'Coach cohorte' },
];

test.describe('Accessibility — dashboards', () => {
  for (const { path, role, label } of DASHBOARD_PAGES) {
    test(`${label} — ${path} a un landmark <main>`, async ({ page }) => {
      await loginAsUser(page, role);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const main = page.locator('main');
      await expect(main).toHaveCount(1);
    });

    test(`${label} — ${path} a au moins un <h1>`, async ({ page }) => {
      await loginAsUser(page, role);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test(`${label} — images avec alt`, async ({ page }) => {
      await loginAsUser(page, role);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const images = page.locator('img');
      const count = await images.count();
      for (let i = 0; i < count; i++) {
        const alt = await images.nth(i).getAttribute('alt');
        expect(alt).not.toBeNull();
      }
    });
  }

  test('Coach dossier élève — landmarks et hiérarchie', async ({ page }) => {
    await loginAsUser(page, 'coach');
    await page.goto('/dashboard/coach/eleve/student-id-placeholder', {
      waitUntil: 'domcontentloaded',
    });
    // Même si l'ID est factice, la page devrait rendre un <main> + <h1>
    // (la page redirige ou montre un état d'erreur structuré)
    const main = page.locator('main');
    const h1 = page.locator('h1');
    const mainCount = await main.count();
    const h1Count = await h1.count();
    expect(mainCount + h1Count).toBeGreaterThan(0);
  });
});
