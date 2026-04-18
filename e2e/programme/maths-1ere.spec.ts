import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

const BASE_URL = '/programme/maths-1ere';

test.describe('Maths Lab — Student Journey', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsUser(page, 'parent', { navigate: false, targetPath: BASE_URL });
    });

    test('Formulaire tab renders without runtime crash (regression)', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        const formTab = page.locator('button').filter({ hasText: /Formulaire Interactif/i }).first();
        await expect(formTab).toBeVisible({ timeout: 15_000 });
        await formTab.click();
        await expect(page.locator('text=Formulaire de Première')).toBeVisible({ timeout: 15_000 });
    });

    test('Page loads with correct title and header', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page).toHaveTitle(/Nexus|Maths/i);
        await expect(page.getByText(/Synchronisation/i)).not.toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/progression/i)).toBeVisible({ timeout: 15_000 });
    });

    test('All tab navigation works without 404', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page.getByText(/Synchronisation/i)).not.toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/Tableau de bord/i)).toBeVisible({ timeout: 15_000 });

        const tabs = [/Tableau de bord/i, /Programme & Cours/i, /Entraînement/i, /Formulaire Interactif/i];
        for (const tabRegex of tabs) {
            const tab = page.getByText(tabRegex).first();
            await expect(tab).toBeVisible({ timeout: 10_000 });
            await tab.click();
            await page.waitForTimeout(1000);
            await expect(page.locator('text=404')).not.toBeVisible();
        }
    });

    test('KaTeX: no raw LaTeX visible in rendered text', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page.getByText(/Synchronisation/i)).not.toBeVisible({ timeout: 30_000 });

        const coursTab = page.getByText(/Programme & Cours/i).first();
        await coursTab.click();
        await page.waitForTimeout(2000);

        const chapterButton = page.locator('button').filter({ hasText: /Second Degré|Dérivation/ }).first();
        if (await chapterButton.isVisible()) {
            await chapterButton.click();
            await page.waitForTimeout(3000);

            const contentArea = page.locator('main').first();
            const innerText = await contentArea.innerText();

            const rawLatexPatterns = [/\\frac\{/, /\\\$\$/, /\\sqrt\{/];
            for (const pattern of rawLatexPatterns) {
                expect(innerText).not.toMatch(pattern);
            }
            await expect(page.locator('.katex').first()).toBeVisible();
        }
    });
});
