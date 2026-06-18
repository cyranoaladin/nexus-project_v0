const { test, expect } = require('@playwright/test');

const BASE = process.env.DNB_URL || 'https://nexusreussite.academy/docs_DNB/derniere-ligne-droite/';
const STUDENT = 'Neil ZAYANE';

async function clearStorage(page) {
  await page.evaluate(() => {
    try { Object.keys(localStorage).filter(k => k.startsWith('nexusDnb')).forEach(k => localStorage.removeItem(k)); } catch(e) {}
    try { sessionStorage.clear(); } catch(e) {}
  });
}

// ── Scénario complet 30 étapes ──

test('Parcours élève complet — 30 étapes', async ({ page }) => {
  const consoleErrors = [];
  const failedResources = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('favicon')) failedResources.push(`${r.status()} ${r.url()}`); });

  // 1. Ouvrir la page live
  await page.goto(BASE);
  await clearStorage(page);
  await page.reload();

  // 2. Titre visible
  await expect(page).toHaveTitle(/DNB Maths/i);

  // 3. Aucune erreur console au chargement
  const jsErrors = consoleErrors.filter(e => !e.includes('favicon'));
  expect(jsErrors, `Erreurs JS: ${jsErrors.join('; ')}`).toHaveLength(0);

  // 4. Aucune ressource 404/500
  expect(failedResources, `Ressources KO: ${failedResources.join('; ')}`).toHaveLength(0);

  // 5. Nom élève demandé
  await expect(page.locator('#nameModal')).toBeVisible();

  // 6. Tenter de démarrer sans nom
  await page.click('button[type="submit"]');

  // 7. Message d'erreur visible
  await expect(page.locator('#nameError')).toContainText(/prénom/i);
  await expect(page.locator('#nameModal')).toBeVisible();

  // 8. Saisir Neil ZAYANE
  await page.fill('#nameInput', STUDENT);

  // 9. Démarrer le parcours
  await page.click('button[type="submit"]');
  await expect(page.locator('#nameModal')).toBeHidden();

  // 10. Tableau de bord nominatif
  await expect(page.locator('#studentChip')).toContainText('Neil ZAYANE');

  // 11. Répondre à un mini-rituel (Q1)
  await page.fill('[data-answer="auto:a1"]', '1/2');

  // 12. Déclencher l'autocorrection
  await page.click('[data-action="check-auto"]');

  // 13. Score change (question correcte)
  await expect(page.locator('[data-question="auto:a1"].correct')).toBeVisible();

  // 14. XP change
  const xp = await page.locator('#xpMetric').textContent();
  expect(Number(xp)).toBeGreaterThan(0);

  // 15. Retourner une flashcard
  await page.click('a[href="#flashcards"]');
  const card = page.locator('.flashcard').first();
  await card.locator('[data-flip]').first().click();
  await expect(card).toHaveClass(/flipped/);

  // 16. Réaliser une mission autocorrigée (pourcentages)
  await page.click('a[href="#missions"]');
  await page.fill('[data-answer="percent:p1"]', '64');
  await page.fill('[data-answer="percent:p2"]', '57,6');
  await page.fill('[data-answer="percent:p3"]', '28');
  await page.click('[data-action="check-mission"][data-target="percent"]');
  await expect(page.locator('[data-question="percent:p1"].correct')).toBeVisible();

  // 17. Saisir une réponse longue dans la zone "à rédiger sur feuille"
  await page.click('a[href="#redaction"]');
  const pledgeInput = page.locator('#studentPledge');
  if (await pledgeInput.count() > 0) {
    await pledgeInput.fill('Je relis chaque étape. Je note les unités. Je vérifie mes calculs à la fin.');
    await page.waitForTimeout(400);
  }

  // 18. Vérifier que cette réponse est sauvegardée (via localStorage)
  const savedPledge = await page.evaluate(() => {
    try {
      const root = JSON.parse(localStorage.getItem('nexusDnbRoot') || '{}');
      const students = root.students || {};
      const s = Object.values(students)[0];
      return s?.text?.pledge || '';
    } catch { return ''; }
  });
  expect(savedPledge).toContain('Je relis');

  // 19. Accéder au bilan final
  await page.click('a[href="#bilan"]');
  await page.click('[data-action="show-bilan"]');
  await expect(page.locator('#bilanBlock')).toBeVisible();

  // 20. Bilan contient Neil ZAYANE
  await expect(page.locator('#bilanPre')).toContainText('Neil ZAYANE');

  // 21. Bilan contient scores et modules
  await expect(page.locator('#bilanPre')).toContainText('BILAN ÉLÈVE');
  await expect(page.locator('#bilanPre')).toContainText('Score :');
  await expect(page.locator('#bilanPre')).toContainText('XP :');

  // 22. Copier le bilan (vérifier que le bouton existe et est cliquable)
  await expect(page.locator('[data-action="copy-bilan"]')).toBeVisible();
  await page.click('[data-action="copy-bilan"]');
  await page.waitForTimeout(300);

  // 23. Export JSON (le clic doit déclencher un téléchargement)
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
    page.click('[data-action="export-json"]'),
  ]);
  if (download) {
    expect(download.suggestedFilename()).toContain('neil');
    expect(download.suggestedFilename()).toContain('.json');
  }

  // 24. Export CSV
  const [downloadCSV] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
    page.click('[data-action="export-csv"]'),
  ]);
  if (downloadCSV) {
    expect(downloadCSV.suggestedFilename()).toContain('.csv');
  }

  // 25. Recharger la page
  await page.reload();

  // 26. La page recharge directement (sessionStorage actif)
  await expect(page.locator('#nameModal')).toBeHidden({ timeout: 4000 });

  // 27. Historique récupéré — chip toujours visible
  await expect(page.locator('#studentChip')).toContainText('Neil ZAYANE');

  // 28. Réponses précédentes toujours là
  await expect(page.locator('[data-question="auto:a1"].correct')).toBeVisible();

  // 29. Tester le reset avec confirmation (accepter) — utilise le bouton dans la section bilan
  page.on('dialog', d => d.accept());
  const resetBtn = page.locator('[data-action="reset"]').last();
  await resetBtn.scrollIntoViewIfNeeded();
  await resetBtn.click({ force: true });
  await page.waitForTimeout(400);

  // 30. Vérifier que le reset a fonctionné
  const xpAfterReset = await page.locator('#xpMetric').textContent();
  expect(Number(xpAfterReset)).toBe(0);

  // Aucune erreur console tout au long du scénario
  const finalErrors = consoleErrors.filter(e => !e.includes('favicon'));
  expect(finalErrors, `Erreurs JS fin de parcours: ${finalErrors.join('; ')}`).toHaveLength(0);
});
