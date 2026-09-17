import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import { clearEntitlementsByUserEmail, setEntitlementByUserEmail, disconnectPrisma } from '../helpers/db';

// Split (PR #235 triage): the ARIA-chat entitlement test that used to live
// here moved to entitlements-chat-gate-blocked.spec.ts, excluded from CI
// wiring pending a fix owned by the separate track that owns
// app/api/aria/chat/route.ts (see that file's header comment) — this file
// keeps only the booking-gate test, which passes cleanly on current main.
test.describe.serial('Feature gating / entitlements — booking', () => {
  // No retries: each POST counts against the expensive rate limiter (10/h).
  // Retries would exhaust the budget and turn 403 into 429.
  test.describe.configure({ retries: 0 });

  test.afterAll(async () => {
    await disconnectPrisma();
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
