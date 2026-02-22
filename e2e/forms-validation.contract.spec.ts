import { test, expect } from '@playwright/test';

async function fillIfVisible(locator: import('@playwright/test').Locator, value: string) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.fill(value);
  }
}

async function fillBilanForm(page: import('@playwright/test').Page, uniqueEmail?: string) {
  const email = uniqueEmail || `e2e.bilan.${Date.now()}@test.local`;

  await page.getByTestId('input-parent-firstname').fill('Parent');
  await page.getByTestId('input-parent-lastname').fill('Test');
  await page.getByTestId('input-parent-email').fill(email);
  await fillIfVisible(page.getByTestId('input-parent-tel'), '+21699112233');
  await fillIfVisible(page.getByTestId('input-parent-phone'), '+21699112233');
  await fillIfVisible(page.getByTestId('input-parent-password'), 'Test1234!');
  await page.getByTestId('btn-next-step').click();

  await expect(page.getByTestId('input-child-firstname')).toBeVisible();
  await page.getByTestId('input-child-firstname').fill('Eleve');
  await page.locator('input[id="studentLastName"]').fill('Test');

  await page.getByTestId('select-child-level').click();
  await page.getByRole('option', { name: /Première|Terminale|Seconde/i }).first().click();

  await page.getByTestId('select-current-level').click();
  await page.getByRole('option', { name: /Niveau moyen|Bon niveau|Excellent niveau|En difficulté/i }).first().click();

  await page.getByTestId('select-preferred-modality').click();
  await page.getByRole('option', { name: /Cours en ligne uniquement|Cours en présentiel uniquement|Cours en ligne et présentiel/i }).first().click();

  await page.locator('[data-testid^="checkbox-subject-"]').first().click();
  if (await page.getByTestId('checkbox-accept-terms').isVisible().catch(() => false)) {
    await page.getByTestId('checkbox-accept-terms').click();
  }
}

async function fillContactForm(page: import('@playwright/test').Page, data: { nom: string; email: string; message: string; phone?: string }) {
  await page.getByTestId('input-contact-nom').fill(data.nom);
  await page.getByTestId('input-contact-email').fill(data.email);
  if (data.phone) {
    await page.getByTestId('input-contact-phone').fill(data.phone);
  }
  await page.getByTestId('input-contact-message').fill(data.message);
}

test.describe('Bilan Gratuit - Validation formulaire multi-etapes', () => {
  test('Champ email parent format invalide -> message erreur', async ({ page }) => {
    await page.goto('/bilan-gratuit');
    await page.getByTestId('input-parent-email').fill('pasunemail');
    await page.getByTestId('btn-next-step').click();
    await expect(page.getByTestId('error-parent-email')).toContainText(/invalide|valide/i);
  });

  test('Double-click submit -> une seule requete API', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/bilan-gratuit', async (route) => {
      callCount += 1;
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/bilan-gratuit');
    await fillBilanForm(page);

    const submit = page.getByTestId('btn-submit-bilan');
    await submit.dblclick();
    await page.waitForTimeout(400);

    expect(callCount).toBe(1);
  });

  test('Soumission valide -> redirect assessment', async ({ page }) => {
    await page.route('**/api/bilan-gratuit', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/bilan-gratuit');
    await fillBilanForm(page);
    await page.getByTestId('btn-submit-bilan').click();

    await expect(page).toHaveURL(/\/bilan-gratuit\/assessment/);
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
    await page.getByTestId('btn-submit-contact').click();
    await expect(page.getByTestId('contact-success-message')).toHaveCount(0);
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
    await page.getByTestId('btn-submit-contact').click();

    await expect(page.getByTestId('contact-success-message')).toBeVisible();
  });

  test('API 500 -> erreur visible', async ({ page }) => {
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
    await page.getByTestId('btn-submit-contact').click();

    await expect(page.getByTestId('contact-error-message')).toBeVisible();
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
