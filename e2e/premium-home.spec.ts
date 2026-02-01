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

        // Reduce animations for faster, more deterministic tests
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/', { waitUntil: 'networkidle' });
    });

    test('Hero Section loads with premium content', async ({ page }) => {
        const heading = page.getByRole('heading', { name: /L'Intelligence Artificielle et le Web3/i });
        await expect(heading).toBeVisible({ timeout: 15000 });

        // Verify key premium content is visible
        await expect(page.locator('#hero').getByText('IA Agentique')).toBeVisible({ timeout: 10000 });
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
        // Scroll to paths section
        const pathsSection = page.locator('#paths');
        await pathsSection.scrollIntoViewIfNeeded();

        // Wait for GSAP animations to complete
        await page.waitForLoadState('networkidle');

        // Verify persona heading is visible
        await expect(page.getByRole('heading', { name: /Élève \(Lycée\/Prépas\)/i })).toBeVisible({ timeout: 15000 });
    });

    test('Offer Section tabs interaction', async ({ page }) => {
        const offerSection = page.locator('#offer');
        await offerSection.scrollIntoViewIfNeeded();

        // Wait for section to be ready
        await page.waitForLoadState('networkidle');

        // Click on Parents & Élèves tab
        const tabBtn = page.getByRole('button', { name: /Parents & Élèves/i });
        await expect(tabBtn).toBeVisible({ timeout: 15000 });

        // Force click to handle GSAP pinned overlays
        await tabBtn.click({ force: true });

        // Verify tab content is displayed
        await expect(page.getByRole('heading', { name: /Accompagnement Elite/i })).toBeVisible({ timeout: 15000 });
    });

    test('Contact Form profile selector', async ({ page }) => {
        const contactSection = page.locator('#contact');
        await contactSection.scrollIntoViewIfNeeded();

        // Wait for contact form to be interactive
        await page.waitForLoadState('networkidle');

        // Verify initial form field is visible
        const schoolInput = page.getByLabel("Nom de l'établissement");
        await expect(schoolInput).toBeVisible({ timeout: 15000 });

        // Select student/parent profile
        const studentBtn = page.getByRole('button', { name: /Élève \/ Parent/i });
        await studentBtn.click({ force: true });

        // Verify conditional field appears
        await expect(page.getByLabel("Niveau scolaire")).toBeVisible({ timeout: 15000 });
    });
});
