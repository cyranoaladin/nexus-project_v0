/**
 * Sante des pages de tableau de bord — tous les roles, toutes les routes.
 *
 * Reecriture de `test-all-dashboard-pages.spec.ts`. Ce fichier couvrait la
 * bonne matiere — chaque role sur chacune de ses routes — mais n'assurait RIEN :
 * il importait `expect` sans jamais l'appeler, journalisait un tableau et
 * ecrivait captures et rapport JSON dans /tmp. Il figurait pourtant dans la
 * porte critique, ou il ne pouvait pas echouer.
 *
 * La couverture est conservee et rendue opposable : un role, une route, un
 * test, avec trois assertions — la page repond, la console est muette, aucune
 * requete n'echoue. En cas d'echec, Playwright produit deja trace et capture ;
 * aucun artefact hors depot n'est ecrit.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsUser, type UserType } from '../helpers/auth';

const DASHBOARDS: ReadonlyArray<readonly [UserType, readonly string[]]> = [
  ['admin', [
    '/dashboard/admin', '/dashboard/admin/users', '/dashboard/admin/analytics',
    '/dashboard/admin/subscriptions', '/dashboard/admin/activities',
    '/dashboard/admin/tests', '/dashboard/admin/facturation',
    // Redirection RBAC : la route redirige vers /dashboard/admin. Playwright
    // suit la redirection, l'assertion porte donc sur la page d'arrivee.
    '/admin/directeur',
  ]],
  ['assistante', [
    '/dashboard/assistante', '/dashboard/assistante/students', '/dashboard/assistante/coaches',
    '/dashboard/assistante/subscriptions', '/dashboard/assistante/credit-requests',
    '/dashboard/assistante/subscription-requests', '/dashboard/assistante/credits',
    '/dashboard/assistante/paiements', '/dashboard/assistante/docs',
  ]],
  ['coach', [
    '/dashboard/coach', '/dashboard/coach/sessions', '/dashboard/coach/students',
    '/dashboard/coach/availability',
  ]],
  ['parent', [
    '/dashboard/parent', '/dashboard/parent/children', '/dashboard/parent/abonnements',
    '/dashboard/parent/paiement',
  ]],
  ['student', [
    '/dashboard/eleve', '/dashboard/eleve/sessions', '/dashboard/eleve/ressources',
    '/dashboard/trajectoire', '/session/video', '/access-required',
  ]],
];

/** Observe une page et retourne ce qui s'y est mal passe. */
async function visit(page: Page, url: string) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const onConsole = (m: { type: () => string; text: () => string }) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('favicon')) return;
    // auth.js sonde `/api/auth/session` en continu. Quand ce fetch est annule —
    // navigation, fin de test, fermeture du contexte — son `catch` journalise
    // « Failed to fetch ». C'est l'echo CLIENT d'une requete deja annulee, pas
    // un defaut de la page. On a d'abord supprime la cause en attendant la
    // stabilisation du reseau ci-dessous ; seule cette signature EXACTE est
    // ecartee, et toute autre erreur console fait echouer le test.
    if (/authjs\.dev#autherror/.test(text) && /Failed to fetch/.test(text)) return;
    consoleErrors.push(text.slice(0, 200));
  };
  const onResponse = (r: { status: () => number; url: () => string }) => {
    if (r.status() < 400) return;
    const target = r.url();
    if (target.includes('favicon') || target.includes('/_next/')) return;
    failedRequests.push(`[${r.status()}] ${target.slice(0, 120)}`);
  };
  page.on('console', onConsole as never);
  page.on('response', onResponse as never);
  const response = await page.goto(url, { waitUntil: 'load', timeout: 25_000 });
  // Laisse le sondage de session d'auth.js se terminer plutot que de
  // l'interrompre : on supprime la cause du bruit avant d'en filtrer le reste.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(300);
  page.off('console', onConsole as never);
  page.off('response', onResponse as never);
  return { status: response?.status() ?? 0, consoleErrors, failedRequests };
}

for (const [role, urls] of DASHBOARDS) {
  test.describe(`tableaux de bord — ${role}`, () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page, role);
    });

    for (const url of urls) {
      test(`${url} répond sans erreur`, async ({ page }) => {
        const seen = await visit(page, url);
        expect(seen.status, `${url} doit répondre 200`).toBe(200);
        expect(seen.consoleErrors, `${url} : aucune erreur console`).toEqual([]);
        expect(seen.failedRequests, `${url} : aucune requête en échec`).toEqual([]);
      });
    }
  });
}
