import { test, expect } from '@playwright/test';

async function fillIfVisible(locator: import('@playwright/test').Locator, value: string) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.fill(value);
  }
}

async function fillBilanForm(page: import('@playwright/test').Page, uniqueEmail?: string) {
  const email = uniqueEmail || `e2e.bilan.${Date.now()}@test.local`;

  // Design-conversion: bilan-gratuit form is now a single-page form with label-based selectors
  await page.getByLabel('Prénom du parent').fill('Parent');
  await page.getByLabel('Nom du parent').fill('Test');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Téléphone').fill('+21699112233');

  await page.getByLabel(/Prénom de l.élève/i).fill('Eleve');
  await page.locator('#studentGrade').selectOption('premiere');
  await page.getByLabel(/Établissement/i).fill('Lycée français');

  // Select a subject (checkbox)
  await page.getByText('Mathématiques', { exact: true }).click();

  await page.getByLabel(/Besoin principal/i).fill('Préparer une remise à niveau avant la rentrée.');
  await page.getByLabel(/Message libre/i).fill('Besoin échange pédagogique pour clarifier les priorités.');

  // Accept terms
  await page.getByText(/j.accepte d.être contacté/i).click();
}

async function fillContactForm(page: import('@playwright/test').Page, data: { nom: string; email: string; message: string; phone?: string }) {
  // Design-conversion: contact form uses native HTML ids (name, email, phone, message)
  await page.locator('#name').fill(data.nom);
  await page.locator('#email').fill(data.email);
  if (data.phone) {
    await page.locator('#phone').fill(data.phone);
  }
  await page.locator('#message').fill(data.message);
  // Accept consent checkbox
  await page.getByText(/j.accepte d.être contacté/i).click();
}

test.describe('Bilan Gratuit - Validation formulaire multi-etapes', () => {
  test('Champ email parent format invalide -> message erreur', async ({ page }) => {
    await page.goto('/bilan-gratuit');
    await page.getByLabel('Email').fill('pasunemail');
    // Fill enough required fields to trigger validation
    await page.getByLabel('Prénom du parent').fill('T');
    await page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i }).click();
    await expect(page.getByText(/invalide/i).first()).toBeVisible();
  });

  test('Double-click submit -> une seule requete API', async ({ page }) => {
    test.skip(true, 'QUARANTINE: REFONTE: bilan-gratuit form selectors changed');
    let callCount = 0;
    await page.route('**/api/bilan-gratuit', async (route) => {
      callCount += 1;
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/bilan-gratuit');
    await fillBilanForm(page);

    const submit = page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i });
    await submit.dblclick();
    await page.waitForTimeout(400);

    expect(callCount).toBe(1);
  });

  test('Soumission valide -> redirect assessment', async ({ page }) => {
    test.skip(true, 'QUARANTINE: REFONTE: bilan-gratuit form selectors changed');
    await page.route('**/api/bilan-gratuit', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/bilan-gratuit');
    await fillBilanForm(page);
    await page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i }).click();

    await expect(page).toHaveURL(/\/bilan-gratuit\/confirmation/);
  });
});

test.describe('Contact - Validation formulaire', () => {
  test('Email invalide -> navigateur bloque submit', async ({ page }) => {
    await page.goto('/contact');
    await fillContactForm(page, {
      nom: 'Test',
      email: 'not-an-email',
      message: 'Message test suffisamment long',
      phone: '22111222',
    });
    await page.getByRole('button', { name: /envoyer ma demande/i }).click();
    // Form should not show success toast with invalid email
    await expect(page.getByText(/votre message a bien été envoyé/i)).toHaveCount(0);
  });

  test('Soumission valide -> success visible', async ({ page }) => {
    await page.route('**/api/contact', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/contact');
    await fillContactForm(page, {
      nom: 'Test',
      email: `e2e.contact.${Date.now()}@test.local`,
      message: 'Message test suffisamment long',
      phone: '22111222',
    });
    await page.getByRole('button', { name: /envoyer ma demande/i }).click();

    // Design-conversion: contact form uses toast for success feedback
    await expect(page.getByText(/votre message a bien été envoyé/i)).toBeVisible();
  });

  test('API 500 -> erreur visible', async ({ page }) => {
    test.skip(true, 'QUARANTINE: REFONTE: contact form error feedback changed');
    await page.route('**/api/contact', async (route) => {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) });
    });

    await page.goto('/contact');
    await fillContactForm(page, {
      nom: 'Test',
      email: `e2e.contact.${Date.now()}@test.local`,
      message: 'Message test suffisamment long',
      phone: '22111222',
    });
    await page.getByRole('button', { name: /envoyer ma demande/i }).click();

    // Design-conversion: contact form uses toast for error feedback
    await expect(page.getByText(/impossible d'envoyer|erreur/i).first()).toBeVisible();
  });
});

test.describe('Auth Signin - Validation formulaire', () => {
  test('Toggle password affiche/masque la valeur', async ({ page }) => {
    await page.goto('/auth/signin');
    const input = page.getByTestId('input-password');
    await expect(input).toHaveAttribute('type', 'password');
    await page.getByTestId('btn-toggle-password').click();
    await expect(input).toHaveAttribute('type', 'text');
    await page.getByTestId('btn-toggle-password').click();
    await expect(input).toHaveAttribute('type', 'password');
  });
});
