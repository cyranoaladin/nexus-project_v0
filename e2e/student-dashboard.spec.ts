
import { test, expect } from '@playwright/test';

test.describe('Student Dashboard', () => {
    test.use({ storageState: 'student.json' });

    test('Dashboard loads correctly', async ({ page }) => {
        // Navigate to dashboard (or let it redirect if root)
        await page.goto('/dashboard/student');

        // Check for main elements
        await expect(page.locator('h1')).toContainText('Espace Étudiant');
        await expect(page.getByText('Solde de Crédits')).toBeVisible();
        await expect(page.getByText('Mon Planning & Réservations')).toBeVisible();
    });

    test('ARIA Chat opens', async ({ page }) => {
        await page.goto('/dashboard/student');

        // Open chat
        const chatButton = page.locator('button.rounded-full'); // Heuristic selector based on aria-chat.tsx
        await chatButton.click();

        await expect(page.getByText('ARIA')).toBeVisible();
        await expect(page.getByPlaceholder(/Posez votre question/)).toBeVisible();
    });

    // Streaming test is hard to do robustly in E2E without mocking, but we can check if sending a message works UI-wise
    test('Send message to ARIA', async ({ page }) => {
        await page.goto('/dashboard/student');
        const chatButton = page.locator('button.rounded-full');
        await chatButton.click();

        const input = page.getByPlaceholder(/Posez votre question/);
        await input.fill('Bonjour ARIA');
        await page.keyboard.press('Enter');

        // Expect user message
        await expect(page.locator('text=Bonjour ARIA')).toBeVisible();

        // Expect streaming response (assistant message container appears)
        // We can just check that *some* response appears eventually
        // Note: we need a better selector for assistant message.
        // In aria-chat.tsx: bg-blue-50
        await expect(page.locator('.bg-blue-50').last()).toBeVisible({ timeout: 10000 });
    });
});
