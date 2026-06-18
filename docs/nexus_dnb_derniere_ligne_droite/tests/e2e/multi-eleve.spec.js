const { test, expect } = require('@playwright/test');

const BASE = process.env.DNB_URL || 'https://nexusreussite.academy/docs_DNB/derniere-ligne-droite/';

async function clearStorage(page) {
  await page.evaluate(() => {
    try { Object.keys(localStorage).filter(k => k.startsWith('nexusDnb')).forEach(k => localStorage.removeItem(k)); } catch(e) {}
    try { sessionStorage.clear(); } catch(e) {}
  });
}

// ── Scénario multi-élèves (10 étapes) ──

test('Multi-élèves — historiques isolés', async ({ page }) => {
  await page.goto(BASE);
  await clearStorage(page);
  await page.reload();

  // 1. Créer Neil ZAYANE
  await page.fill('#nameInput', 'Neil ZAYANE');
  await page.click('button[type="submit"]');
  await expect(page.locator('#nameModal')).toBeHidden();

  // 2. Neil complète une activité
  await page.fill('[data-answer="auto:a1"]', '1/2');
  await page.fill('[data-answer="auto:a2"]', '20');
  await page.click('[data-action="check-auto"]');
  await page.waitForTimeout(300);

  // 3. XP > 0 pour Neil
  const xpNeil = Number(await page.locator('#xpMetric').textContent());
  expect(xpNeil).toBeGreaterThan(0);

  // 4. Changer vers Élève Test (via chip)
  page.once('dialog', d => d.accept());
  await page.click('#studentChip');
  await expect(page.locator('#nameModal')).toBeVisible();
  await page.fill('#nameInput', 'Élève Test');
  await page.click('button[type="submit"]');
  await expect(page.locator('#nameModal')).toBeHidden();

  // 5. Élève Test part à zéro
  const xpTest = Number(await page.locator('#xpMetric').textContent());
  expect(xpTest).toBe(0);
  await expect(page.locator('#studentChip')).toContainText('Élève Test');

  // 6. Élève Test complète une activité différente
  await page.click('a[href="#missions"]');
  await page.fill('[data-answer="percent:p1"]', '64');
  await page.click('[data-action="check-mission"][data-target="percent"]');
  await page.waitForTimeout(300);
  const xpTestAfter = Number(await page.locator('#xpMetric').textContent());
  expect(xpTestAfter).toBeGreaterThan(0);

  // 7. Revenir à Neil ZAYANE
  page.once('dialog', d => d.accept());
  await page.click('#studentChip');
  await page.fill('#nameInput', 'Neil ZAYANE');
  await page.click('button[type="submit"]');
  await expect(page.locator('#nameModal')).toBeHidden();

  // 8. XP et historique de Neil non écrasés
  const xpNeilBack = Number(await page.locator('#xpMetric').textContent());
  expect(xpNeilBack).toBe(xpNeil);
  await expect(page.locator('[data-question="auto:a1"].correct')).toBeVisible();
  await expect(page.locator('[data-question="auto:a2"].correct')).toBeVisible();

  // 9. Revenir à Élève Test
  page.once('dialog', d => d.accept());
  await page.click('#studentChip');
  await page.fill('#nameInput', 'Élève Test');
  await page.click('button[type="submit"]');

  // 10. Historique d'Élève Test distinct (XP conservé, pas celui de Neil)
  const xpTestFinal = Number(await page.locator('#xpMetric').textContent());
  expect(xpTestFinal).toBe(xpTestAfter);
  await expect(page.locator('[data-question="auto:a1"].correct')).not.toBeVisible();
});

test('Bilan nominatif contient le bon nom', async ({ page }) => {
  await page.goto(BASE);
  await clearStorage(page);
  await page.reload();
  await page.fill('#nameInput', 'Ben Rhouma');
  await page.click('button[type="submit"]');
  await page.click('a[href="#bilan"]');
  await page.click('[data-action="show-bilan"]');
  await expect(page.locator('#bilanPre')).toContainText('Ben Rhouma');
  await expect(page.locator('#bilanPre')).toContainText('Nom :');
});

test('Reset d\'un élève ne supprime pas l\'autre', async ({ page }) => {
  await page.goto(BASE);
  await clearStorage(page);
  await page.reload();

  // Créer Neil avec XP
  await page.fill('#nameInput', 'Neil ZAYANE');
  await page.click('button[type="submit"]');
  await page.fill('[data-answer="auto:a1"]', '1/2');
  await page.click('[data-action="check-auto"]');
  await page.waitForTimeout(300);
  const xpNeil = Number(await page.locator('#xpMetric').textContent());

  // Créer Élève Test avec XP
  page.once('dialog', d => d.accept());
  await page.click('#studentChip');
  await page.fill('#nameInput', 'Élève Test');
  await page.click('button[type="submit"]');
  await page.fill('[data-answer="auto:a2"]', '20');
  await page.click('[data-action="check-auto"]');
  await page.waitForTimeout(300);

  // Réinitialiser Élève Test
  page.once('dialog', d => d.accept());
  const resetBtn = page.locator('[data-action="reset"]').last();
  await resetBtn.scrollIntoViewIfNeeded();
  await resetBtn.click({ force: true });
  await page.waitForTimeout(400);
  expect(Number(await page.locator('#xpMetric').textContent())).toBe(0);

  // Revenir à Neil — son XP est intact
  page.once('dialog', d => d.accept());
  await page.click('#studentChip');
  await page.fill('#nameInput', 'Neil ZAYANE');
  await page.click('button[type="submit"]');
  const xpNeilAfter = Number(await page.locator('#xpMetric').textContent());
  expect(xpNeilAfter).toBe(xpNeil);
});
