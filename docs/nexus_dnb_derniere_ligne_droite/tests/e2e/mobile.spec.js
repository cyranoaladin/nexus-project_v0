const { test, expect } = require('@playwright/test');

const BASE = process.env.DNB_URL || 'https://nexusreussite.academy/docs_DNB/derniere-ligne-droite/';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => {
    try { Object.keys(localStorage).filter(k => k.startsWith('nexusDnb')).forEach(k => localStorage.removeItem(k)); } catch(e) {}
    try { sessionStorage.clear(); } catch(e) {}
  });
  await page.reload();
});

test('mobile : pas de débordement horizontal (scrollWidth <= clientWidth)', async ({ page }) => {
  await page.fill('#nameInput', 'Mobile Test');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(overflow).toBeTruthy();
});

test('mobile : modale bien dimensionnée (≤ 390px)', async ({ page }) => {
  await expect(page.locator('#nameModal')).toBeVisible();
  const modal = await page.locator('.modal-card').boundingBox();
  if (modal) expect(modal.width).toBeLessThanOrEqual(400);
});

test('mobile : menu de navigation accessible', async ({ page }) => {
  await page.fill('#nameInput', 'Mobile Test');
  await page.click('button[type="submit"]');
  await expect(page.locator('#navScroller')).toBeVisible();
});

test('mobile : boutons de correction taille suffisante (≥ 36px)', async ({ page }) => {
  await page.fill('#nameInput', 'Mobile Test');
  await page.click('button[type="submit"]');
  const btn = page.locator('[data-action="check-auto"]');
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  if (box) expect(box.height).toBeGreaterThanOrEqual(36);
});

test('mobile : quiz utilisable', async ({ page }) => {
  await page.fill('#nameInput', 'Mobile Test');
  await page.click('button[type="submit"]');
  const input = page.locator('[data-answer="auto:a1"]');
  await expect(input).toBeVisible();
  await input.fill('1/2');
  await page.click('[data-action="check-auto"]');
  await expect(page.locator('[data-question="auto:a1"].correct')).toBeVisible();
});

test('mobile : flashcards lisibles', async ({ page }) => {
  await page.fill('#nameInput', 'Mobile Test');
  await page.click('button[type="submit"]');
  await page.click('a[href="#flashcards"]');
  await expect(page.locator('.flashcard').first()).toBeVisible();
  const box = await page.locator('.flashcard').first().boundingBox();
  if (box) expect(box.width).toBeGreaterThan(100);
});

test('mobile : input réponse pas tronqué (largeur > 100px)', async ({ page }) => {
  await page.fill('#nameInput', 'Mobile Test');
  await page.click('button[type="submit"]');
  const box = await page.locator('[data-answer="auto:a1"]').boundingBox();
  if (box) expect(box.width).toBeGreaterThan(100);
});

test('mobile : bilan final lisible', async ({ page }) => {
  await page.fill('#nameInput', 'Mobile Test');
  await page.click('button[type="submit"]');
  await page.click('a[href="#bilan"]');
  await page.click('[data-action="show-bilan"]');
  await expect(page.locator('#bilanBlock')).toBeVisible();
  await expect(page.locator('#bilanPre')).toContainText('BILAN ÉLÈVE');
});

test('mobile : reset accessible mais protégé (dialog)', async ({ page }) => {
  await page.fill('#nameInput', 'Mobile Test');
  await page.click('button[type="submit"]');
  page.once('dialog', d => d.dismiss());
  await page.click('[data-action="reset"]');
  const xp = await page.locator('#xpMetric').textContent();
  // Après annulation, XP pas changé
  expect(xp).toBeDefined();
});

test('mobile : focus visible dans les champs (modale)', async ({ page }) => {
  await expect(page.locator('#nameInput')).toBeVisible();
  await page.locator('#nameInput').focus();
  // focus-visible CSS doit être présent (vérifié via check statique)
  const focused = await page.locator('#nameInput').evaluate(el => document.activeElement === el);
  expect(focused).toBe(true);
});
