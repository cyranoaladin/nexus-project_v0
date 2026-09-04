import { test, expect, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

async function loginAsStudent(page: Page) {
    await loginAsUser(page, 'ariaNsi');
}

test.describe('Student Dashboard', () => {
    test('Dashboard loads correctly', async ({ page }) => {
        await loginAsStudent(page);

        // Check for main elements (flexible matching)
        await expect(page.locator('body')).toContainText(/Nexus Réussite|Dashboard|Sessions|ARIA/i);
    });

    // Les deux scenarios de chat ARIA — ouverture du panneau et envoi d'un
    // message — vivaient ici. Ils exigent la fixture de modele ARIA, que cette
    // voie ne fournit pas, et ils sont POSSEDES par `e2e/aria/conversation.spec.ts`
    // (projet aria-desktop), qui les joue avec cette fixture et les personas
    // dediees. Sans elle, `selectOption('Cours ARIA')` expirait : l'echec ne
    // disait rien du chat, seulement de l'environnement absent.
});
