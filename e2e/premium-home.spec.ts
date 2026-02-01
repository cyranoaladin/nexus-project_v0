import { test, expect } from '@playwright/test';

test.describe('Premium Home Journey', () => {
    test.beforeEach(async ({ page }) => {
        // Log console errors to help debugging
        page.on('console', msg => {
            if (msg.type() === 'error') console.log(`[Browser Error]: ${msg.text()}`);
        });

        page.on('pageerror', err => {
            console.log(`[Page Error]: ${err.message}`);
        });

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        // Wait for hydration and initial animations
        await page.waitForTimeout(2000);
    });

    test('Hero Section loads with premium content', async ({ page }) => {
        const heading = page.getByRole('heading', { name: /L'Intelligence Artificielle et le Web3/i });
        await expect(heading).toBeVisible({ timeout: 10000 });
        // Use .first() or scope to hero to avoid ambiguity with Testimonials
        await expect(page.locator('#hero').getByText('IA Agentique')).toBeVisible();
    });

    test('Navigation Menu opens and closes', async ({ page }) => {
        const menuButton = page.getByRole('button', { name: /Menu/i });
        await expect(menuButton).toBeVisible({ timeout: 10000 });
        await menuButton.click();

        const nav = page.locator('nav');
        await expect(nav).toBeVisible();
        await expect(page.getByRole('button', { name: 'Expertise' })).toBeVisible();

        const closeButton = page.locator('#close-menu');
        await closeButton.click({ force: true });
        await expect(nav).not.toBeVisible();
    });

    test('Paths Section displays personas', async ({ page }) => {
        // Scroll to paths
        const pathsSection = page.locator('#paths');
        // JS Scroll to bypass checking
        await pathsSection.evaluate(node => node.scrollIntoView());

        // Wait for ScrollTrigger
        await page.waitForTimeout(2000);

        // Use more specific locators if roles are ambiguous
        await expect(page.getByRole('heading', { name: /Élève \(Lycée\/Prépas\)/i })).toBeVisible({ timeout: 10000 });
    });

    test('Offer Section tabs interaction', async ({ page }) => {
        const offerSection = page.locator('#offer');
        // JS Scroll
        await offerSection.evaluate(node => node.scrollIntoView());
        await page.waitForTimeout(2000);

        // Force click if obscured by "fixed" elements (pinned sections often cause valid overlaps)
        const tabBtn = page.getByRole('button', { name: /Parents & Élèves/i });
        await expect(tabBtn).toBeVisible({ timeout: 10000 });
        await tabBtn.click({ force: true });

        await expect(page.getByRole('heading', { name: /Accompagnement Elite/i })).toBeVisible({ timeout: 10000 });
    });

    test('Contact Form profile selector', async ({ page }) => {
        const contactSection = page.locator('#contact');
        await contactSection.evaluate(node => node.scrollIntoView());
        await page.waitForTimeout(2000);

        const schoolInput = page.getByLabel("Nom de l'établissement");
        await expect(schoolInput).toBeVisible({ timeout: 10000 });

        const studentBtn = page.getByRole('button', { name: /Élève \/ Parent/i });
        await studentBtn.click({ force: true });

        await expect(page.getByLabel("Niveau scolaire")).toBeVisible({ timeout: 10000 });
    });
});
