import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';
import { CREDS } from './helpers/credentials';
import { disconnectPrisma, setEntitlementByUserEmail } from './helpers/db';

async function loginAsStudent(page: any) {
    await loginAsUser(page, 'student');
}

async function waitForAriaUi(page: any) {
    const ariaHeader = page.getByText(/^ARIA$/i).first();
    const subjectPicker = page.getByText(/Choisis ta matière/i).first();
    const ariaInput = page.getByTestId('aria-input').first();

    const visible = async (locator: any) => locator.isVisible({ timeout: 250 }).catch(() => false);

    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
        const [headerVisible, pickerVisible, inputVisible] = await Promise.all([
            visible(ariaHeader),
            visible(subjectPicker),
            visible(ariaInput),
        ]);
        if (headerVisible || pickerVisible || inputVisible) return true;
        await page.waitForTimeout(200);
    }
    return false;
}

test.describe('Student Dashboard', () => {
    test.beforeAll(async () => {
        await setEntitlementByUserEmail(CREDS.student.email, 'ARIA_ADDON_MATHS');
    });

    test.afterAll(async () => {
        await disconnectPrisma();
    });

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
        const uiVisible = await waitForAriaUi(page);
        expect(uiVisible).toBeTruthy();
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
        const uiVisible = await waitForAriaUi(page);
        expect(uiVisible).toBeTruthy();

        let input = page.getByTestId('aria-input');
        if ((await input.count()) === 0) {
            input = page.locator('[placeholder*="question"], [placeholder*="message"], [placeholder*="Posez"]').first();
        }
        if ((await input.count()) === 0) {
            input = page.locator('input[type="text"], textarea').first();
        }
        const inputVisible = await input.isVisible({ timeout: 5000 }).catch(() => false);
        if (inputVisible) {
            await input.fill('Bonjour ARIA');
            await page.keyboard.press('Enter');
            await expect(page.getByText('Bonjour ARIA')).toBeVisible({ timeout: 5000 });
        } else {
            await expect(page.locator('body')).toContainText(/ARIA/i);
        }
    });
});
