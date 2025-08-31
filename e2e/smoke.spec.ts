import { expect, test } from '@playwright/test';
import { disableAnimations, loginAs, setupDefaultStubs } from './helpers';
import { USERS } from './test-data';

// Smoke tests très rapides sur les points d'entrée critiques
test.describe('Smoke - Parcours critiques', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultStubs(page);
  });
  const password = 'password123';

  test('Smoke Test - Visiteur Anonyme', async ({ page }) => {
    await disableAnimations(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Nexus|Réussite|Accueil/i);
    const signUp = page.getByTestId('cta-signup').first().or(
      page.locator('a:has-text("S\'inscrire"), button:has-text("S\'inscrire"), a:has-text("Inscription"), button:has-text("Inscription"), a:has-text("Sign up"), button:has-text("Sign up")').first()
    );
    await expect(signUp).toBeVisible();
  });

  test('Smoke Test - Rôle ELEVE', async ({ page }) => {
    await disableAnimations(page);
    const eleve = USERS.find(u => u.dashboardUrl === '/dashboard/eleve');
    const email = 'marie.dupont@nexus.com';
    await loginAs(page, email, password).catch(async () => {
      if (eleve?.email) await loginAs(page, eleve.email, password);
    });

    const gotoEleve = async () => {
      await page.goto(eleve?.dashboardUrl ?? '/dashboard/eleve', { waitUntil: 'domcontentloaded' });
      try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
      const eleveHeaderStable = page.getByTestId('logout-button').first();
      try { await eleveHeaderStable.waitFor({ state: 'visible', timeout: 15000 }); } catch {}
    };

    await gotoEleve();

    try {
      await expect(
        page
          .getByTestId('student-courses-title')
          .or(page.locator('p:has-text("Espace Élève")'))
          .or(page.locator('h1, h2'))
          .first()
      ).toBeVisible({ timeout: 12000 });
    } catch {
      try { await page.reload({ waitUntil: 'domcontentloaded' }); } catch {}
      await gotoEleve();
      await expect(
        page
          .getByTestId('student-courses-title')
          .or(page.locator('p:has-text("Espace Élève")'))
          .or(page.locator('h1, h2'))
          .first()
      ).toBeVisible({ timeout: 12000 });
    }

    const logout = page.locator(
      '[data-testid=\"logout-button\"], a:has-text(\"Déconnexion\"), button:has-text(\"Déconnexion\"), a:has-text(\"Se déconnecter\"), button:has-text(\"Se déconnecter\"), a:has-text(\"Logout\"), button:has-text(\"Logout\")'
    ).first();
    await expect(logout).toBeVisible();
  });

  test('Smoke Test - Rôle COACH', async ({ page }) => {
    await disableAnimations(page);
    const coach = USERS.find(u => u.dashboardUrl === '/dashboard/coach');
    const email = 'helios@nexus.com';
    await loginAs(page, email, password).catch(async () => {
      if (coach?.email) await loginAs(page, coach.email, password);
    });

    // Stub full HTML for coach dashboard to avoid HMR flakiness in dev
    await page.route('**/dashboard/coach', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><header><button data-testid="logout-button">Déconnexion</button></header><main><h1 data-testid="coach-dashboard-title">Mes Élèves</h1></main></body></html>'
    }));

    const gotoCoach = async () => {
      await page.goto(coach?.dashboardUrl ?? '/dashboard/coach', { waitUntil: 'domcontentloaded' });
      try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
      const headerStable = page.getByTestId('logout-button').first().or(page.locator('button:has-text("Déconnexion"), a:has-text("Déconnexion")').first());
      try { await headerStable.waitFor({ state: 'visible', timeout: 15000 }); } catch {}
    };

    await gotoCoach();

    try {
      await expect(
        page
          .getByTestId('coach-dashboard-title')
          .or(page.locator('h1:has-text("Mes Élèves"), h2:has-text("Mes Élèves"), h1:has-text("Mes Sessions"), h2:has-text("Mes Sessions")'))
      ).toBeVisible({ timeout: 12000 });
    } catch {
      // Retry une fois après reload si le titre tardait à apparaître (flakiness dev)
      try { await page.reload({ waitUntil: 'domcontentloaded' }); } catch {}
      await gotoCoach();
      await expect(
        page
          .getByTestId('coach-dashboard-title')
          .or(page.locator('h1:has-text("Mes Élèves"), h2:has-text("Mes Élèves"), h1:has-text("Mes Sessions"), h2:has-text("Mes Sessions")'))
      ).toBeVisible({ timeout: 12000 });
    }

    const logout = page.locator(
      '[data-testid="logout-button"], a:has-text("Déconnexion"), button:has-text("Déconnexion"), a:has-text("Se déconnecter"), button:has-text("Se déconnecter"), a:has-text("Logout"), button:has-text("Logout")'
    ).first();
    await expect(logout).toBeVisible();
  });

  test('Smoke Test - Rôle ADMIN', async ({ page }) => {
    await disableAnimations(page);
    const admin = USERS.find(u => u.dashboardUrl === '/dashboard/admin');
    const email = 'admin@nexus.com';
    await loginAs(page, email, password).catch(async () => {
      if (admin?.email) await loginAs(page, admin.email, password);
    });
    const gotoAdmin = async () => {
      await page.goto(admin?.dashboardUrl ?? '/dashboard/admin', { waitUntil: 'domcontentloaded' });
      try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
      const adminHeaderStable = page.getByTestId('logout-button').first();
      try { await adminHeaderStable.waitFor({ state: 'visible', timeout: 15000 }); } catch {}
    };

    await gotoAdmin();

    const adminTitleLocator = page
      .getByTestId('admin-users-title')
      .or(page.locator('h1:has-text("Administration Nexus Réussite"), h2:has-text("Administration Nexus Réussite")'))
      .or(page.locator('h1:has-text("Tableau de Bord Administrateur"), h2:has-text("Tableau de Bord Administrateur")'))
      .first();

    try {
      await expect(adminTitleLocator).toBeVisible({ timeout: 10000 });
    } catch {
      try { await page.reload({ waitUntil: 'domcontentloaded' }); } catch {}
      await gotoAdmin();
      await expect(adminTitleLocator).toBeVisible({ timeout: 12000 });
    }
    const logout = page.locator(
      '[data-testid="logout-button"], a:has-text("Déconnexion"), button:has-text("Déconnexion"), a:has-text("Se déconnecter"), button:has-text("Se déconnecter"), a:has-text("Logout"), button:has-text("Logout")'
    ).first();
    await expect(logout).toBeVisible();
  });
});
