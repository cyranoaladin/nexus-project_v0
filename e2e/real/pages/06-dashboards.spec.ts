import { test, expect, Page } from '@playwright/test';
import { CREDS } from '@/e2e/helpers/credentials';

/**
 * REAL AUDIT — Dashboard pages (authenticated).
 * Tests real login → dashboard load → key elements → console/network errors.
 */

type DashboardPath = '/dashboard/admin' | '/dashboard/parent' | '/dashboard/eleve' | '/dashboard/coach';

function dashboardContent(page: Page, path: DashboardPath) {
  return {
    '/dashboard/admin': page.getByRole('heading', { name: 'Administration Nexus Réussite', exact: true }),
    '/dashboard/parent': page.getByRole('heading', { name: 'Espace Famille', exact: true }),
    '/dashboard/eleve': page.getByText('Espace Élève', { exact: true }),
    '/dashboard/coach': page.getByRole('heading', { name: /^Coach — / }),
  }[path];
}

/** URL/load events can precede canonical verification and dashboard data. */
async function loginAndGo(page: Page, email: string, password: string, expectedUrl: DashboardPath) {
  await page.goto('/auth/signin', { waitUntil: 'load' });
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('btn-signin').click();
  await page.waitForLoadState('load');
  await page.waitForURL(`**${expectedUrl}**`, { timeout: 30000 });
  await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
  await expect(dashboardContent(page, expectedUrl)).toBeVisible();
}

test('Dashboard readiness waits for delayed canonical verification, not only the URL', async ({ page }) => {
  let release!: () => void;
  let observed!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  const held = new Promise<void>(resolve => { observed = resolve; });
  await page.route('**/api/auth/session', async route => {
    if (new URL(page.url()).pathname === '/dashboard/admin') {
      observed();
      await released;
    }
    await route.continue();
  });
  let ready = false;
  const login = loginAndGo(page, CREDS.admin.email, CREDS.admin.password, '/dashboard/admin')
    .then(() => { ready = true; });
  const outcome = login.then(() => null, (error: Error) => error);
  try {
    await held;
    await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'LOADING');
    expect(ready, 'URL arrival alone must not declare the dashboard ready').toBe(false);
    release();
    expect(await outcome).toBeNull();
    await expect(page.getByRole('heading', { name: 'Administration Nexus Réussite', exact: true })).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
    await outcome;
  }
});

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────

test.describe('DASHBOARD — Admin (/dashboard/admin)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await loginAndGo(page, CREDS.admin.email, CREDS.admin.password, '/dashboard/admin');
  });

  test('Page charge et affiche contenu admin', async ({ page }) => {
    await expect(dashboardContent(page, '/dashboard/admin')).toBeVisible();
  });

  test('Navigation sidebar/header présente', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Navigation principale', exact: true })).toBeVisible();
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning') &&
        !e.includes('next-dev') && !e.includes('NEXT_REDIRECT') &&
        !e.includes('Framing') &&
        !e.includes('googletagmanager.com') &&
        !e.includes('Content Security Policy')
    );
    if (realErrors.length > 0) console.log('Admin console errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });
});

// ─── PARENT DASHBOARD ─────────────────────────────────────────────────────────

test.describe('DASHBOARD — Parent (/dashboard/parent)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await loginAndGo(page, CREDS.parent.email, CREDS.parent.password, '/dashboard/parent');
  });

  test('Page charge et affiche contenu parent', async ({ page }) => {
    await expect(dashboardContent(page, '/dashboard/parent')).toBeVisible();
  });

  test('BilanGratuitBanner ou contenu principal visible', async ({ page }) => {
    await expect(dashboardContent(page, '/dashboard/parent')).toBeVisible();
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning') &&
        !e.includes('next-dev') && !e.includes('NEXT_REDIRECT') &&
        !e.includes('Framing') &&
        !e.includes('googletagmanager.com') &&
        !e.includes('Content Security Policy')
    );
    if (realErrors.length > 0) console.log('Parent console errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });
});

// ─── ÉLÈVE DASHBOARD ──────────────────────────────────────────────────────────

test.describe('DASHBOARD — Élève (/dashboard/eleve)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await loginAndGo(page, CREDS.student.email, CREDS.student.password, '/dashboard/eleve');
  });

  test('Page charge et affiche contenu élève', async ({ page }) => {
    await expect(dashboardContent(page, '/dashboard/eleve')).toBeVisible();
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning') &&
        !e.includes('next-dev') && !e.includes('NEXT_REDIRECT') &&
        !e.includes('Framing') &&
        !e.includes('googletagmanager.com') &&
        !e.includes('Content Security Policy')
    );
    if (realErrors.length > 0) console.log('Élève console errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });
});

// ─── COACH DASHBOARD ──────────────────────────────────────────────────────────

test.describe('DASHBOARD — Coach (/dashboard/coach)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await loginAndGo(page, CREDS.coach.email, CREDS.coach.password, '/dashboard/coach');
  });

  test('Page charge et affiche contenu coach', async ({ page }) => {
    await expect(dashboardContent(page, '/dashboard/coach')).toBeVisible();
  });

  test('Zéro erreur console critique', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('hot-update') && !e.includes('webpack') &&
        !e.includes('Hydration') && !e.includes('Warning') &&
        !e.includes('next-dev') && !e.includes('NEXT_REDIRECT') &&
        !e.includes('Framing') &&
        !e.includes('googletagmanager.com') &&
        !e.includes('Content Security Policy')
    );
    if (realErrors.length > 0) console.log('Coach console errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });
});
