/**
 * Cubic P1-A — canonical sale-surface resolution from a PERSISTED Payment.
 *
 * `isStoredPaymentItemTypeSaleSuspended` (P0-ARIA-03) only recognised the
 * NEW `metadata.itemType` convention (`bank-transfer/confirm`'s
 * `'subscription' | 'addon' | 'pack'`). A historical `Payment` row created
 * before that convention existed — carrying only `metadata.itemKey` (e.g.
 * `'HYBRIDE'`, `'ARIA_MATHS'`, `'PLAN'`, matching the exact fixtures already
 * used by `__tests__/api/payments.validate.route.test.ts`) — was silently
 * treated as "not suspended" and could still be approved.
 *
 * `resolvePersistedPaymentSaleSurface` / `isPersistedPaymentSaleSuspended`
 * replace that narrower check: they resolve the legacy productCode the SAME
 * way `payments/validate/route.ts` already does for activation (shared
 * `resolveLegacyPaymentProductCode`, not duplicated), and fail closed
 * (`UNKNOWN` → suspended) whenever nothing in the persisted record lets the
 * surface be identified with confidence.
 */

import {
  resolvePersistedPaymentSaleSurface,
  isPersistedPaymentSaleSuspended,
  resolveLegacyPaymentProductCode,
} from '@/lib/security/payment-catalog';

describe('Cubic P1-A — resolvePersistedPaymentSaleSurface / isPersistedPaymentSaleSuspended', () => {
  it('CODEX_CUBIC_P1A_RED: a historical SUBSCRIPTION payment with only itemKey (no itemType) is still recognised as SUBSCRIPTION_PLAN and suspended', () => {
    const surface = resolvePersistedPaymentSaleSurface({
      type: 'SUBSCRIPTION',
      itemKey: 'HYBRIDE',
      itemType: undefined,
    });
    expect(surface).toBe('SUBSCRIPTION_PLAN');
    expect(isPersistedPaymentSaleSuspended({ type: 'SUBSCRIPTION', itemKey: 'HYBRIDE', itemType: undefined })).toBe(true);
  });

  it('a historical ARIA addon payment with only itemKey (no itemType) is recognised as ARIA_ADDON and suspended', () => {
    const surface = resolvePersistedPaymentSaleSurface({
      type: 'SPECIAL_PACK', // bank-transfer/confirm's legacy Prisma mapping for 'addon'
      itemKey: 'ARIA_MATHS',
      itemType: undefined,
    });
    expect(surface).toBe('ARIA_ADDON');
    expect(isPersistedPaymentSaleSuspended({ type: 'SPECIAL_PACK', itemKey: 'ARIA_MATHS', itemType: undefined })).toBe(true);
  });

  it('partial metadata (itemType present, itemKey absent) still resolves via the legacy type-only path', () => {
    const surface = resolvePersistedPaymentSaleSurface({
      type: 'SPECIAL_PACK',
      itemKey: undefined,
      itemType: 'ARIA_MATHS',
    });
    expect(surface).toBe('ARIA_ADDON');
  });

  it('partial metadata (itemKey generic "PLAN", no itemType) resolves to the default subscription surface', () => {
    // Matches the exact fixture already used by payments.validate.route.test.ts.
    const surface = resolvePersistedPaymentSaleSurface({
      type: 'SUBSCRIPTION',
      itemKey: 'PLAN',
      itemType: undefined,
    });
    expect(surface).toBe('SUBSCRIPTION_PLAN');
  });

  it('contradictory metadata (new-convention itemType disagrees with a resolvable legacy itemKey) fails closed as UNKNOWN, never guessed', () => {
    const surface = resolvePersistedPaymentSaleSurface({
      type: 'SPECIAL_PACK',
      itemKey: 'HYBRIDE', // legacy key clearly indicates a subscription…
      itemType: 'pack',   // …but the new-convention field disagrees
    });
    expect(surface).toBe('UNKNOWN');
    expect(isPersistedPaymentSaleSuspended({ type: 'SPECIAL_PACK', itemKey: 'HYBRIDE', itemType: 'pack' })).toBe(true);
  });

  it('a historical SPECIAL_PACK / stage / credit-pack payment is correctly classified as never-suspended', () => {
    expect(resolvePersistedPaymentSaleSurface({
      type: 'CREDIT_PACK',
      itemKey: 'STAGE_MATHS_P1',
      itemType: undefined,
    })).toBe('SPECIAL_PACK');
    expect(isPersistedPaymentSaleSuspended({ type: 'CREDIT_PACK', itemKey: 'STAGE_MATHS_P1', itemType: undefined })).toBe(false);
  });

  it('genuinely unidentifiable metadata on a CREDIT_PACK-typed payment is not suspended (that Prisma type never maps to a suspended surface)', () => {
    expect(resolvePersistedPaymentSaleSurface({
      type: 'CREDIT_PACK',
      itemKey: 'something-unrecognised',
      itemType: undefined,
    })).toBe('SPECIAL_PACK');
  });

  it('genuinely unidentifiable metadata on a SUBSCRIPTION or SPECIAL_PACK-typed payment fails closed (could plausibly be a suspended surface)', () => {
    expect(resolvePersistedPaymentSaleSurface({
      type: 'SUBSCRIPTION',
      itemKey: 'something-unrecognised',
      itemType: undefined,
    })).toBe('UNKNOWN');
    expect(resolvePersistedPaymentSaleSurface({
      type: 'SPECIAL_PACK',
      itemKey: undefined,
      itemType: undefined,
    })).toBe('UNKNOWN');
  });

  it('the new-convention itemType is still the fast path and takes precedence when unambiguous', () => {
    expect(resolvePersistedPaymentSaleSurface({ type: 'SUBSCRIPTION', itemType: 'subscription' })).toBe('SUBSCRIPTION_PLAN');
    expect(resolvePersistedPaymentSaleSurface({ type: 'SPECIAL_PACK', itemType: 'addon' })).toBe('ARIA_ADDON');
    expect(resolvePersistedPaymentSaleSurface({ type: 'CREDIT_PACK', itemType: 'pack' })).toBe('SPECIAL_PACK');
  });

  it('resolveLegacyPaymentProductCode is exported and shared (not duplicated) — matches the exact resolution payments/validate/route.ts relies on for activation', () => {
    expect(resolveLegacyPaymentProductCode('HYBRIDE', undefined)).toBe('ABONNEMENT_HYBRIDE');
    expect(resolveLegacyPaymentProductCode('ARIA_MATHS', undefined)).toBe('ARIA_ADDON_MATHS');
    expect(resolveLegacyPaymentProductCode('PLAN', undefined)).toBe('ABONNEMENT_ESSENTIEL');
    expect(resolveLegacyPaymentProductCode(undefined, undefined)).toBeNull();
  });
});
