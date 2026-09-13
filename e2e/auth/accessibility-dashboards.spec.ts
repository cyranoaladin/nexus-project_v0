import { test, expect, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

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

async function openRenderedDashboard(page: Page, role: typeof DASHBOARD_PAGES[number]['role'], path: string) {
  await loginAsUser(page, role);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // A loading shell can already contain a <main> and zero images. Audit the
  // actual role page only after its canonical identity and content are ready.
  await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
  const content = role === 'parent'
    ? page.getByRole('heading', { name: 'Espace Famille', exact: true })
    : role === 'coach'
      ? page.getByRole('heading', { name: /^Coach — / })
      : page.getByText('Espace Élève', { exact: true });
  await expect(content).toBeVisible();
}

test.describe('Accessibility — dashboards', () => {
  for (const { path, role, label } of DASHBOARD_PAGES) {
    test(`${label} — ${path} a un landmark <main>`, async ({ page }) => {
      await openRenderedDashboard(page, role, path);
      const main = page.locator('main');
      await expect(main).toHaveCount(1);
    });

    test(`${label} — ${path} a au moins un <h1>`, async ({ page }) => {
      await openRenderedDashboard(page, role, path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    });

    test(`${label} — images avec alt`, async ({ page }) => {
      await openRenderedDashboard(page, role, path);
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
    // The real dossier route sends a missing/inaccessible student back to the
    // cohort on 403/404. Inspect that completed destination, not its loader.
    await expect(page).toHaveURL(/\/dashboard\/coach$/);
    await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
    await expect(page.getByRole('heading', { name: /^Coach — / })).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });
});
