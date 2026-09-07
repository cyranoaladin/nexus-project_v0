import { expect, test } from '@playwright/test';
import { loginAsUser } from '../../helpers/auth';

test.describe('Maths Première — pilotage coach', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'coach', { navigate: false, targetPath: '/programme/maths-1ere' });
    await page.goto('/programme/maths-1ere');
  });

  test('le rôle coach expose le cockpit enseignant canonique', async ({ page }) => {
    await page.getByRole('button', { name: 'Pilotage Enseignant' }).click();
    await expect(page.getByRole('heading', { name: 'Cockpit de Pilotage Enseignant' })).toBeVisible();
    for (const tab of ['Profil Élève', 'Pilotage Groupe', 'Programme', 'Plan de Séance', 'Export Bilan']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
    await expect(page.getByRole('tab', { name: 'RAG Augmenté' })).toHaveCount(0);
  });

  test('aucune ancienne date de campagne n’est réintroduite', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('20 avril – 1er mai 2026');
  });
});
