import { test, expect } from '@playwright/test';

test.describe('StageReservationModal a11y', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-modal', { waitUntil: 'domcontentloaded' });
    // Wait for hydration
    await page.locator('#open-modal-btn').waitFor({ state: 'visible', timeout: 15000 });
  });

  test('auto-focus first input on open', async ({ page }) => {
    const openBtn = page.locator('#open-modal-btn');
    await openBtn.click();
    await page.waitForTimeout(200);

    // Modal should be visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // First input should be focused
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBe('INPUT');

    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe('sr-parent');
  });

  test('Escape closes modal', async ({ page }) => {
    await page.locator('#open-modal-btn').click();
    await page.waitForTimeout(200);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await expect(dialog).not.toBeVisible();
  });

  test('focus restored after close', async ({ page }) => {
    const openBtn = page.locator('#open-modal-btn');
    await openBtn.focus();
    await openBtn.click();
    await page.waitForTimeout(200);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe('open-modal-btn');
  });

  test('Tab traps focus within modal (forward + backward)', async ({ page }) => {
    await page.locator('#open-modal-btn').click();
    await page.waitForTimeout(200);

    // Get all focusable elements inside dialog
    const focusableIds = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];
      const els = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(els).map((el) => el.id || el.tagName + '.' + el.type);
    });

    expect(focusableIds.length).toBeGreaterThan(2);

    // Tab to last element
    const lastId = focusableIds[focusableIds.length - 1];
    // Focus the last element directly
    await page.evaluate((sel) => {
      const dialog = document.querySelector('[role="dialog"]');
      const els = dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      els?.[els.length - 1]?.focus();
    }, lastId);

    // Tab forward from last → should wrap to first
    await page.keyboard.press('Tab');
    const afterForwardWrap = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const els = dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return document.activeElement === els?.[0];
    });
    expect(afterForwardWrap, 'Tab wraps forward to first').toBe(true);

    // Shift+Tab from first → should wrap to last
    await page.keyboard.press('Shift+Tab');
    const afterBackwardWrap = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const els = dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return document.activeElement === els?.[els.length - 1];
    });
    expect(afterBackwardWrap, 'Shift+Tab wraps backward to last').toBe(true);
  });

  test('CTA button has gold background (lux-cta-reserve computed)', async ({ page }) => {
    await page.locator('#open-modal-btn').click();
    await page.waitForTimeout(200);

    const ctaStyles = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const cta = dialog?.querySelector('button[type="submit"]');
      if (!cta) return null;
      const cs = getComputedStyle(cta);
      return {
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        hasLuxCtaReserve: cta.className.includes('lux-cta-reserve'),
      };
    });

    expect(ctaStyles).not.toBeNull();
    expect(ctaStyles!.hasLuxCtaReserve, 'CTA has lux-cta-reserve class').toBe(true);
    // Background should not be transparent (gold CTA is painted)
    expect(ctaStyles!.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(ctaStyles!.backgroundColor).not.toBe('transparent');

    await page.screenshot({ path: 'e2e/screenshots/stage-reservation-modal-a11y.png' });
  });

  test('dialog has correct ARIA attributes', async ({ page }) => {
    await page.locator('#open-modal-btn').click();
    await page.waitForTimeout(200);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-label', /Réserver/);
  });
});
