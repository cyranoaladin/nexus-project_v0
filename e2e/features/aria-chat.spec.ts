import { expect, test } from '@playwright/test';
import { captureConsole, disableAnimations, loginAs } from '../helpers';
import { USERS } from '../test-data';

test.describe('ARIA Chat - E2E avec mock LLM', () => {
  const elevePrimaryEmail = 'marie.dupont@nexus.com';
  const eleve = USERS.find(u => u.dashboardUrl === '/dashboard/eleve');
  const password = 'password123';

  test('L\'élève envoie une question et reçoit une réponse mockée', async ({ page }) => {
    await disableAnimations(page);

    // Préparation: connexion élève
    try {
      await loginAs(page, elevePrimaryEmail, password);
    } catch {
      if (eleve?.email) {
        await loginAs(page, eleve.email, password);
      } else {
        test.skip(true, 'Identifiants élève indisponibles');
      }
    }

    const cap = captureConsole(page, test.info());
    try {
      // Mock API du LLM côté application: on intercepte l'endpoint de notre API qui le relaye
      const askedQuestion = 'Comment fonctionne une boucle for ?';
      const mockedResponse = 'Ceci est une réponse mockée de ARIA pour le test.';
      let interceptedPayload: any = null;

      await page.route('**/api/aria/chat', async route => {
        const req = route.request();
        if (req.method() === 'POST') {
          try { interceptedPayload = JSON.parse(req.postData() || '{}'); } catch {}
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ response: mockedResponse })
          });
          return;
        }
        return route.fallback();
      });

      // Aller sur une page où le widget/page ARIA est présent
      const navOk = await page.goto('/aria', { waitUntil: 'domcontentloaded' }).then(r => !!r).catch(() => false);
      if (!navOk) {
        await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => null);
      }

      // Ouvrir le widget si nécessaire
      const openBtn = page.getByTestId('open-aria-chat');
      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click();
      }

      // Saisir la question et envoyer (locateur tolérant comme dans les autres tests ARIA)
      const input = page.getByTestId('aria-input').or(page.locator('[data-testid-aria="aria-input"], input[placeholder="Posez votre question à ARIA..."]').first());
      await expect(input).toBeVisible({ timeout: 12000 });
      await input.fill(askedQuestion);

      const send = page.getByTestId('aria-send');
      await expect(send).toBeEnabled({ timeout: 12000 });
      await send.click();

      // L'UI doit afficher immédiatement le message de l'élève
      await expect(page.getByText(askedQuestion, { exact: false })).toBeVisible({ timeout: 10000 });

      // Puis la réponse mockée d'ARIA
      await expect(page.getByText(mockedResponse, { exact: false })).toBeVisible({ timeout: 10000 });

      // Assertion réseau: le payload doit contenir la question
      expect(interceptedPayload).toBeTruthy();
      expect(JSON.stringify(interceptedPayload).toLowerCase()).toContain('message');
      expect(JSON.stringify(interceptedPayload)).toContain('boucle for');
    } finally {
      await cap.attach('console.features.aria-chat.json');
    }
  });

  test('affiche un message d\'erreur si le service ARIA échoue', async ({ page }) => {
    await disableAnimations(page);

    // Préparation: connexion élève
    try {
      await loginAs(page, elevePrimaryEmail, password);
    } catch {
      if (eleve?.email) {
        await loginAs(page, eleve.email, password);
      } else {
        test.skip(true, 'Identifiants élève indisponibles');
      }
    }

    const cap = captureConsole(page, test.info());
    try {
      // Mock erreur serveur
      const askedQuestion = 'Comment fonctionne une boucle for ?';
      const successStub = 'Ceci est une réponse mockée de ARIA pour le test.';

      await page.route('**/api/aria/chat', async route => {
        const req = route.request();
        if (req.method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal Server Error' })
          });
          return;
        }
        return route.fallback();
      });

      // Aller sur une page où le widget/page ARIA est présent
      const navOk = await page.goto('/aria', { waitUntil: 'domcontentloaded' }).then(r => !!r).catch(() => false);
      if (!navOk) {
        await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => null);
      }

      // Ouvrir le widget si nécessaire
      const openBtn = page.getByTestId('open-aria-chat');
      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click();
      }

      // Saisir la question et envoyer
      const input = page.getByTestId('aria-input');
      await expect(input).toBeVisible({ timeout: 10000 });
      await input.fill(askedQuestion);

      const send = page.getByTestId('aria-send');
      await expect(send).toBeEnabled();
      await send.click();

      // L'UI doit afficher immédiatement le message de l'élève
      await expect(page.getByText(askedQuestion, { exact: false })).toBeVisible({ timeout: 10000 });

      // Puis un message d'erreur (tolérant: différentes copies possibles)
      const errorPattern = /(désolé[\s,].*réessayer|difficulté\s+technique|Internal\s+Server\s+Error|Une\s+erreur\s+de\s+communication)/i;
      await expect(page.getByText(errorPattern).first()).toBeVisible({ timeout: 10000 });

      // Et ne doit PAS afficher la réponse mockée de succès du test précédent
      await expect(page.getByText(successStub, { exact: false })).toHaveCount(0);
    } finally {
      await cap.attach('console.features.aria-chat.error.json');
    }
  });
});
