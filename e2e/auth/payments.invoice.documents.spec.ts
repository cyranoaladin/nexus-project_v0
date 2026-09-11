import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import {
  getLatestInvoiceAndUserDocumentByEmail,
  disconnectPrisma,
} from '../helpers/db';
import { CGV_VERSION } from '../../lib/cgv-policy';
import { resolvePaymentCatalogItem } from '../../lib/security/payment-catalog';

// Ce parcours vérifie le pipeline paiement -> facture -> PDF -> coffre-fort,
// pas une offre en particulier. Il ciblait à l'origine un abonnement
// (subscription/HYBRIDE), mais la vente de tout abonnement est désormais
// fermée en dur (lib/commerce/sale-suspension.ts, P0-ARIA-03 : ARIA ne
// délivre aucune matière en production) -- /api/payments/bank-transfer/confirm
// ET /api/payments/validate refusent tous deux 409 SALE_SUSPENDED pour un
// abonnement, y compris un virement déjà en attente. Cette fermeture est
// volontaire et n'est pas le bug à corriger ici : ce test bascule sur un
// pack toujours en vente (coaching Grand Oral, hors périmètre ARIA) pour
// continuer à exercer réellement le même pipeline de validation.
test.describe.serial('Paiements -> validation -> facture PDF -> coffre-fort', () => {
  const catalogItem = resolvePaymentCatalogItem('pack', 'GRAND_ORAL');
  if (!catalogItem) throw new Error('GRAND_ORAL is absent from the canonical payment catalog');
  const { description, amount } = catalogItem;
  let paymentId = '';

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('parent déclare un virement + pending détecté', async ({ page }) => {
    await loginAsUser(page, 'parent');

    const confirm = await page.request.post('/api/payments/bank-transfer/confirm', {
      data: {
        type: 'pack',
        key: 'GRAND_ORAL',
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
