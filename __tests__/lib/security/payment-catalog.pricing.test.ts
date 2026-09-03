/**
 * Cubic P2 — canonical catalog pricing regression proof.
 *
 * `payments.bank-transfer.confirm.test.ts` used to prove the server ignores
 * a client-supplied amount/description for a SUBSCRIPTION (HYBRIDE)
 * purchase with an EXACT price assertion. That scenario is no longer
 * reachable through the route itself: SUBSCRIPTION_PLAN is now a suspended
 * sale surface (P0-ARIA-03) and the route fails closed with 409 before ever
 * reaching `payment.create`. The exact-price assertion was weakened to
 * `expect.any(Number)` as a side effect — silently losing the regression
 * proof instead of relocating it.
 *
 * This file restores that exact proof at the level where it is still
 * reachable: `resolvePaymentCatalogItem`/`resolveSellablePaymentCatalogItem`
 * themselves, decoupled from whether any particular route currently allows
 * the surface through.
 */

import {
  resolvePaymentCatalogItem,
  resolveSellablePaymentCatalogItem,
} from '@/lib/security/payment-catalog';

describe('Cubic P2 — canonical catalog pricing (historical HYBRIDE regression proof)', () => {
  it('resolvePaymentCatalogItem returns the exact canonical HYBRIDE subscription price and description', () => {
    const item = resolvePaymentCatalogItem('subscription', 'HYBRIDE');
    expect(item).toEqual({
      amount: 450,
      description: 'Abonnement HYBRIDE',
      displayName: 'HYBRIDE',
    });
  });

  it('resolveSellablePaymentCatalogItem reports HYBRIDE as SALE_SUSPENDED — not simply absent from the catalog', () => {
    // The item resolves (catalog entry is real and unchanged) but the
    // surface is currently closed — distinct from NOT_FOUND.
    const result = resolveSellablePaymentCatalogItem('subscription', 'HYBRIDE');
    expect(result.status).toBe('SALE_SUSPENDED');
  });

  it('resolvePaymentCatalogItem returns the exact canonical GRAND_ORAL special-pack price and description (never-suspended surface)', () => {
    const item = resolvePaymentCatalogItem('pack', 'GRAND_ORAL');
    expect(item).toEqual({
      amount: 750,
      description: 'Pack Grand Oral',
      displayName: 'Pack Grand Oral',
    });
  });

  it('resolveSellablePaymentCatalogItem still sells GRAND_ORAL with the exact canonical price', () => {
    const result = resolveSellablePaymentCatalogItem('pack', 'GRAND_ORAL');
    expect(result.status).toBe('SELLABLE');
    expect(result.status === 'SELLABLE' && result.item).toEqual({
      amount: 750,
      description: 'Pack Grand Oral',
      displayName: 'Pack Grand Oral',
    });
  });
});
