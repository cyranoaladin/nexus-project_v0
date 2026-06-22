import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import {
  createPendingSubscriptionRequest,
  disconnectPrisma,
  getPlanChangeApprovalState,
} from '../helpers/db';

const BASE = process.env.BASE_URL || 'http://localhost:3002';

test.afterAll(async () => {
  await disconnectPrisma();
});

test('assistante approves a fresh plan-change request with catalog price and credits', async ({ page }) => {
  test.setTimeout(60_000);

  const reason = `E2E approval invariant ${Date.now()}`;
  const request = await createPendingSubscriptionRequest(CREDS.parent.email, {
    planName: 'IMMERSION',
    reason,
  });

  await loginAsUser(page, 'assistante', {
    targetPath: '/dashboard/assistante/subscriptions?tab=requests',
  });

  await expect(page.getByRole('heading', { name: /Gestion des abonnements/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Demandes/i })).toBeVisible();

  await page.getByPlaceholder(/Rechercher/i).fill('IMMERSION');
  const requestCard = page
    .locator('.shadow-premium')
    .filter({ hasText: 'PLAN_CHANGE' })
    .filter({ hasText: 'IMMERSION' })
    .filter({ hasText: reason })
    .first();

  await expect(requestCard, 'fresh IMMERSION request visible before approval').toBeVisible({
    timeout: 10_000,
  });
  await expect(requestCard).toContainText('750 TND');
  await expect(requestCard).toContainText(CREDS.parent.email);
  await expect(requestCard).toContainText('PENDING');

  await requestCard.getByRole('button', { name: /Voir \/ traiter/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('IMMERSION');
  await expect(dialog).toContainText('750 TND/mois');

  const successAlert = page.waitForEvent('dialog');
  await dialog.getByRole('button', { name: /Approuver/i }).click();
  const alert = await successAlert;
  expect(alert.message()).toContain('Demande approuvée avec succès');
  await alert.accept();

  await expect
    .poll(async () => {
      const state = await getPlanChangeApprovalState(request.id);
      return {
        requestStatus: state.request.status,
        planName: state.activeSubscription?.planName,
        monthlyPrice: state.activeSubscription?.monthlyPrice,
        creditsPerMonth: state.activeSubscription?.creditsPerMonth,
        creditDelta: state.creditTotal - request.initialCreditTotal,
        latestApprovalCreditAmount: state.latestApprovalCreditAmount,
      };
    }, { timeout: 10_000 })
    .toEqual({
      requestStatus: 'APPROVED',
      planName: 'IMMERSION',
      monthlyPrice: 750,
      creditsPerMonth: 8,
      creditDelta: 8,
      latestApprovalCreditAmount: 8,
    });

  await page.getByRole('tab', { name: /Actifs/i }).click();
  await page.getByPlaceholder(/Rechercher/i).fill('IMMERSION');

  const activeCard = page
    .locator('.shadow-premium')
    .filter({ hasText: 'IMMERSION' })
    .filter({ hasText: 'Yasmine Dupont' })
    .filter({ hasText: 'ACTIF' })
    .first();

  await expect(activeCard, 'approved IMMERSION subscription visible in active tab').toBeVisible({
    timeout: 10_000,
  });
  await expect(activeCard).toContainText('750 TND/mois');
  await expect(activeCard).toContainText('Crédits/mois');
  await expect(activeCard).toContainText('8');
});
