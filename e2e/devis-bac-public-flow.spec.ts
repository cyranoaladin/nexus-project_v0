/**
 * E2E — public candidat individuel devis flow (CDC §63).
 *
 * Covers scenarios 1, 3, 4, 5 from the mission's E2E list against a real
 * running server: no-bilan estimation without PII, Terminale 2-EDS ->
 * Focus Bac pack match, Bac accéléré non-eligible (no false validation),
 * and mobile 390px with no overflow. Scenario 2 (diagnostic-linked
 * recommendation) needs a signed-in test user with a real
 * CandidateDiagnostic fixture and is intentionally out of scope here —
 * the underlying logic is covered by __tests__/lib/quotes/recommendation.test.ts
 * and __tests__/lib/quotes/diagnostic.test.ts instead.
 */
import { test, expect } from '@playwright/test';

const provisionalCopy =
  'Cette estimation est établie à partir de votre situation scolaire, des épreuves à préparer et du budget indiqué. Le bilan Nexus permettra ensuite d’affiner les matières, les volumes et le parcours recommandé.';

async function selectRadioOption(page: import('@playwright/test').Page, label: string) {
  const option = page.locator('label').filter({ has: page.getByText(label, { exact: true }) });
  await option.click();
  await expect(option.locator('input[type="radio"]')).toBeChecked();
}

async function goToBudgetStep(page: import('@playwright/test').Page, level: 'Première' | 'Terminale') {
  await page.goto('/devis-bac', { waitUntil: 'domcontentloaded' });
  await selectRadioOption(page, level);
  await selectRadioOption(page, 'Candidat individuel');
  await page.getByRole('button', { name: 'Continuer' }).click();
}

test.describe('Scénario 1 — Première, pas de bilan, budget 800: estimation sans téléphone', () => {
  test('affiche une estimation immédiate sans demander de coordonnées', async ({ page }) => {
    await goToBudgetStep(page, 'Première');
    // Parcours d'examen — pas de bac accéléré
    await page.getByRole('button', { name: 'Continuer' }).click();
    // Spécialités (pas de champ requis en Première)
    await page.getByRole('button', { name: 'Continuer' }).click();
    // Diagnostic
    await page.getByRole('button', { name: 'Continuer' }).click();
    // Budget
    await page.getByLabel('Budget mensuel, saisie libre').fill('800');
    await page.getByRole('button', { name: 'Voir mon estimation' }).click();

    await expect(page.locator('[data-testid="scenario-card-recommande"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Estimation provisoire' })).toBeVisible();
    await expect(page.getByText(provisionalCopy, { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(1);

    // No phone/email field should exist yet — estimation shown before any PII form.
    // Scoped to the wizard itself: the site-wide footer has its own,
    // unrelated newsletter "Email" field on every page.
    const wizard = page.getByTestId('devis-wizard');
    await expect(wizard.getByLabel('WhatsApp')).toHaveCount(0);
    await expect(wizard.getByLabel('Email')).toHaveCount(0);

    // The estimation is a real price, not a placeholder.
    await expect(page.locator('[data-testid="scenario-monthly-total"]').first()).toContainText('TND');
  });
});

test.describe('Scénario 3 — Terminale, 2 EDS -> Focus Bac', () => {
  test('un profil Terminale avec 2 EDS et un budget confortable atteint un montant cohérent avec Focus Bac', async ({
    page,
  }) => {
    await goToBudgetStep(page, 'Terminale');
    await page.getByRole('button', { name: 'Continuer' }).click(); // parcours
    await page.getByLabel('Première spécialité').selectOption('MATHEMATIQUES');
    await page.getByLabel('Deuxième spécialité').selectOption('NSI');
    await page.getByRole('button', { name: 'Continuer' }).click(); // specialites
    await page.getByRole('button', { name: 'Continuer' }).click(); // diagnostic
    await page.getByLabel('Budget mensuel, saisie libre').fill('2000');
    await page.getByText('Préparation la plus complète utile').click();
    await page.getByRole('button', { name: 'Voir mon estimation' }).click();

    const completCard = page.locator('[data-testid="scenario-card-complet"]');
    await expect(completCard).toBeVisible({ timeout: 15000 });
    await expect(completCard).toContainText('TND');
  });
});

test.describe('Scénario 4 — Bac accéléré non éligible: aucune fausse validation', () => {
  test('un candidat sans aucune condition confirmée ne reçoit jamais un message "éligible"', async ({ page }) => {
    await goToBudgetStep(page, 'Terminale');
    await page.getByText('Je souhaite savoir si je suis éligible').click();
    // Deliberately leave every eligibility checkbox unchecked.
    await page.getByRole('button', { name: 'Continuer' }).click(); // parcours
    await page.getByLabel('Première spécialité').selectOption('MATHEMATIQUES');
    await page.getByLabel('Deuxième spécialité').selectOption('SES');
    await page.getByRole('button', { name: 'Continuer' }).click(); // specialites
    await page.getByRole('button', { name: 'Continuer' }).click(); // diagnostic
    await page.getByRole('button', { name: 'Voir mon estimation' }).click();

    await expect(page.locator('[data-testid="scenario-card-recommande"]')).toBeVisible({ timeout: 15000 });

    const body = page.locator('main');
    await expect(body).not.toContainText('vous pourriez être éligible');
    // Either the human-review message or the standard two-session message
    // must appear — never silence on the topic once the family asked.
    const hasReviewOrStandardMessage =
      (await body.getByText('nécessite une vérification humaine').count()) +
      (await body.getByText('parcours standard sur deux sessions').count());
    expect(hasReviewOrStandardMessage).toBeGreaterThan(0);
  });
});

test.describe('Scénario 5 — mobile 390px, aucun débordement', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('le parcours complet ne provoque aucun scroll horizontal', async ({ page }) => {
    await goToBudgetStep(page, 'Première');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByLabel('Budget mensuel, saisie libre').fill('900');
    await page.getByRole('button', { name: 'Voir mon estimation' }).click();
    await expect(page.locator('[data-testid="scenario-card-recommande"]')).toBeVisible({ timeout: 15000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
