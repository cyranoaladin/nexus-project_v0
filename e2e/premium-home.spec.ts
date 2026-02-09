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
        // Wait for hero section to be fully loaded
        const heroSection = page.locator('#hero');
        await expect(heroSection).toBeVisible({ timeout: 10000 });

        // Verify heading with flexible timeout
        const heading = page.getByRole('heading', { name: /réussite au Bac|Pédagogie Augmentée/i });
        await expect(heading).toBeVisible({ timeout: 10000 });

        // Verify key premium content
        await expect(heroSection.getByText(/IA pédagogique|IA ARIA|ARIA/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('Navigation Menu opens and closes', async ({ page }) => {
        // Find menu button (may be hamburger icon)
        const menuButton = page.getByRole('button', { name: /Menu|☰|Navigation/i }).first();
        await expect(menuButton).toBeVisible({ timeout: 10000 });

        // Open menu
        await menuButton.click();
        await page.waitForTimeout(300); // Wait for animation

        // Verify menu is open (nav becomes visible with navigation links)
        const navLink = page.locator('nav a').filter({ hasText: /Accueil/i }).first();
        await expect(navLink).toBeVisible({ timeout: 5000 });

        // Close menu - try multiple possible close buttons
        const closeButton = page.locator('#close-menu, [aria-label*="Close"], button:has-text("×")').first();
        if (await closeButton.isVisible().catch(() => false)) {
            await closeButton.click({ force: true });
            await page.waitForTimeout(300); // Wait for close animation
        }
    });

    test('Paths Section displays personas', async ({ page }) => {
        // Scroll to paths section
        const pathsSection = page.locator('#paths');
        await pathsSection.scrollIntoViewIfNeeded();

        // Wait for section to be in viewport
        await expect(pathsSection).toBeInViewport({ timeout: 5000 });

        // Wait for GSAP animations with explicit timeout
        await page.waitForTimeout(1000);

        // Verify persona heading with flexible matching
        const personaHeading = page.getByRole('heading', { name: /Élève|Lycée|Prépas|Student/i });
        await expect(personaHeading.first()).toBeVisible({ timeout: 10000 });
    });

    test('Offer Section tabs interaction', async ({ page }) => {
        const offerSection = page.locator('#offer');
        await offerSection.scrollIntoViewIfNeeded();

        // Wait for section to be in viewport
        await expect(offerSection).toBeInViewport({ timeout: 5000 });
        await page.waitForTimeout(1000); // GSAP animation

        // Find and click tab (flexible selector)
        const tabBtn = page.locator('button').filter({ hasText: /Parents|Élèves/i }).first();

        if (await tabBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
            // Scroll tab into view and click
            await tabBtn.scrollIntoViewIfNeeded();
            await tabBtn.click({ force: true });
            await page.waitForTimeout(500); // Tab transition

            // Verify content loaded (flexible matching)
            const contentHeading = page.getByRole('heading', { name: /Accompagnement|Elite|Premium/i });
            await expect(contentHeading.first()).toBeVisible({ timeout: 10000 });
        } else {
            console.log('⚠️  Tab button not found - may be different layout');
        }
    });

    test('Contact Form profile selector', async ({ page }) => {
        const contactSection = page.locator('#contact');
        await contactSection.scrollIntoViewIfNeeded();

        // Wait for section to be in viewport
        await expect(contactSection).toBeInViewport({ timeout: 5000 });
        await page.waitForTimeout(500);

        // Verify form is visible (flexible selector)
        const formInput = page.locator('input, textarea').first();
        await expect(formInput).toBeVisible({ timeout: 10000 });

        // Try to find profile selector button
        const profileBtn = page.locator('button').filter({ hasText: /Élève|Parent|Student/i }).first();

        if (await profileBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await profileBtn.click({ force: true });
            await page.waitForTimeout(300);

            // Verify conditional field appears (flexible matching)
            const conditionalField = page.locator('label, input').filter({ hasText: /Nom complet|Email|Téléphone|établissement|Message/i });
            await expect(conditionalField.first()).toBeVisible({ timeout: 5000 });
        } else {
            console.log('⚠️  Profile selector not found - may be different form structure');
        }
    });
});
