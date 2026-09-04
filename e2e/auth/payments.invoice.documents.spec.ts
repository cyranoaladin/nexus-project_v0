/**
 * Paiement valide par le staff -> facture -> coffre-fort.
 *
 * Ce scenario partait d'un achat d'ABONNEMENT. Cette surface est desormais
 * FERMEE par decision commerciale — `lib/commerce/sale-suspension.ts` suspend
 * SUBSCRIPTION_PLAN et ARIA_ADDON tant que la plateforme ARIA ne delivre pas —
 * et l'API repond 409 SALE_SUSPENDED. Le test attendait 200 : il echouait sur
 * une premisse devenue fausse, pas sur la chaine qu'il pretend eprouver.
 *
 * La fermeture est verifiee ici pour elle-meme, puis la chaine complete est
 * jouee sur une surface RESTEE OUVERTE : les packs reposent sur des seances
 * reellement assurees. Toutes les assertions d'origine sont conservees —
 * declaration, detection du pending, validation staff, facture PAID, document
 * en coffre-fort, telechargement PDF, extinction du pending.
 */
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
  // Surface OUVERTE : un pack repose sur des seances assurees.
  const pack = resolvePaymentCatalogItem('pack', 'GRAND_ORAL');
  if (!pack) throw new Error('GRAND_ORAL is absent from the canonical payment catalog');
  const { description, amount } = pack;
  let paymentId = '';

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('la vente d’abonnement est fermee : le serveur refuse, il ne masque pas', async ({ page }) => {
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

    expect(confirm.status(), 'une surface suspendue refuse la declaration de virement').toBe(409);
    expect(await confirm.json()).toMatchObject({ code: 'SALE_SUSPENDED' });
  });

  test('parent déclare un virement sur une surface ouverte + pending détecté', async ({ page }) => {
    const studentId = await ensureInactiveSubscriptionForStudentEmail(CREDS.student.email, 'HYBRIDE', 8);
    await loginAsUser(page, 'parent');

    const confirm = await page.request.post('/api/payments/bank-transfer/confirm', {
      data: {
        type: 'pack',
        key: 'GRAND_ORAL',
        studentId,
        amount,
        description,
        termsAccepted: true,
        termsVersion: CGV_VERSION,
      },
      failOnStatusCode: false,
    });

    expect(confirm.status(), await confirm.text()).toBe(200);
    paymentId = (await confirm.json()).paymentId;
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
