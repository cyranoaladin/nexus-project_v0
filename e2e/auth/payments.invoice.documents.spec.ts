import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import {
  ensureInactiveSubscriptionForStudentEmail,
  getLatestInvoiceAndUserDocumentByEmail,
  disconnectPrisma,
} from '../helpers/db';
import { CGV_VERSION } from '../../lib/cgv-policy';
import { resolvePaymentCatalogItem } from '../../lib/security/payment-catalog';

test.describe.serial('Paiements -> validation -> facture PDF -> coffre-fort', () => {
  const catalogItem = resolvePaymentCatalogItem('subscription', 'HYBRIDE');
  if (!catalogItem) throw new Error('HYBRIDE is absent from the canonical payment catalog');
  const { description, amount } = catalogItem;
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
        termsAccepted: true,
        termsVersion: CGV_VERSION,
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
    const validationBody = await validate.json() as { documentId?: string | null };
    expect(validationBody.documentId).toBeTruthy();

    const { invoice, userDocument } = await getLatestInvoiceAndUserDocumentByEmail(CREDS.parent.email);
    expect(invoice).not.toBeNull();
    expect(invoice?.status).toBe('PAID');
    expect(userDocument).not.toBeNull();
    expect(userDocument?.id).toBe(validationBody.documentId);

    await loginAsUser(page, 'parent');
    const documentResponse = await page.request.get(`/api/documents/${validationBody.documentId}`, {
      failOnStatusCode: false,
    });
    expect(documentResponse.status()).toBe(200);
    expect(documentResponse.headers()['content-type']).toContain('application/pdf');
    expect(documentResponse.headers()['x-content-type-options']).toBe('nosniff');
    expect((await documentResponse.body()).byteLength).toBeGreaterThan(100);
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
