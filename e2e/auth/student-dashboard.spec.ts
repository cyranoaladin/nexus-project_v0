import { test, expect, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { chooseCourse } from '../aria/helpers';

async function loginAsStudent(page: Page) {
    await loginAsUser(page, 'ariaPremiereMaths');
}

async function waitForAriaUi(page: Page) {
    await expect(page.getByRole('dialog', { name: 'Assistant pédagogique ARIA' })).toBeVisible();
    await expect(page.getByLabel('Cours ARIA')).toHaveValue('');
    await chooseCourse(page, 'eds-maths-premiere');
}

test.describe('Student Dashboard', () => {
    test('Dashboard loads correctly', async ({ page }) => {
        await loginAsStudent(page);

        // Check for main elements (flexible matching)
        await expect(page.locator('body')).toContainText(/Nexus Réussite|Dashboard|Sessions|ARIA/i);
    });

    test('ARIA Chat opens', async ({ page }) => {
        await loginAsStudent(page);

        // Open chat - prefer stable test id, fallback to generic selectors
        let chatButton = page.getByTestId('aria-chat-trigger');
        if ((await chatButton.count()) === 0) {
            chatButton = page.locator('[data-testid*="aria-chat"]').first();
        }
        if ((await chatButton.count()) === 0) {
            chatButton = page.getByRole('button', { name: /aria/i }).first();
        }
        await expect(chatButton).toBeVisible({ timeout: 10000 });
        await chatButton.click();
        await waitForAriaUi(page);
    });

    test('Send message to ARIA', async ({ page }) => {
        await loginAsStudent(page);

        let chatButton = page.getByTestId('aria-chat-trigger');
        if ((await chatButton.count()) === 0) {
            chatButton = page.locator('[data-testid*="aria-chat"]').first();
        }
        if ((await chatButton.count()) === 0) {
            chatButton = page.getByRole('button', { name: /aria/i }).first();
        }
        await expect(chatButton).toBeVisible({ timeout: 10000 });
        await chatButton.click();
        await waitForAriaUi(page);

        await page.getByLabel('Message à ARIA').fill('Bonjour ARIA');
        await page.getByRole('button', { name: 'Envoyer à ARIA' }).click();
        await expect(page.getByText('Bonjour ARIA')).toBeVisible({ timeout: 5000 });
    });
});
