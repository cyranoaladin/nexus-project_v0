import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

async function loginAsStudent(page: any) {
    await loginAsUser(page, 'student');
}

test.describe('Module Automatismes - Élève', () => {
    test('Accès et navigation dans les automatismes', async ({ page }) => {
        await loginAsStudent(page);
        
        // Aller sur la page des automatismes
        await page.goto('/dashboard/eleve/automatismes');
        
        // Vérifier le titre
        await expect(page.locator('h1')).toContainText(/Automatismes/i);
        
        // Vérifier la présence des simulations (au moins une)
        const simulations = page.locator('button:has-text("Démarrer")');
        await expect(simulations.first()).toBeVisible();
        
        // Démarrer la première simulation
        await simulations.first().click();
        
        // Vérifier qu'on est dans le player
        await expect(page.getByText(/Question 1 \/ 12/i)).toBeVisible();
        
        // Répondre à la première question (choisir A par exemple)
        const choiceA = page.locator('button:has-text("A")').first();
        await expect(choiceA).toBeVisible();
        await choiceA.click();
        
        // Le bouton "Question Suivante" devrait être activé
        const nextButton = page.getByRole('button', { name: /Question Suivante/i });
        await expect(nextButton).toBeEnabled();
        
        // Cliquer sur suivant
        await nextButton.click();
        
        // Vérifier qu'on est à la question 2
        await expect(page.getByText(/Question 2 \/ 12/i)).toBeVisible();
        
        // Abandonner pour revenir à la liste
        await page.getByRole('button', { name: /Abandonner/i }).click();
        await expect(page.locator('h1')).toContainText(/Automatismes/i);
    });

    test('Sécurité : Pas de triche possible via correctChoiceId dans le DOM', async ({ page }) => {
        await loginAsStudent(page);
        await page.goto('/dashboard/eleve/automatismes');
        
        const startButton = page.locator('button:has-text("Démarrer")').first();
        await startButton.click();
        
        // Vérifier que correctChoiceId n'est pas présent dans le code source de la page (ou inspecteur)
        const content = await page.content();
        expect(content).not.toContain('correctChoiceId');
    });
});
