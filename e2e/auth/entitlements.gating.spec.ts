import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import { clearEntitlementsByUserEmail, setEntitlementByUserEmail, disconnectPrisma } from '../helpers/db';

test.describe.serial('Feature gating / entitlements', () => {
  // No retries: each POST counts against the expensive rate limiter (10/h).
  // Retries would exhaust the budget and turn 403 into 429.
  test.describe.configure({ retries: 0 });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('ARIA sans entitlement de cours -> erreur publique canonique 403', async ({ page }) => {
    await loginAsUser(page, 'ariaNotEntitled');

    const res = await page.request.post('/api/aria/chat', {
      data: {
        clientRequestId: randomUUID(),
        courseKey: 'eds-nsi-premiere',
        content: 'Test',
      },
      headers: { accept: 'application/json' },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({
      error: { code: 'NOT_ENTITLED', retryable: false },
    });
  });

  test('la réservation ne réintroduit pas le legacy gate credits_use', async ({ page }) => {
    await clearEntitlementsByUserEmail(CREDS.parent.email);
    await loginAsUser(page, 'parent');

    const denied = await page.request.post('/api/sessions/book', {
      data: {},
      failOnStatusCode: false,
    });

    expect(denied.status()).toBe(422);

    await setEntitlementByUserEmail(CREDS.parent.email, 'ABONNEMENT_HYBRIDE');

    const allowedThenValidated = await page.request.post('/api/sessions/book', {
      data: {},
      failOnStatusCode: false,
    });

    // Le rattachement au foyer, puis le contrat de réservation, sont la
    // frontière canonique. Un ancien produit crédits ne change pas l'erreur.
    expect(allowedThenValidated.status()).toBe(422);
  });
});
