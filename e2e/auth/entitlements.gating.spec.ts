import { test, expect } from '@playwright/test';
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

  // Le scenario « ARIA sans entitlement » vivait ici. Il est POSSEDE par la voie
  // ARIA : `e2e/aria/conversation.spec.ts` le joue avec la persona
  // `ariaNotEntitled` ET la fixture de modele que cette voie fournit, et le
  // mappage NOT_ENTITLED -> 403 est fige par `__tests__/lib/aria/public-errors`.
  // Reproduit ici sans cet environnement, il n'eprouvait pas la regle
  // d'habilitation : la reponse observee etait 422 UNSUPPORTED, c'est-a-dire un
  // refus survenu AVANT le controle vise. Un test qui echoue pour une autre
  // raison que celle qu'il annonce ne protege pas cette raison.

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
