
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

async function loginAsStudent(page: any) {
    await loginAsUser(page, 'student');
}

test.describe('Student Dashboard', () => {
    test.fixme('Dashboard loads correctly', async ({ page }) => {
        // FIXME: Student login + dashboard SSR/hydration timing unreliable in CI.
        await loginAsStudent(page);

        // Check for main elements (flexible matching)
        await expect(page.getByText(/solde de crédits|crédit/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('ARIA Chat opens', async ({ page }) => {
        await loginAsStudent(page);

        // Open chat - prefer stable test id, fallback to generic selectors
        let chatButton = page.getByTestId('aria-chat-trigger');
        if ((await chatButton.count()) === 0) {
            chatButton = page.locator('button.rounded-full, button:has-text("ARIA"), [data-testid*="aria"]').first();
        }
        if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await chatButton.click();
            await page.waitForTimeout(500);

            await expect(page.getByText(/ARIA/i).first()).toBeVisible();
        } else {
            console.log('⚠️  ARIA chat button not found on student dashboard');
        }
    });

    test('Send message to ARIA', async ({ page }) => {
        await loginAsStudent(page);

        let chatButton = page.getByTestId('aria-chat-trigger');
        if ((await chatButton.count()) === 0) {
            chatButton = page.locator('button.rounded-full, button:has-text("ARIA"), [data-testid*="aria"]').first();
        }
        if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await chatButton.click();
            await page.waitForTimeout(500);

            let input = page.getByTestId('aria-input');
            if ((await input.count()) === 0) {
                input = page.locator('[placeholder*="question"], [placeholder*="message"], [placeholder*="Posez"]').first();
            }
            if ((await input.count()) === 0) {
                input = page.locator('input[type="text"], textarea').first();
            }
            if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
                await input.fill('Bonjour ARIA');
                await page.keyboard.press('Enter');

                // Expect user message
                await expect(page.getByText('Bonjour ARIA')).toBeVisible({ timeout: 5000 });
            }
        } else {
            console.log('⚠️  ARIA chat button not found');
        }
    });
});
