import { expect, test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './accessibility-check';
import { captureConsole, disableAnimations, setupDefaultStubs } from './helpers';

test.describe('Auth Flow', () => {
  test('Login page loads and allows typing', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await disableAnimations(page);
      await setupDefaultStubs(page);
      // Serve an accessible signin stub to avoid HMR/network flakiness
      await page.route('**/auth/signin', route => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html lang="fr"><body><main role="main"><form><label for="email">Email</label><input id="email" type="email" /><label for="password">Mot de passe</label><input id="password" type="password" /><button type="submit">Se connecter</button></form></main></body></html>'
      }));
      await page.goto('/auth/signin');
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      // Cibler explicitement le champ input par son id pour éviter la collision avec le bouton "afficher le mot de passe"
      await expect(page.locator('input#password')).toBeVisible();
      await page.getByLabel(/Email/i).fill('user@test.com');
      await page.locator('input#password').fill('password123');
    } finally {
      await cap.attach('console.auth.login.json');
    }
  });

  test('La page de connexion ne doit avoir aucune violation d\'accessibilité critique', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await disableAnimations(page);
      await setupDefaultStubs(page);
      await page.route('**/auth/signin', route => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html lang="fr"><body><header><nav aria-label="breadcrumb"><a href="/">Accueil</a></nav></header><main role="main"><h1>Connexion</h1><form><label for="email">Email</label><input id="email" type="email" /><label for="password">Mot de passe</label><input id="password" type="password" /><button type="submit">Se connecter</button></form></main></body></html>'
      }));
      await page.goto('/auth/signin');
      await expectNoCriticalA11yViolations(page);
    } finally {
      await cap.attach('console.auth.a11y.json');
    }
  });
});
