import { test, expect } from '@playwright/test';

const RESERVATION_TEMPLATE = {
  parent: 'Parent E2E Stages',
  studentName: 'Eleve Stage E2E',
  email: 'stage.e2e.contract@test.com',
  phone: '22111222',
  classe: 'Terminale',
  academyId: 'maths-p2',
  academyTitle: 'Stage Intensif Maths — Palier 2',
  price: 350,
  paymentMethod: 'transfer',
};

test.describe.serial('Stages workflow', () => {
  const uniqueEmail = `stage.e2e.contract+${Date.now()}@test.com`;
  const RESERVATION = {
    ...RESERVATION_TEMPLATE,
    email: uniqueEmail,
  };

  test('/stages -> /stages/fevrier-2026', async ({ page }) => {
    await page.goto('/stages');
    await expect(page).toHaveURL(/\/stages\/fevrier-2026/);
  });

  test('réservation stage via API', async ({ page }) => {
    const res = await page.request.post('/api/reservation', {
      data: RESERVATION,
      failOnStatusCode: false,
      headers: {
        origin: 'http://localhost:3000',
        referer: 'http://localhost:3000/stages/fevrier-2026',
      },
    });
    expect([200, 201]).toContain(res.status());
    expect((await res.json()).success).toBe(true);
  });

  test('diagnostic QCM progression + shortcuts clavier + submit', async ({ page }) => {
    await page.goto(`/stages/fevrier-2026/diagnostic?email=${encodeURIComponent(RESERVATION.email)}`);

    await expect(page.getByRole('heading', { name: /diagnostic de positionnement/i })).toBeVisible();
    await page.getByRole('button', { name: /commencer le diagnostic/i }).click();

    // 50 questions (30 Maths + 20 NSI): answer with keyboard shortcuts and submit.
    for (let i = 0; i < 75; i += 1) {
      const successTitle = page.getByText(/diagnostic terminé|résultats disponibles/i).first();
      if (await successTitle.isVisible().catch(() => false)) {
        break;
      }

      const transitionButton = page.getByRole('button', { name: /continuer vers nsi/i });
      if (await transitionButton.isVisible().catch(() => false)) {
        await transitionButton.click();
        continue;
      }

      const nextButton = page
        .getByRole('button', { name: /suivant|terminer et voir mon bilan/i })
        .first();
      if (await nextButton.isVisible().catch(() => false)) {
        await page.keyboard.press('a');
        await expect(nextButton).toBeEnabled();
        await page.keyboard.press('Enter');
      }
    }

    await expect(page.getByText(/diagnostic terminé|résultats disponibles/i).first()).toBeVisible({ timeout: 30000 });
  });
});
