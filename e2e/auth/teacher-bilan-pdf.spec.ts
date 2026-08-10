import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test('coach opens the canonical Maths bilan preview and PDF action', async ({ page }) => {
  await loginAsUser(page, 'coach', { navigate: false, targetPath: '/programme/maths-1ere' });
  await page.goto('/programme/maths-1ere');
  await page.getByRole('button', { name: 'Pilotage Enseignant' }).click();
  await page.getByRole('tab', { name: 'Export Bilan' }).click();

  await expect(page.getByRole('heading', { name: 'Générateur de Bilan Final' })).toBeVisible();
  await expect(page.getByText('Fiche de Bilan Individuelle')).toBeVisible();
  await expect(page.getByText('Progression et Engagement')).toBeVisible();
  await expect(page.getByText('Analyse des Compétences')).toBeVisible();
  await expect(page.getByRole('button', { name: /Télécharger PDF/i })).toBeVisible();
  await expect(page.locator('#printable-bilan img[alt="Nexus Réussite"]')).toHaveAttribute(
    'src',
    '/images/logo_slogan_nexus.png',
  );
});
