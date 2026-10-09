/**
 * P0-A — frontière de session au logout.
 *
 * Régression critique d'authentification jamais couverte jusqu'ici : après une
 * déconnexion par le vrai bouton, ni le bouton « précédent » du navigateur ni
 * une ré-entrée directe sur l'URL protégée ne doivent ré-exposer le dashboard.
 * La défense mesurée (sonde du 2026-10-05) est double : la session serveur est
 * réellement détruite, ET le document protégé est servi `no-store` — le retour
 * arrière re-demande donc la page au serveur au lieu de la rejouer depuis le
 * cache, et le serveur la refuse.
 *
 * Chaque attente est sémantique (URL, rôle visible, réponse réseau) ; aucun
 * waitForTimeout. Le scénario tourne sur Chromium (lane complète) et sur les
 * projets firefox/webkit/mobile-smoke (playwright.auth.config.ts), car le
 * comportement du cache d'historique (bfcache) diffère par moteur.
 */
import { expect, test } from '@playwright/test';
import { loginViaSigninForm } from '../helpers/auth';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3002';

async function sessionUser(page: import('@playwright/test').Page): Promise<unknown> {
  const body = (await (await page.request.get(`${BASE_URL}/api/auth/session`)).json()) as { user?: unknown } | null;
  return body?.user ?? null;
}

test('logout then browser back never re-exposes the parent dashboard', async ({ page }) => {
  // 1. Real sign-in through the browser form, landing on a protected route.
  await loginViaSigninForm(page, 'parent');
  await expect(page).toHaveURL(/\/dashboard\/parent/);

  // The protected document must forbid history/cache replay by contract.
  const doc = await page.request.get(page.url());
  expect(doc.headers()['cache-control']).toContain('no-store');
  expect(doc.headers()['cache-control']).toContain('private');

  // 2. Logout through the real UI control, not the API helper.
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.waitForURL((url) => !/\/dashboard\//.test(url.pathname), { timeout: 15_000 });

  // 3. The server session is genuinely gone (Auth.js answers null, not {}).
  expect(await sessionUser(page)).toBeNull();

  // 4. Browser back: must re-request (no-store) and be bounced to sign-in,
  //    never restore private content from history or bfcache.
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/auth\/signin/, { timeout: 15_000 });
  await expect(page.getByTestId('btn-signin')).toBeVisible();
  await expect(page.getByText('Déconnexion', { exact: true })).toHaveCount(0);

  // 5. Direct re-entry on the old protected URL stays refused.
  await page.goto('/dashboard/parent', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/auth\/signin/);
  expect(await sessionUser(page)).toBeNull();
});
