/**
 * Dialog proof per role — opens REAL modals under auth for each dashboard role.
 *
 * For each modal: ouverture (no early-return) + role=dialog + focus-trap +
 * ESC ferme + retour focus + charte (bg lux-ink, filet or, titre Fraunces)
 * + animation settled (opacity=1).
 *
 * Some modals are hard to reach (require pre-existing data or specific UI state).
 * These are documented inline. We test what is reachable, not what is imaginary.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

const BASE = process.env.BASE_URL || 'http://localhost:3002';

// ── Helpers ──

function sRGBtoLinear(c: number) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function luminance(r: number, g: number, b: number) { return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b); }
function contrastRatio(l1: number, l2: number) { return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

async function assertDialogCharte(page: Page, dialogLabel: string) {
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog, `${dialogLabel}: visible`).toBeVisible({ timeout: 5000 });

  // role=dialog
  await expect(dialog).toHaveAttribute('role', 'dialog');

  // bg is dark (lux-ink)
  const bg = await dialog.evaluate(el => getComputedStyle(el).backgroundColor);
  const bgNums = bg.match(/[\d.]+/g)?.map(Number);
  expect(bgNums, `${dialogLabel}: bg parseable`).toBeTruthy();
  const bgLum = luminance(bgNums![0], bgNums![1], bgNums![2]);
  expect(bgLum, `${dialogLabel}: bg dark`).toBeLessThan(0.05);

  // Animation settled: opacity = 1 (not mid-transition)
  const opacity = await dialog.evaluate(el => getComputedStyle(el).opacity);
  expect(opacity, `${dialogLabel}: opacity settled`).toBe('1');

  const filet = dialog.locator('.lux-filet-gold').first();
  await expect(filet, `${dialogLabel}: gold filet`).toBeVisible();

  const title = dialog.locator('.font-fraunces').first();
  await expect(title, `${dialogLabel}: Fraunces title marker`).toBeVisible();
  const titleFont = await title.evaluate(el => getComputedStyle(el).fontFamily);
  expect(titleFont.toLowerCase(), `${dialogLabel}: Fraunces title font`).toContain('fraunces');

  // Focus trapped: 15 Tabs stay inside
  for (let i = 0; i < 15; i++) await page.keyboard.press('Tab');
  const trapped = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg?.contains(document.activeElement) ?? false;
  });
  expect(trapped, `${dialogLabel}: focus trapped`).toBe(true);

  // AA contrast: find first visible text inside dialog
  const textEl = dialog.locator('h2, h3, label, p, span').first();
  if (await textEl.isVisible().catch(() => false)) {
    const color = await textEl.evaluate(el => getComputedStyle(el).color);
    const cNums = color.match(/[\d.]+/g)?.map(Number);
    if (cNums && cNums.length >= 3) {
      const textLum = luminance(cNums[0], cNums[1], cNums[2]);
      const ratio = contrastRatio(textLum, bgLum);
      console.log(`${dialogLabel}: text contrast ${ratio.toFixed(1)}:1`);
      expect(ratio, `${dialogLabel}: AA contrast`).toBeGreaterThanOrEqual(4.5);
    }
  }
}

async function assertDialogCloses(page: Page, trigger: ReturnType<Page['locator']>, label: string) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const gone = !(await page.locator('[role="dialog"]').isVisible().catch(() => false));
  expect(gone, `${label}: ESC closes`).toBe(true);

  // Focus returned to trigger
  const triggerFocused = await trigger.evaluate(el => el === document.activeElement).catch(() => false);
  expect(triggerFocused, `${label}: focus returns to trigger`).toBe(true);
}

// ── PARENT ──

test('parent: add-child dialog', async ({ page }) => {
  test.setTimeout(60000);
  await loginAsUser(page, 'parent');
  await page.goto(`${BASE}/dashboard/parent`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const trigger = page.getByRole('button', { name: /Ajouter un Enfant/i });
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(500);

  await assertDialogCharte(page, 'parent/add-child');
  await assertDialogCloses(page, trigger, 'parent/add-child');
});

test('parent: abonnements plan-change dialog', async ({ page }) => {
  test.setTimeout(60000);
  await loginAsUser(page, 'parent');
  await page.goto(`${BASE}/dashboard/parent/abonnements`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click "Changer pour ..." button (any plan different from current)
  const trigger = page.getByRole('button', { name: /Changer pour/i }).first();
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(500);

  await assertDialogCharte(page, 'parent/abonnements');
  await assertDialogCloses(page, trigger, 'parent/abonnements');
});

test('parent: paiement virement dialog', async ({ page }) => {
  test.setTimeout(60000);
  await loginAsUser(page, 'parent');
  await page.goto(`${BASE}/dashboard/parent/paiement?plan=HYBRIDE`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.getByTestId('checkbox-accept-cgv').check();
  await page.getByTestId('checkbox-immediate-execution').check();

  // The virement dialog is triggered by "Payer par Virement" button
  const trigger = page.getByRole('button', { name: /virement/i }).first();
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await page.waitForTimeout(500);

  await assertDialogCharte(page, 'parent/paiement');
  await assertDialogCloses(page, trigger, 'parent/paiement');
});

// ── ADMIN ──

test('admin: users detail dialog', async ({ page }) => {
  test.setTimeout(60000);
  await loginAsUser(page, 'admin');
  await page.goto(`${BASE}/dashboard/admin/users`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Table row action buttons are icon-only (Eye icon) — click first action button in table
  const trigger = page.locator('table button, [role="table"] button, tr button').first();
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(500);

  await assertDialogCharte(page, 'admin/users');
  await assertDialogCloses(page, trigger, 'admin/users');
});

// ── ASSISTANTE ──

test('assistante: create-student dialog', async ({ page }) => {
  test.setTimeout(60000);
  await loginAsUser(page, 'assistante');
  await page.goto(`${BASE}/dashboard/assistante/students`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // The dialog trigger is "Créer" / "Nouveau" button (creates parent+student)
  const trigger = page.getByRole('button', { name: /créer|nouveau|ajouter/i }).first();
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(500);

  await assertDialogCharte(page, 'assistante/students');
  await assertDialogCloses(page, trigger, 'assistante/students');
});

test('assistante: credit-requests dialog', async ({ page }) => {
  test.setTimeout(60000);
  await loginAsUser(page, 'assistante');
  await page.goto(`${BASE}/dashboard/assistante/credit-requests`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const trigger = page.getByRole('button', { name: /voir détails/i }).first();
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(500);

  await assertDialogCharte(page, 'assistante/credit-requests');
  await assertDialogCloses(page, trigger, 'assistante/credit-requests');
});
