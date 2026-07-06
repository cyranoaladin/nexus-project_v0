import { test, expect } from '@playwright/test';
import { CGV_POLICY } from '@/lib/cgv-policy';

test.describe('Bilan Gratuit — Formulaire stratégique', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bilan-gratuit');
    await page.waitForSelector('#parentFirstName', { state: 'visible', timeout: 10000 });
  });

  test('page charge avec h1 et formulaire visible', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Bilan stratégique gratuit');
    await expect(page.locator('#parentFirstName')).toBeVisible();
    await expect(page.locator('#parentEmail')).toBeVisible();
  });

  test('(a) validation affiche erreurs sur soumission vide — clic réel', async ({ page }) => {
    await page.getByRole('button', { name: /bilan stratégique/i }).click();
    await expect(page.locator('text=Prénom requis')).toBeVisible();
    await expect(page.locator('text=Email invalide')).toBeVisible();
    await expect(page.locator('text=Classe requise')).toBeVisible();
  });

  test('(b) email invalide après remplissage complet — clic réel', async ({ page }) => {
    await page.locator('#parentFirstName').fill('Marie');
    await page.locator('#parentLastName').fill('Dupont');
    await page.locator('#parentEmail').fill('pas-un-email');
    await page.locator('#parentPhone').fill('+21699192829');
    await page.locator('#studentFirstName').fill('Lucas');
    await page.locator('#studentGrade').selectOption({ index: 1 });
    await page.locator('#studentSchool').fill('Lycée Gustave Flaubert');
    await page.locator('#objectives').fill('Préparer le bac de français avec sérieux et méthode');
    await expect(page.locator('#parentEmail')).toHaveValue('pas-un-email');
    // Real click — noValidate on <form> prevents HTML5 constraint blocking
    await page.getByRole('button', { name: /bilan stratégique/i }).click();
    await expect(page.locator('text=Email invalide')).toBeVisible();
    await expect(page.locator('text=Prénom requis')).not.toBeVisible();
    await expect(page.locator('text=Classe requise')).not.toBeVisible();
  });

  test('erreur disparaît quand email valide est saisi', async ({ page }) => {
    await page.getByRole('button', { name: /bilan stratégique/i }).click();
    await expect(page.locator('text=Email invalide')).toBeVisible();
    await page.locator('#parentEmail').fill('marie@example.com');
    await expect(page.locator('text=Email invalide')).not.toBeVisible();
  });

  test('formulaire affiche les champs principaux', async ({ page }) => {
    for (const id of ['parentFirstName','parentLastName','parentEmail','parentPhone','studentFirstName','objectives']) {
      await expect(page.locator('#' + id)).toBeVisible();
    }
  });

  test('page confirmation existe', async ({ page }) => {
    await page.goto('/bilan-gratuit/confirmation');
    await expect(page.getByText(/félicitations|confirmé|créé|enregistré|merci/i)).toBeVisible();
  });

  test('CTA WhatsApp est visible', async ({ page }) => {
    await expect(page.locator('a[href*="wa.me"]').first()).toBeVisible();
  });

  test('offre repérée visible sans exposition ClicToPay ni RIB public', async ({ page }) => {
    const response = await page.request.get('/bilan-gratuit?offer=term-spe-simple');
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).not.toContain('BAILOUT_TO_CLIENT_SIDE_RENDERING');
    expect(html).toContain('Offre repérée');
    expect(html).toContain('Terminale Spécialité simple');
    expect(html).toContain('Paiement confirmé après validation pédagogique');
    expect(html).not.toContain(CGV_POLICY.payment.provider);
    expect(html).not.toContain(CGV_POLICY.payment.bank);
    expect(html).not.toContain('25 079 000 0001569084 04');
    expect(html).not.toContain('TN59 25 079 000 0001569084 04');
  });

  test('analytics non essentiels absents du HTML initial sans opt-in explicite', async ({ page }) => {
    const response = await page.request.get('/bilan-gratuit');
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).not.toContain('googletagmanager.com/gtag/js');
    expect(html).not.toContain('gtag-init');
  });
});
