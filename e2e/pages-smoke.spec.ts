import { expect, test } from '@playwright/test';
import { captureConsole, disableAnimations, installDefaultNetworkStubs } from './helpers';

// Liste de routes à vérifier (accès E2E bypass via middleware E2E=1)
const routes: string[] = [
  '/',
  '/offres',
  '/conditions',
  '/contact',
  '/notre-centre',
  '/equipe',
  '/bilan-gratuit',
  '/bilan-gratuit/confirmation',
  '/abonnements',
  '/auth/signin',
  // Dashboards
  '/dashboard',
  '/dashboard/admin',
  '/dashboard/admin/activities',
  '/dashboard/admin/analytics',
  '/dashboard/admin/rag-management',
  '/dashboard/admin/subscriptions',
  '/dashboard/admin/users',
  '/dashboard/admin/tests',
  '/dashboard/assistante',
  '/dashboard/assistante/coaches',
  '/dashboard/assistante/credits',
  '/dashboard/assistante/paiements',
  '/dashboard/assistante/students',
  '/dashboard/assistante/subscription-requests',
  '/dashboard/assistante/subscriptions',
  '/dashboard/coach',
  '/dashboard/parent',
  '/dashboard/parent/children',
  '/dashboard/parent/abonnements',
  '/dashboard/parent/paiement',
  '/dashboard/parent/paiement/wise',
  '/dashboard/parent/paiement/konnect-demo',
  '/dashboard/parent/paiement/confirmation',
  '/dashboard/eleve',
  '/dashboard/eleve/mes-sessions',
  '/dashboard/eleve/ressources',
  '/dashboard/eleve/sessions',
  // Session & ARIA
  '/session/video',
  '/aria',
  '/test-login',
];

for (const path of routes) {
  test(`Page smoke: ${path}`, async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      // Quarantaine Firefox pour les routes dashboard en dev (HMR peut causer NS_ERROR_ABORT)
      if (test.info().project.name === 'firefox' && path.startsWith('/dashboard')) {
        test.skip(true, 'Quarantine on Firefox dev server for dashboard routes (navigation abort due to HMR)');
      }
      await disableAnimations(page);
      await installDefaultNetworkStubs(page, { stubStatus: true, stubAdminTests: true });
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res?.ok(), `HTTP not OK for ${path}`).toBeTruthy();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(10);
    } finally {
      await cap.attach(`console.smoke.${path.replace(/\W+/g, '_')}.json`);
    }
  });
}
