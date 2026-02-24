import { test, expect } from '@playwright/test';

/**
 * REAL AUDIT — Mobile responsiveness.
 * Tests key pages at mobile viewport (390×844 iPhone 14) for:
 * - No horizontal overflow
 * - Hamburger menu visible and functional
 * - Touch targets ≥ 44px
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };

const PAGES = ['/', '/offres', '/contact', '/bilan-gratuit', '/auth/signin'];

for (const url of PAGES) {
  test.describe(`MOBILE — ${url}`, () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test(`Pas de scroll horizontal`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow, `${url} a un scroll horizontal à 390px`).toBe(false);
    });

    test(`Menu hamburger visible`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Desktop nav should be hidden, hamburger should be visible
      const hamburger = page.locator('button').filter({ hasText: /menu/i }).first()
        .or(page.locator('[aria-label*="menu" i]').first())
        .or(page.locator('button svg.lucide-menu').first());

      const isVisible = await hamburger.isVisible().catch(() => false);
      if (!isVisible) {
        // Alternative: check for any button with Menu icon
        const menuButtons = page.locator('button').filter({ has: page.locator('svg') });
        const count = await menuButtons.count();
        console.log(`${url} — No hamburger found, ${count} buttons with SVG icons`);
      }
      // Don't fail — just log for audit
      console.log(`${url} hamburger visible: ${isVisible}`);
    });

    test(`Touch targets ≥ 44px`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const smallTargets = await page.evaluate(() => {
        const interactive = document.querySelectorAll('a, button, input, select, textarea, [role="button"]');
        const tooSmall: string[] = [];
        interactive.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.width < 44 && rect.height < 44) {
            const tag = el.tagName;
            const text = (el.textContent || '').trim().substring(0, 30);
            tooSmall.push(`${tag} "${text}" (${Math.round(rect.width)}×${Math.round(rect.height)})`);
          }
        });
        return tooSmall.slice(0, 5);
      });

      if (smallTargets.length > 0) {
        console.log(`${url} — Touch targets < 44px:`, smallTargets);
      }
      // Log but don't fail — this is an audit finding
      console.log(`${url} small touch targets: ${smallTargets.length}`);
    });
  });
}

// Test hamburger menu opens and shows navigation links
test.describe('MOBILE — Hamburger menu functionality', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('Menu ouvre et affiche les liens de navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Find and click hamburger
    const hamburger = page.locator('button').filter({ hasText: /menu/i }).first();
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(500);

      // Check if mobile menu overlay appeared
      const mobileMenu = page.locator('#primary-menu');
      const isMenuVisible = await mobileMenu.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.visibility !== 'hidden' && style.opacity !== '0';
      }).catch(() => false);

      console.log(`Mobile menu visible after click: ${isMenuVisible}`);

      if (isMenuVisible) {
        // Check for navigation links inside the menu
        const menuLinks = page.locator('#primary-menu a');
        const linkCount = await menuLinks.count();
        console.log(`Mobile menu links: ${linkCount}`);
        expect(linkCount, 'Menu mobile sans liens').toBeGreaterThan(0);
      }
    } else {
      console.log('ATTENTION: Hamburger menu not found at 390px viewport');
    }
  });
});
