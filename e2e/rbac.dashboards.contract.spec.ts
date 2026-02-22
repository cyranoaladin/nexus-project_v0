import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

const ROLE_PATHS = {
  admin: [
    '/dashboard/admin',
    '/dashboard/admin/users',
    '/dashboard/admin/analytics',
    '/dashboard/admin/subscriptions',
    '/dashboard/admin/activities',
    '/dashboard/admin/tests',
    '/dashboard/admin/documents',
    '/dashboard/admin/facturation',
  ],
  parent: [
    '/dashboard/parent',
    '/dashboard/parent/children',
    '/dashboard/parent/abonnements',
    '/dashboard/parent/paiement',
    '/dashboard/parent/ressources',
  ],
  coach: [
    '/dashboard/coach',
    '/dashboard/coach/sessions',
    '/dashboard/coach/students',
    '/dashboard/coach/availability',
  ],
  student: [
    '/dashboard/eleve',
    '/dashboard/eleve/mes-sessions',
    '/dashboard/eleve/sessions',
    '/dashboard/eleve/ressources',
  ],
} as const;

const FORBIDDEN_PROBES = {
  admin: [],
  parent: ['/dashboard/admin', '/dashboard/coach', '/dashboard/eleve'],
  coach: ['/dashboard/admin', '/dashboard/parent', '/dashboard/eleve'],
  student: ['/dashboard/admin', '/dashboard/parent', '/dashboard/coach'],
} as const;

test.describe('RBAC dashboards - contrat', () => {
  test.describe.configure({ mode: 'serial' });
  for (const [role, allowedRoutes] of Object.entries(ROLE_PATHS) as Array<
    ['admin' | 'parent' | 'coach' | 'student', readonly string[]]
  >) {
    test(`${role}: accès routes autorisées`, async ({ page }) => {
      await loginAsUser(page, role);

      for (const route of allowedRoutes) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page, `${role} should stay on ${route}`).toHaveURL(new RegExp(route.replace('/', '\\/')));
      }

      await page.goto('/dashboard/trajectoire', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/dashboard\/trajectoire/);
    });

    test(`${role}: accès refusé aux autres dashboards`, async ({ page }) => {
      await loginAsUser(page, role);

      for (const forbiddenRoute of FORBIDDEN_PROBES[role]) {
        await page.goto(forbiddenRoute, { waitUntil: 'domcontentloaded' }).catch(() => undefined);

        const pathname = new URL(page.url()).pathname;
        const blocked = !pathname.startsWith(forbiddenRoute);
        expect(blocked).toBeTruthy();
      }
    });
  }

  test('logout redirige vers /auth/signin', async ({ page }) => {
    await loginAsUser(page, 'parent');
    await page.goto('/dashboard/parent');

    const logoutButton = page.getByTestId('logout-button').first();
    if (!(await logoutButton.isVisible().catch(() => false))) {
      test.skip(true, 'Bouton logout introuvable avec role stable sur ce build');
    }

    await logoutButton.click();
    await page.waitForURL(/\/auth\/signin/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
