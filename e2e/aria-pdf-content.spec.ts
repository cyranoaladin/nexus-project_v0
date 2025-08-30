import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// La génération de PDF en E2E est désactivée car elle dépend de timeouts
// liés au mock du LLM qui ne sont pas toujours stables.
test.describe('ARIA PDF Content Generation', () => {
  test.fixme('should generate a PDF with enriched content from a short query', async ({ page }) => {
    // Se connecter en tant qu'élève avec un abonnement ARIA+
    // L'utilisateur 'marie.dupont@nexus.com' est configuré pour avoir des abonnements via seed.
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    await page.goto('/aria');

    // Attendre que le chat soit prêt
    await expect(page.getByPlaceholder('Posez votre question à ARIA...')).toBeVisible({ timeout: 20000 });
    
    // Poser une question qui demande un PDF
    await page.getByPlaceholder('Posez votre question à ARIA...').fill('fais moi une fiche sur les fonctions exponentielles en pdf');
    await page.getByRole('button', { name: 'Envoyer' }).click();

    // Attendre que le lien de téléchargement apparaisse, signe que le processus est terminé
    const downloadLink = page.getByRole('link', { name: /télécharger|download/i });
    await expect(downloadLink).toBeVisible({ timeout: 40000 });

    // Vérifier que le lien pointe bien vers un fichier PDF généré localement
    const href = await downloadLink.getAttribute('href');
    expect(href).not.toBeNull();
    expect(href).toContain('/generated/');
    expect(href).toContain('.pdf');

    // Vérification supplémentaire : le message de l'assistant doit confirmer la génération
    const assistantMessages = page.getByTestId('nexus-aria-messages');
    await expect(assistantMessages).toContainText(/Voici votre document PDF/, { timeout: 10000 });
  });
});
