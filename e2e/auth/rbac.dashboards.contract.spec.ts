import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

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
    '/dashboard/eleve/sessions',
    '/dashboard/eleve/ressources',
  ],
  // Task 17 (golden-family scenario) exercised ASSISTANTE extensively
  // (family creation, academic maps, assignments, planning series) without
  // this contract ever asserting its own dashboard-route boundary — the only
  // one of the two staff roles previously covered here was ADMIN. Closing
  // that gap, not duplicating core-golden-family.spec.ts's business-flow
  // coverage.
  assistante: [
    '/dashboard/assistante',
    '/dashboard/assistante/planning',
    '/dashboard/assistante/students',
    '/dashboard/assistante/assignments',
    '/dashboard/assistante/coaches',
  ],
} as const;

const FORBIDDEN_PROBES = {
  admin: ['/dashboard/parent'],
  parent: ['/dashboard/admin', '/dashboard/coach', '/dashboard/eleve'],
  coach: ['/dashboard/admin', '/dashboard/parent', '/dashboard/eleve'],
  student: ['/dashboard/admin', '/dashboard/parent', '/dashboard/coach'],
  assistante: ['/dashboard/admin', '/dashboard/parent', '/dashboard/coach', '/dashboard/eleve'],
} as const;

test.describe('RBAC dashboards - contrat', () => {
  for (const [role, allowedRoutes] of Object.entries(ROLE_PATHS) as Array<
    ['admin' | 'parent' | 'coach' | 'student' | 'assistante', readonly string[]]
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
        await page.goto(forbiddenRoute, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(new RegExp(`${ROLE_PATHS[role][0]}(?:[/?#]|$)`));
      }
    });
  }

  test('logout UI après vérification différée ferme la session et refuse le dashboard', async ({ page }) => {
    await loginAsUser(page, 'parent');
    // Hold a real canonical request: reaching the URL is not rendered readiness.
    let releaseSession!: () => void;
    const sessionGate = new Promise<void>((resolve) => { releaseSession = resolve; });
    let markSessionHeld!: () => void;
    const sessionHeld = new Promise<void>((resolve) => { markSessionHeld = resolve; });
    await page.route('**/api/auth/session', async (route) => {
      markSessionHeld();
      await sessionGate;
      await route.continue();
    });
    try {
      await page.goto('/dashboard/parent');
      await sessionHeld;
      await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'LOADING');
    } finally {
      releaseSession();
      await page.unrouteAll({ behavior: 'wait' });
    }
    await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
    await expect(page.getByRole('heading', { name: 'Espace Famille', exact: true })).toBeVisible();

    let signOutRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/auth/signout') {
        signOutRequests += 1;
      }
    });
    const signOutResponse = page.waitForResponse((response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/signout'
    );
    await page.getByRole('button', { name: 'Déconnexion', exact: true }).click();
    expect((await signOutResponse).ok()).toBeTruthy();
    // Product logout returns home. No helper POST or cookie deletion may mask it.
    await expect(page).toHaveURL(new URL('/', page.url()).href);
    const sessionResponse = await page.request.get('/api/auth/session');
    expect(sessionResponse.ok()).toBeTruthy();
    expect(await sessionResponse.json()).toBeNull();

    const dashboardRes = await page.request.get('/dashboard/parent', {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    const location = dashboardRes.headers()['location'] || '';
    expect([302, 303, 307, 308]).toContain(dashboardRes.status());
    expect(location).toContain('/auth/signin');
    await page.goto('/dashboard/parent');
    await expect(page).toHaveURL(/\/auth\/signin(?:[/?#]|$)/);
    expect(signOutRequests).toBe(1);
  });
});
