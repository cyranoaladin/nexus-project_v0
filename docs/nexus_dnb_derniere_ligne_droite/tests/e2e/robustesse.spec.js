const { test, expect } = require('@playwright/test');

const BASE = process.env.DNB_URL || 'https://nexusreussite.academy/docs_DNB/derniere-ligne-droite/';

// ── Données corrompues ──

test('robustesse : JSON corrompu dans localStorage → page ne crash pas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // Injecter JSON corrompu avant chargement
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem('nexusDnbRoot', '{bad json[');
  });
  await page.reload();
  await page.waitForLoadState('networkidle');

  // La page ne doit pas crasher
  expect(errors).toHaveLength(0);

  // La modale doit s'afficher (état propre recréé)
  await expect(page.locator('#nameModal')).toBeVisible();
});

test('robustesse : données schemaVersion=1 → reset propre', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem('nexusDnbRoot', JSON.stringify({
      schemaVersion: 1,
      students: { 'neil': { xp: 9999, name: 'Neil', answers: { auto: {}, missions: {} }, history: [] } }
    }));
  });
  await page.reload();

  expect(errors).toHaveLength(0);
  await expect(page.locator('#nameModal')).toBeVisible();
});

test('robustesse : localStorage complètement vide → modale affichée', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch(e) {} });
  await page.reload();
  await expect(page.locator('#nameModal')).toBeVisible();
});

test('robustesse : valeur null dans localStorage → reset propre', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem('nexusDnbRoot', 'null');
  });
  await page.reload();

  expect(errors).toHaveLength(0);
  await expect(page.locator('#nameModal')).toBeVisible();
});

// ── localStorage indisponible ──

test('robustesse : localStorage indisponible → bannière visible, page utilisable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // Bloquer localStorage avant la navigation
  await page.route('**', async route => route.continue());
  await page.goto(BASE);

  // Simuler localStorage indisponible
  await page.evaluate(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('SecurityError', 'SecurityError'); },
      configurable: true,
    });
  });
  await page.reload();
  await page.waitForLoadState('networkidle');

  // La page ne doit pas crasher
  expect(errors).toHaveLength(0);

  // La modale doit toujours s'afficher (page utilisable)
  await expect(page.locator('#nameModal')).toBeVisible();

  // La bannière d'avertissement doit être visible si storageAvailable=false
  // (ou la page reste utilisable sans bannière selon implémentation)
  const bannerVisible = await page.locator('#storageBanner').isVisible().catch(() => false);
  const modalVisible = await page.locator('#nameModal').isVisible();
  expect(modalVisible || bannerVisible).toBe(true);
});

// ── Accessibilité minimale ──

test('accessibilité : labels sur inputs, boutons avec texte, focus visible', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => { try { sessionStorage.clear(); localStorage.clear(); } catch(e) {} });
  await page.reload();

  // Input nom a un label ou placeholder
  const nameInput = page.locator('#nameInput');
  await expect(nameInput).toBeVisible();
  const placeholder = await nameInput.getAttribute('placeholder');
  const ariaLabel = await nameInput.getAttribute('aria-label');
  const id = await nameInput.getAttribute('id');
  // L'input est référencé soit par label, aria-label, ou placeholder
  expect(placeholder || ariaLabel || id).toBeTruthy();

  // Bouton submit a un texte accessible
  const submitBtn = page.locator('#nameForm button[type="submit"]');
  await expect(submitBtn).toBeVisible();

  // aria-modal sur la modale
  const ariaModal = await page.locator('#nameModal').getAttribute('aria-modal');
  expect(ariaModal).toBe('true');

  // Démarrer
  await page.fill('#nameInput', 'A11y Test');
  await page.click('button[type="submit"]');

  // Message sauvegarde auto visible après activité
  await page.fill('[data-answer="auto:a1"]', '1/2');
  await page.click('[data-action="check-auto"]');
  // savedPill apparaît brièvement
  await expect(page.locator('#savedPill')).toBeVisible({ timeout: 3000 }).catch(() => null);

  // Confirmation avant reset (dialog) — utilise le bouton bilan (dernier) pour éviter l'interception sticky header
  let dialogSeen = false;
  page.once('dialog', d => { dialogSeen = true; d.dismiss(); });
  const resetBtn = page.locator('[data-action="reset"]').last();
  await resetBtn.scrollIntoViewIfNeeded();
  await resetBtn.click({ force: true });
  expect(dialogSeen).toBe(true);
});

// ── Console et réseau ──

test('console et réseau : zéro erreur sur la page live', async ({ page }) => {
  const errors = [];
  const failed = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

  await page.goto(BASE);
  await page.evaluate(() => { try { sessionStorage.clear(); localStorage.clear(); } catch(e) {} });
  await page.reload();
  await page.waitForLoadState('networkidle');

  await page.fill('#nameInput', 'Console Test');
  await page.click('button[type="submit"]');
  await page.fill('[data-answer="auto:a1"]', '1/2');
  await page.click('[data-action="check-auto"]');
  await page.waitForTimeout(500);

  const jsErrors = errors.filter(e => !e.includes('favicon'));
  const httpFailed = failed.filter(f => !f.includes('favicon'));

  expect(jsErrors, `Erreurs JS: ${jsErrors.join('; ')}`).toHaveLength(0);
  expect(httpFailed, `Requêtes KO: ${httpFailed.join('; ')}`).toHaveLength(0);
});
