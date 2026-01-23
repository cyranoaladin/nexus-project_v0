import { test, expect } from '@playwright/test';

test.describe('Parcours visiteur - Home', () => {
  test('parcours complet et sections clés', async ({ page }) => {
    await page.goto('/');

    const heroHeading = page.getByRole('heading', {
      name: /Votre vision éducative, enfin réalisable/i,
    });
    await expect(heroHeading).toBeVisible();

    await expect(
      page.getByRole('link', { name: /Parler à un expert/i })
    ).toBeVisible();

    const adnTitle = page.getByText('Notre ADN Unique', { exact: false });
    await adnTitle.scrollIntoViewIfNeeded();
    await expect(adnTitle).toBeVisible();
    await expect(
      page.getByText('Une équipe bilingue rare', { exact: false })
    ).toBeVisible();

    const impactTitle = page.getByRole('heading', {
      name: /Impact mesurable, confiance durable/i,
    });
    await impactTitle.scrollIntoViewIfNeeded();
    await expect(impactTitle).toBeVisible();
    await expect(
      page.getByText('-30% temps administratif', { exact: true })
    ).toBeVisible();

    const methodTitle = page.getByText('Diagnostic sur mesure', { exact: true });
    await methodTitle.scrollIntoViewIfNeeded();
    await expect(methodTitle).toBeVisible();

    const korrigoTitle = page.getByRole('heading', {
      name: /Nos Réalisations : La Preuve par l'Exemple/i,
    });
    await korrigoTitle.scrollIntoViewIfNeeded();
    await expect(korrigoTitle).toBeVisible();

    const tabParents = page.getByRole('button', {
      name: /Parents & Élèves/i,
    });
    await tabParents.click();
    await expect(
      page.getByText('Pack Excellence', { exact: true })
    ).toBeVisible();

    const smartFeedback = page.getByText('Smart Feedback (IA + RAG)', {
      exact: true,
    });
    await smartFeedback.scrollIntoViewIfNeeded();
    await expect(smartFeedback).toBeVisible();

    const liveHarmonizer = page.getByText('Live Harmonizer', { exact: true });
    await expect(liveHarmonizer).toBeVisible();

    const contactCta = page.getByRole('link', {
      name: /Contact \/ Audit/i,
    });
    await contactCta.click();
    await expect(page).toHaveURL(/\/contact$/);
  });
});
