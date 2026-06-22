/**
 * Dialog charte proof — opens real dashboard modals under auth.
 *
 * What this proves: OUVERTURE + role=dialog + focus-trap + ESC + retour focus
 * + charte (filet-gold, font-fraunces, bg lux-ink) + screenshot.
 *
 * What this does NOT prove: données affichées dans la modale, soumission de formulaire.
 *
 * NOTE: Only AddChildDialog is currently mounted in the parent dashboard.
 * CreditPurchaseDialog, SubscriptionChangeDialog, InvoiceDetailsDialog, AriaAddonDialog
 * exist as files but are NOT imported/mounted anywhere — they are dead code.
 * This spec tests what is real, not what is imaginary.
 */
import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

// ── Helper: WCAG relative luminance ──
function sRGBtoLinear(c: number) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(r: number, g: number, b: number) {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}
function contrastRatio(l1: number, l2: number) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function parseCssColor(css: string): [number, number, number] | null {
  const nums = css.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return null;
  return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
}

test('add-child dialog: charte + a11y + focus + contrast', async ({ page }) => {
  test.setTimeout(60000);
  await loginAsUser(page, 'parent');
  await page.goto(`${BASE_URL}/dashboard/parent`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // ── Open dialog (MUST succeed — no early-return) ──
  const trigger = page.getByRole('button', { name: /Ajouter un Enfant/i });
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(800);

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // ── A11y: role=dialog (Radix) ──
  await expect(dialog).toHaveAttribute('role', 'dialog');

  // ── Charte: bg is dark (lux-ink) ──
  const bgCss = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
  const bgRgb = parseCssColor(bgCss);
  expect(bgRgb, 'bg color parseable').not.toBeNull();
  const bgLum = luminance(bgRgb![0], bgRgb![1], bgRgb![2]);
  expect(bgLum, 'dialog bg is dark (lux-ink)').toBeLessThan(0.05);

  // ── Charte: filet-gold present ──
  const filets = dialog.locator('.lux-filet-gold');
  const filetCount = await filets.count();
  expect(filetCount, 'filet-gold present in dialog').toBeGreaterThanOrEqual(1);

  // ── Charte: title uses Fraunces ──
  // The DialogTitle renders with font-fraunces class
  const titleEl = dialog.locator('.font-fraunces').first();
  const titleVisible = await titleEl.isVisible().catch(() => false);
  expect(titleVisible, 'Fraunces title visible in dialog').toBe(true);
  const fontFamily = await titleEl.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fontFamily.toLowerCase(), 'title font is Fraunces').toContain('fraunces');

  // ── Contrast: title text on bg ──
  const titleColorCss = await titleEl.evaluate((el) => getComputedStyle(el).color);
  const titleRgb = parseCssColor(titleColorCss);
  expect(titleRgb, 'title color parseable').not.toBeNull();
  const titleLum = luminance(titleRgb![0], titleRgb![1], titleRgb![2]);
  const titleRatio = contrastRatio(titleLum, bgLum);
  console.log(`Title contrast: ${titleRatio.toFixed(2)}:1 (AA normal ≥ 4.5)`);
  expect(titleRatio, 'title AA contrast').toBeGreaterThanOrEqual(4.5);

  // ── A11y: focus is trapped inside dialog ──
  // Tab 20 times — focus must stay inside dialog
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
  }
  const focusInside = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg?.contains(document.activeElement) ?? false;
  });
  expect(focusInside, 'focus trapped inside dialog after 20 Tabs').toBe(true);

  // ── A11y: ESC closes the dialog ──
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const dialogAfterEsc = page.locator('[role="dialog"]');
  const stillVisible = await dialogAfterEsc.isVisible().catch(() => false);
  expect(stillVisible, 'dialog closed after ESC').toBe(false);

  // ── A11y: focus returned to trigger ──
  await expect(trigger).toBeFocused({ timeout: 2000 });

  // ── Screenshot ──
  // Re-open for screenshot (dialog was closed by ESC)
  await trigger.click();
  await page.waitForTimeout(800);
  const reopened = page.locator('[role="dialog"]');
  await expect(reopened).toBeVisible({ timeout: 3000 });
  await reopened.screenshot({ path: 'e2e/screenshots/dialog-add-child-charte.png' });

  // Close cleanly
  await page.keyboard.press('Escape');
});
