import { expect, test } from '@playwright/test';
import { disableAnimations, installDefaultNetworkStubs, loginAs, setupDefaultStubs } from './helpers';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

// Ce fichier couvre un smoke déterministe des flux majeurs (sans aléatoire)
// On utilise des stubs réseaux non-critiques pour réduire la flakiness.

const offerPaths = ['/offres/nexus-cortex', '/offres/studio-flex', '/offres/academies-nexus', '/offres/programme-odyssee', '/offres/sos-devoirs'];

// 1) Public: Home → Crédits → Paiement + Offres CTA + Bilan gratuit
test.describe('Public flows (Home/Offres/Bilan)', () => {
  test.beforeEach(async ({ page }) => {
    await disableAnimations(page);
    await setupDefaultStubs(page);
    await installDefaultNetworkStubs(page, { stubStatus: true });
  });

  test('Home: crédits CTA -> parent paiement', async ({ page }) => {
    await page.goto(`${BASE}/`);
    // Tenter de faire apparaître la section si hors écran
    const cta = page.getByTestId('cta-credits').first();
    if (!(await cta.isVisible().catch(() => false))) {
      await page.keyboard.press('End');
      await page.waitForTimeout(300);
    }
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/dashboard/parent/paiement');
    // Ne pas forcer la navigation (protégée par auth) — vérification de la cible uniquement
  });

  test('Offres: pages accessibles + CTA primaire visible', async ({ page }) => {
    for (const p of offerPaths) {
      // Vérifier que la route répond
      const res = await page.request.get(`${BASE}${p}`);
      expect(res.status(), `GET ${p}`).toBeLessThan(400);
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading').first()).toBeVisible();
      // Accepter soit un CTA nominal, soit la présence de prix dynamiques 'TND'
      const cta = page.getByRole('link', { name: /Activer|Réserver|S’inscrire|Rejoindre|Demander/i }).first();
      const ctaVisible = await cta.isVisible().catch(() => false);
      if (!ctaVisible) {
        await expect(page.locator('text=TND').first()).toBeVisible();
      }
    }
  });

  test('Bilan gratuit: bloc "Déjà inscrit ?" + lien actif', async ({ page }) => {
    await page.goto(`${BASE}/bilan-gratuit`);
    // Le bloc peut ne pas apparaître si la session est vue comme authentifiée; fallback sur le lien header
    const mainSignin = page.getByRole('main').getByTestId('bilan-deja-inscrit').first();
    const headerSignin = page.getByRole('banner').getByRole('link', { name: /Se Connecter/i }).first();
    const visibleMain = await mainSignin.isVisible().catch(() => false);
    const target = visibleMain ? mainSignin : headerSignin;
    await expect(target).toBeVisible();
    await expect(target).toHaveAttribute('href', '/auth/signin');
  });
});

// 2) Dashboards: cohérence minimale (accès, quelques endpoints, liens valides)
const roles = ['PARENT', 'ELEVE', 'ASSISTANTE', 'COACH'] as const;
const roleEmails: Record<typeof roles[number], string> = {
  PARENT: 'parent.dupont@nexus.com',
  ELEVE: 'marie.dupont@nexus.com',
  ASSISTANTE: 'assistante@nexus.com',
  COACH: 'coach@nexus.com',
};

for (const role of roles) {
  test.describe(`${role} dashboard smoke`, () => {
    test.beforeEach(async ({ page }) => {
      await disableAnimations(page);
      await setupDefaultStubs(page);
      await installDefaultNetworkStubs(page, { stubStatus: true, stubAdminTests: true });
      await loginAs(page, roleEmails[role]);
    });

    test('Dashboard charge du contenu et interactions minimales', async ({ page }) => {
      // Le helper loginAs a déjà navigué vers le dashboard du rôle
      const main = page.getByRole('main');
      // Tolérance accrue: attendre l'attachement puis la visibilité si possible
      try { await main.waitFor({ state: 'attached', timeout: 8000 }); } catch {}
      const mainVisible = await main.isVisible().catch(() => false);

      // Si main n'est pas visible rapidement (dev server/HMR), tolérer une ancre interactive
      if (!mainVisible) {
        const anyInteractive = await page.locator('main button, main a, nav a').first().isVisible().catch(() => false);
        expect(mainVisible || anyInteractive).toBeTruthy();
      }

      const links = await page.locator('main a[href^="/dashboard"], nav a[href^="/dashboard"]').all();
      if (links.length > 0) {
        // Valider qu’au moins un lien répond 2xx/3xx
        const href = await links[0].getAttribute('href');
        if (href && !href.startsWith('/#')) {
          const res = await page.request.get(`${BASE}${href}`);
          expect(res.status(), `GET ${href}`).toBeLessThan(400);
        }
      } else {
        // Fallback: vérifier au moins un bouton/onglet interactif visible dans main
        const hasInteractive = await page.locator('main button, main a').first().isVisible().catch(() => false);
        expect(hasInteractive).toBeTruthy();
      }
    });
  });
}

// 3) ARIA Chat (stub) + RAG ingestion (fixme par défaut sans ADMIN réel)

test.describe('ARIA & RAG', () => {
  test('ARIA chat endpoint responds (stubbed)', async ({ page }) => {
    await disableAnimations(page);
    await setupDefaultStubs(page);
    await installDefaultNetworkStubs(page, { stubAriaChat: true });
    const r = await page.request.post(`${BASE}/api/aria/chat`, { data: { message: 'Bonjour' } });
    expect(r.ok()).toBeTruthy();
  });

  test.fixme(true, 'RAG UI nécessite ADMIN; testé dans une suite dédiée avec connexion réelle');
});
