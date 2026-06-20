import { test, expect } from '@playwright/test';

test.describe('Premium Home Journey', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
    });

    test('Hero Section loads with premium content', async ({ page }) => {
        const heroSection = page.locator('main > section').first();
        await expect(heroSection).toBeVisible({ timeout: 10000 });

        const heading = page.getByRole('heading', { name: /préparer le bac français/i });
        await expect(heading).toBeVisible({ timeout: 10000 });

        // Verify reassurance items in hero
        await expect(heroSection.getByText('Cellule Cyclades')).toBeVisible({ timeout: 10000 });
    });

    test('Navigation Menu opens and closes', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const menuButton = page.getByRole('button', { name: /ouvrir le menu/i });
        await expect(menuButton).toBeVisible({ timeout: 10000 });

        await menuButton.click();
        await page.waitForTimeout(300);

        // Verify menu is open — nav links are visible
        const navLink = page.locator('#primary-menu a').filter({ hasText: /Offres & tarifs/i }).first();
        await expect(navLink).toBeVisible({ timeout: 5000 });

        // Close menu
        const closeButton = page.locator('#close-menu');
        await closeButton.click({ force: true });
        await page.waitForTimeout(300);
        await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('Method Section displays approach', async ({ page }) => {
        // MethodSection is section 4 in the homepage
        const sections = page.locator('main > section');
        const count = await sections.count();
        expect(count).toBeGreaterThanOrEqual(8);

        // Find the method section by heading
        const methodHeading = page.getByRole('heading', { name: /méthode|approche|comment ça marche/i });
        await expect(methodHeading.first()).toBeVisible({ timeout: 10000 });
    });

    test('Pricing anchors are visible', async ({ page }) => {
        // PricingReperesSection shows pricing anchor cards
        const pricingText = page.getByText(/repères tarifaires|tous les tarifs/i).first();
        await pricingText.scrollIntoViewIfNeeded();
        await expect(pricingText).toBeVisible({ timeout: 10000 });

        // Verify at least one pricing anchor card exists
        const pricingCard = page.getByText(/TND/i).first();
        await expect(pricingCard).toBeVisible({ timeout: 10000 });
    });

    test('CTA bilan gratuit is accessible', async ({ page }) => {
        const ctaSection = page.locator('section[aria-label="Demander un bilan gratuit"]');
        await ctaSection.scrollIntoViewIfNeeded();
        await expect(ctaSection).toBeInViewport({ timeout: 5000 });

        const ctaLink = ctaSection.getByRole('link', { name: /bilan gratuit/i });
        await expect(ctaLink).toBeVisible({ timeout: 10000 });
        await expect(ctaLink).toHaveAttribute('href', '/bilan-gratuit');
    });
});
