import { test, expect } from '@playwright/test';

// Menu button is md:hidden → only visible below 768px
const MOBILE_VP = { width: 375, height: 812 };

// ── A11y: role=dialog, aria-modal, ESC, focus-return ──

test('mobile menu a11y: role, aria-modal, ESC, focus-return', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: MOBILE_VP });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const trigger = page.locator('button[aria-label="Ouvrir le menu"]');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.waitForTimeout(600);

  // role=dialog + aria-modal
  const overlay = page.locator('#primary-menu');
  await expect(overlay).toHaveAttribute('role', 'dialog');
  await expect(overlay).toHaveAttribute('aria-modal', 'true');
  await expect(overlay).toHaveAttribute('aria-label', 'Menu principal');

  // Close button should be focused (allow 1s for rAF)
  const closeBtn = page.locator('#close-menu');
  await expect(closeBtn).toBeFocused({ timeout: 2000 });

  // ESC closes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const classes = await overlay.getAttribute('class');
  expect(classes, 'menu closed after ESC').toContain('invisible');

  // Focus returned to trigger
  await expect(trigger).toBeFocused({ timeout: 2000 });

  await ctx.close();
});

// ── Focus trap ──

test('mobile menu focus trap wraps on Tab', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: MOBILE_VP });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await page.locator('button[aria-label="Ouvrir le menu"]').click();
  await page.waitForTimeout(600);

  // Close button should be focused
  await expect(page.locator('#close-menu')).toBeFocused({ timeout: 2000 });

  // Tab forward many times — focus must stay inside #primary-menu
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
  }
  await page.waitForTimeout(100);

  const isInsideMenu = await page.evaluate(() => {
    const menu = document.getElementById('primary-menu');
    return menu?.contains(document.activeElement) ?? false;
  });
  expect(isInsideMenu, 'focus stays inside menu after many Tabs').toBe(true);

  // Shift+Tab wraps backward
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Shift+Tab');
  }
  const stillInside = await page.evaluate(() => {
    const menu = document.getElementById('primary-menu');
    return menu?.contains(document.activeElement) ?? false;
  });
  expect(stillInside, 'focus stays inside menu after many Shift+Tabs').toBe(true);

  await ctx.close();
});

// ── Charte: eyebrows gold-wash + filet or ──

test('mobile menu has lux-gold-wash eyebrows and filet-gold', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: MOBILE_VP });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await page.locator('button[aria-label="Ouvrir le menu"]').click();
  await page.waitForTimeout(500);

  // Gold-wash eyebrows (3 menu groups + "Prochaine étape")
  const eyebrows = page.locator('#primary-menu .text-lux-gold-wash');
  const count = await eyebrows.count();
  expect(count, 'has gold-wash eyebrows').toBeGreaterThanOrEqual(3);

  // Filet-gold separators
  const filets = page.locator('#primary-menu .lux-filet-gold');
  const filetCount = await filets.count();
  expect(filetCount, 'has filet-gold separators').toBeGreaterThanOrEqual(3);

  await ctx.close();
});

// ── Contrast: lux-ink backdrop is dark ──

test('mobile menu backdrop is dark (lux-ink)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: MOBILE_VP });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await page.locator('button[aria-label="Ouvrir le menu"]').click();
  await page.waitForTimeout(500);

  // Check the backdrop's computed bg is dark
  const isDark = await page.evaluate(() => {
    const backdrop = document.querySelector('#primary-menu > div');
    if (!backdrop) return false;
    const bg = getComputedStyle(backdrop).backgroundColor;
    // Parse rgba(r, g, b, a) or rgb(r, g, b)
    const nums = bg.match(/[\d.]+/g);
    if (!nums || nums.length < 3) return false;
    const [r, g, b] = nums.map(Number);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.15;
  });
  expect(isDark, 'backdrop is dark lux-ink').toBe(true);

  await ctx.close();
});

// ── Screenshot recadrée 375px ──

test('screenshot mobile-menu-c2 @ mobile', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: MOBILE_VP });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await page.locator('button[aria-label="Ouvrir le menu"]').click();
  await page.waitForTimeout(600);

  await page.screenshot({
    path: 'e2e/screenshots/navbar-mobile-c2-mobile-375.png',
    fullPage: false,
  });

  await ctx.close();
});

// ── Desktop nav not broken ──

test('desktop nav still works after C2 changes', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Menu button hidden on desktop
  const menuBtn = page.locator('button[aria-label="Ouvrir le menu"]');
  await expect(menuBtn).toBeHidden();

  // Desktop dropdown works
  const offresBtn = page.locator('button:has-text("Offres & tarifs")').first();
  await offresBtn.hover();
  await page.waitForTimeout(400);
  const dropdown = page.locator('[role="menu"]').first();
  await expect(dropdown).toBeVisible();

  await ctx.close();
});
