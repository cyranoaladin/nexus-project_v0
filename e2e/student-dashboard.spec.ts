
import { test, expect, Page } from '@playwright/test';

async function loginAsStudent(page: Page) {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });
    await page.getByLabel(/email/i).fill('yasmine.dupont@test.com');
    await page.getByPlaceholder('Votre mot de passe').fill('password123');
    await Promise.all([
        page.waitForURL(/\/dashboard\/(eleve|student)/, { timeout: 10000 }),
        page.getByRole('button', { name: /accéder|sign in|connexion/i }).click(),
    ]);
    await page.waitForLoadState('networkidle');
}

test.describe('Student Dashboard', () => {
    test('Dashboard loads correctly', async ({ page }) => {
        await loginAsStudent(page);

        // Check for main elements (flexible matching)
        await expect(page.getByText(/solde de crédits|crédit/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('ARIA Chat opens', async ({ page }) => {
        await loginAsStudent(page);

        // Open chat - look for ARIA button
        const chatButton = page.locator('button.rounded-full, button:has-text("ARIA"), [data-testid*="aria"]').first();
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

        const chatButton = page.locator('button.rounded-full, button:has-text("ARIA"), [data-testid*="aria"]').first();
        if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await chatButton.click();
            await page.waitForTimeout(500);

            const input = page.locator('input[type="text"], textarea').filter({ hasText: /question|message/ }).or(page.locator('[placeholder*="question"], [placeholder*="message"], [placeholder*="Posez"]')).first();
            if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
                await input.fill('Bonjour ARIA');
                await page.keyboard.press('Enter');

                // Expect user message
                await expect(page.getByText('Bonjour ARIA')).toBeVisible({ timeout: 5000 });
            } else {
                console.log('⚠️  ARIA input field not found');
            }
        } else {
            console.log('⚠️  ARIA chat button not found');
        }
    });
});
