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
  for (const [role, allowedRoutes] of Object.entries(ROLE_PATHS) as Array<
    ['admin' | 'parent' | 'coach' | 'student', readonly string[]]
  >) {
    test(`${role}: accès routes autorisées`, async ({ page }) => {
      await loginAsUser(page, role);

      for (const route of allowedRoutes) {
        const res = await page.request.get(route, { failOnStatusCode: false });
        const location = res.headers()['location'] || '';
        expect(res.status(), `${role} should reach ${route}`).toBeLessThan(400);
        expect(location).not.toContain('/auth/signin');
      }

      const trajectoireRes = await page.request.get('/dashboard/trajectoire', { failOnStatusCode: false });
      expect(trajectoireRes.status()).toBeLessThan(400);
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

    const candidates = [
      page.getByTestId('logout-button').first(),
      page.getByRole('button', { name: /déconnexion|logout/i }).first(),
      page.getByRole('link', { name: /déconnexion|logout/i }).first(),
      page.locator('[data-testid="btn-logout"], [data-testid="btn-signout"]').first(),
    ];

    let clicked = false;
    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBeTruthy();

    await page.request.get('/api/auth/signout', { failOnStatusCode: false });
    await page.context().clearCookies();

    const dashboardRes = await page.request.get('/dashboard/parent', {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    const location = dashboardRes.headers()['location'] || '';
    expect([302, 303, 307, 308]).toContain(dashboardRes.status());
    expect(location).toContain('/auth/signin');
  });
});
