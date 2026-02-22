import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { loginAsUser } from './helpers/auth';
import { CREDS } from './helpers/credentials';
import {
  ensureInactiveSubscriptionForStudentEmail,
  getLatestInvoiceAndUserDocumentByEmail,
  disconnectPrisma,
} from './helpers/db';

test.describe.serial('Paiements -> validation -> facture PDF -> coffre-fort', () => {
  const description = 'Abonnement Hybride E2E';
  const amount = 450;
  let paymentId = '';

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('parent déclare un virement + pending détecté', async ({ page }) => {
    const studentId = await ensureInactiveSubscriptionForStudentEmail(CREDS.student.email, 'HYBRIDE', 8);
    await loginAsUser(page, 'parent');

    const confirm = await page.request.post('/api/payments/bank-transfer/confirm', {
      data: {
        type: 'subscription',
        key: 'HYBRIDE',
        studentId,
        amount,
        description,
      },
      failOnStatusCode: false,
    });

    expect(confirm.status()).toBe(200);
    const confirmBody = await confirm.json();
    paymentId = confirmBody.paymentId;
    expect(paymentId).toBeTruthy();

    const pending = await page.request.get(
      `/api/payments/check-pending?description=${encodeURIComponent(description)}&amount=${amount}`
    );
    expect(pending.status()).toBe(200);
    expect((await pending.json()).hasPending).toBe(true);
  });

  test('staff valide le paiement puis génération facture/doc', async ({ page }) => {
    await loginAsUser(page, 'admin');

    const validate = await page.request.post('/api/payments/validate', {
      data: {
        paymentId,
        action: 'approve',
        note: 'E2E contract validation',
      },
      failOnStatusCode: false,
    });

    expect(validate.status()).toBe(200);

    const { invoice, userDocument } = await getLatestInvoiceAndUserDocumentByEmail(CREDS.parent.email);
    expect(invoice).not.toBeNull();
    expect(invoice?.status).toBe('PAID');
    expect(userDocument).not.toBeNull();

    if (userDocument?.localPath) {
      expect(fs.existsSync(userDocument.localPath)).toBeTruthy();
    }
  });

  test('parent ne voit plus pending après validation', async ({ page }) => {
    await loginAsUser(page, 'parent');

    const pending = await page.request.get(
      `/api/payments/check-pending?description=${encodeURIComponent(description)}&amount=${amount}`
    );
    expect(pending.status()).toBe(200);
    expect((await pending.json()).hasPending).toBe(false);
  });
});
