import { test, expect } from '@playwright/test';

/**
 * PHASE 0 — Scan HTTP de TOUTES les pages publiques et protégées.
 * Objectif : identifier quelles pages existent (200), lesquelles sont 404/500.
 * Aucun mock, aucun skip, aucun contournement.
 */

const PUBLIC_PAGES = [
  '/',
  '/auth/signin',
  '/bilan-gratuit',
  '/bilan-gratuit/confirmation',
  '/offres',
  '/stages',
  '/stages/fevrier-2026',
  '/stages/fevrier-2026/diagnostic',
  '/accompagnement-scolaire',
  '/plateforme-aria',
  '/equipe',
  '/notre-centre',
  '/contact',
  '/conditions',
  '/mentions-legales',
  '/academy',
  '/consulting',
  '/famille',
  '/programme/maths-1ere',
  '/programme/maths-terminale',
  '/maths-1ere',
  '/bilan-pallier2-maths',
  '/bilan-pallier2-maths/confirmation',
  '/bilan-pallier2-maths/dashboard',
  '/access-required',
  '/test',
  '/session/video',
  '/studio',
];

const AUTH_PAGES = [
  '/auth/mot-de-passe-oublie',
  '/auth/activate',
  '/auth/reset-password',
];

const DASHBOARD_PAGES = [
  '/dashboard/admin',
  '/dashboard/admin/users',
  '/dashboard/admin/analytics',
  '/dashboard/admin/subscriptions',
  '/dashboard/admin/activities',
  '/dashboard/admin/tests',
  '/dashboard/admin/documents',
  '/dashboard/admin/facturation',
  '/dashboard/assistante',
  '/dashboard/assistante/students',
  '/dashboard/assistante/coaches',
  '/dashboard/assistante/subscriptions',
  '/dashboard/assistante/credit-requests',
  '/dashboard/assistante/subscription-requests',
  '/dashboard/assistante/credits',
  '/dashboard/assistante/paiements',
  '/dashboard/assistante/docs',
  '/dashboard/coach',
  '/dashboard/coach/sessions',
  '/dashboard/coach/students',
  '/dashboard/coach/availability',
  '/dashboard/parent',
  '/dashboard/parent/children',
  '/dashboard/parent/abonnements',
  '/dashboard/parent/paiement',
  '/dashboard/parent/paiement/confirmation',
  '/dashboard/parent/ressources',
  '/dashboard/eleve',
  '/dashboard/eleve/mes-sessions',
  '/dashboard/eleve/sessions',
  '/dashboard/eleve/ressources',
  '/dashboard/trajectoire',
  '/admin/directeur',
  '/admin/stages/fevrier-2026',
];

test.describe('SCAN — HTTP Status de TOUTES les pages publiques', () => {
  PUBLIC_PAGES.forEach((url) => {
    test(`PUBLIC ${url} — HTTP status`, async ({ request }) => {
      const resp = await request.get(url, { timeout: 15000 });
      const status = resp.status();
      // Log pour le rapport
      console.log(`[SCAN] ${url} → HTTP ${status}`);
      // On ne fait PAS expect(200) ici — on veut juste VOIR l'état réel
      // Mais on signale les 500 comme des vrais problèmes
      expect(status, `${url} retourne une erreur serveur 500+`).toBeLessThan(500);
    });
  });
});

test.describe('SCAN — HTTP Status pages auth', () => {
  AUTH_PAGES.forEach((url) => {
    test(`AUTH ${url} — HTTP status`, async ({ request }) => {
      const resp = await request.get(url, { timeout: 15000 });
      const status = resp.status();
      console.log(`[SCAN] ${url} → HTTP ${status}`);
      // Auth pages may redirect (302/307) — that's OK
      // But 500 is a real problem
      expect(status, `${url} retourne une erreur serveur`).toBeLessThan(500);
    });
  });
});

test.describe('SCAN — Dashboard pages (sans auth = redirect attendu)', () => {
  DASHBOARD_PAGES.forEach((url) => {
    test(`DASHBOARD ${url} — HTTP status (sans auth)`, async ({ request }) => {
      const resp = await request.get(url, {
        timeout: 15000,
        maxRedirects: 0, // Don't follow redirects — see the raw response
      });
      const status = resp.status();
      console.log(`[SCAN-NOAUTH] ${url} → HTTP ${status}`);
      // Sans auth, on attend 307/302 (redirect vers signin) ou 200 (client-side redirect)
      // Mais PAS 500
      expect(status, `${url} retourne une erreur serveur`).toBeLessThan(500);
    });
  });
});
