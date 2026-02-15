import { test, expect } from '@playwright/test';

test('Maths 1ere page renders correctly', async ({ page }) => {
    await page.goto('/programme/maths-1ere');

    // Verify title
    await expect(page).toHaveTitle(/Spécialité Maths Première/);

    // Verify header elements
    await expect(page.getByText('NEXUS MATHS LAB')).toBeVisible();
    await expect(page.getByText('Programme Officiel 2025-2026')).toBeVisible();

    // Verify Dashboard elements
    await expect(page.getByText('Progression Globale')).toBeVisible();

    // Verify tabs work
    await page.getByText('Fiches de Cours').click();
    await expect(page.getByText('Sélectionnez une fiche')).toBeVisible();

    await page.getByText('Tableau de bord').click();
    await expect(page.getByText('Progression Globale')).toBeVisible();
});
