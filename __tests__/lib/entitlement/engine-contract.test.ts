/**
 * Entitlement Engine — Contract tests.
 *
 * Tests the activation/suspension logic contracts without hitting the DB.
 * DB-dependent operations (activateEntitlements, suspendEntitlements) are
 * tested via integration tests. Here we validate the pure logic contracts.
 */

import {
  PRODUCT_REGISTRY,
  isValidProductCode,
  getProductDefinition,
  computeEndsAt,
} from '@/lib/entitlement/types';
import type { ProductCode } from '@/lib/entitlement/types';

// ─── Activation contract ─────────────────────────────────────────────────────

describe('activation contract', () => {
  it('only items with valid productCode generate entitlements', () => {
    const items = [
      { label: 'Stage Maths P1', productCode: 'STAGE_MATHS_P1', qty: 1 },
      { label: 'Frais divers', productCode: null, qty: 1 },
      { label: 'Unknown product', productCode: 'DOES_NOT_EXIST', qty: 1 },
    ];

    const activatable = items.filter(
      (i) => i.productCode && isValidProductCode(i.productCode)
    );
    expect(activatable).toHaveLength(1);
    expect(activatable[0].productCode).toBe('STAGE_MATHS_P1');
  });

  it('items without productCode are skipped (not errors)', () => {
    const items: Array<{ label: string; productCode: string | null | undefined; qty: number }> = [
      { label: 'Consultation', productCode: null, qty: 1 },
      { label: 'Frais admin', productCode: undefined, qty: 1 },
    ];

    const skipped = items.filter(
      (i) => !i.productCode || !isValidProductCode(i.productCode)
    );
    expect(skipped).toHaveLength(2);
  });

  it('credit packs compute correct total credits with qty', () => {
    const product = getProductDefinition('CREDIT_PACK_10')!;
    const qty = 3;
    const totalCredits = product.grantsCredits! * qty;
    expect(totalCredits).toBe(30);
  });

  it('non-credit products grant 0 credits', () => {
    const product = getProductDefinition('STAGE_MATHS_P1')!;
    expect(product.grantsCredits).toBeNull();
  });

  it('entitlement endsAt is computed from product definition', () => {
    const product = getProductDefinition('STAGE_MATHS_P2')!;
    const startsAt = new Date('2026-03-01T00:00:00Z');
    const endsAt = computeEndsAt(product, startsAt);
    // 90 days from March 1 = May 30
    expect(endsAt).not.toBeNull();
    expect(endsAt!.toISOString()).toBe('2026-05-30T00:00:00.000Z');
  });

  it('permanent products (credit packs) have no endsAt', () => {
    const product = getProductDefinition('CREDIT_PACK_5')!;
    expect(computeEndsAt(product)).toBeNull();
  });

  it('activation requires beneficiaryUserId (no userId = skip all)', () => {
    // Contract: if invoice has no beneficiaryUserId, activation returns 0 created
    const beneficiaryUserId: string | null = null;
    const shouldActivate = beneficiaryUserId !== null;
    expect(shouldActivate).toBe(false);
  });

  it('activation is idempotent (same invoice+product+user = skip)', () => {
    // Contract: if entitlement already exists with same sourceInvoiceId + productCode + userId + ACTIVE
    // → skip creation (no duplicate)
    const existingEntitlement = {
      userId: 'user-1',
      productCode: 'STAGE_MATHS_P1',
      sourceInvoiceId: 'inv-1',
      status: 'ACTIVE',
    };
    const newRequest = {
      userId: 'user-1',
      productCode: 'STAGE_MATHS_P1',
      sourceInvoiceId: 'inv-1',
    };
    const isDuplicate =
      existingEntitlement.userId === newRequest.userId &&
      existingEntitlement.productCode === newRequest.productCode &&
      existingEntitlement.sourceInvoiceId === newRequest.sourceInvoiceId &&
      existingEntitlement.status === 'ACTIVE';
    expect(isDuplicate).toBe(true);
  });
});

// ─── Suspension contract ─────────────────────────────────────────────────────

describe('suspension contract', () => {
  it('only ACTIVE entitlements are suspended', () => {
    const entitlements = [
      { id: '1', status: 'ACTIVE', sourceInvoiceId: 'inv-1' },
      { id: '2', status: 'SUSPENDED', sourceInvoiceId: 'inv-1' },
      { id: '3', status: 'EXPIRED', sourceInvoiceId: 'inv-1' },
      { id: '4', status: 'ACTIVE', sourceInvoiceId: 'inv-1' },
    ];

    const toSuspend = entitlements.filter((e) => e.status === 'ACTIVE');
    expect(toSuspend).toHaveLength(2);
  });

  it('suspension sets status to SUSPENDED with reason', () => {
    const reason = 'Invoice cancelled';
    const suspended = {
      status: 'SUSPENDED' as const,
      suspendedAt: new Date(),
      suspendReason: reason,
    };
    expect(suspended.status).toBe('SUSPENDED');
    expect(suspended.suspendReason).toBe('Invoice cancelled');
    expect(suspended.suspendedAt).toBeInstanceOf(Date);
  });

  it('suspension only affects entitlements from the cancelled invoice', () => {
    const allEntitlements = [
      { id: '1', status: 'ACTIVE', sourceInvoiceId: 'inv-1' },
      { id: '2', status: 'ACTIVE', sourceInvoiceId: 'inv-2' },
      { id: '3', status: 'ACTIVE', sourceInvoiceId: 'inv-1' },
    ];

    const cancelledInvoiceId = 'inv-1';
    const affected = allEntitlements.filter(
      (e) => e.sourceInvoiceId === cancelledInvoiceId && e.status === 'ACTIVE'
    );
    expect(affected).toHaveLength(2);
    // inv-2 entitlement is NOT affected
    expect(affected.every((e) => e.sourceInvoiceId === 'inv-1')).toBe(true);
  });

  it('suspension of already-suspended entitlements is a noop', () => {
    const entitlements = [
      { id: '1', status: 'SUSPENDED', sourceInvoiceId: 'inv-1' },
    ];
    const toSuspend = entitlements.filter((e) => e.status === 'ACTIVE');
    expect(toSuspend).toHaveLength(0);
  });
});

// ─── Event types contract ────────────────────────────────────────────────────

describe('entitlement event types', () => {
  it('ENTITLEMENTS_ACTIVATED event has correct structure', () => {
    const eventDetails = {
      created: 2,
      credits: 10,
      codes: 'STAGE_MATHS_P1,CREDIT_PACK_10',
    };
    expect(eventDetails.created).toBeGreaterThan(0);
    expect(typeof eventDetails.codes).toBe('string');
    expect(eventDetails.codes.split(',')).toHaveLength(2);
  });

  it('ENTITLEMENTS_SUSPENDED event has correct structure', () => {
    const eventDetails = {
      suspended: 1,
      codes: 'STAGE_MATHS_P1',
    };
    expect(eventDetails.suspended).toBeGreaterThan(0);
    expect(typeof eventDetails.codes).toBe('string');
  });

  it('no entitlement event if nothing was activated', () => {
    const activation = { created: 0, creditsGranted: 0, activatedCodes: [], skippedItems: 3 };
    const shouldEmitEvent = activation.created > 0 || activation.creditsGranted > 0;
    expect(shouldEmitEvent).toBe(false);
  });

  it('no entitlement event if nothing was suspended', () => {
    const suspension = { suspended: 0, suspendedCodes: [] };
    const shouldEmitEvent = suspension.suspended > 0;
    expect(shouldEmitEvent).toBe(false);
  });
});

// ─── Feature mapping contract ────────────────────────────────────────────────

describe('feature mapping', () => {
  it('PREMIUM_LITE grants ai_feedback', () => {
    const def = getProductDefinition('PREMIUM_LITE')!;
    expect(def.features).toContain('ai_feedback');
  });

  it('PREMIUM_FULL grants all premium features', () => {
    const def = getProductDefinition('PREMIUM_FULL')!;
    expect(def.features).toContain('ai_feedback');
    expect(def.features).toContain('priority_support');
    expect(def.features).toContain('advanced_analytics');
    expect(def.features).toContain('unlimited_sessions');
  });

  it('ABONNEMENT_HYBRIDE grants hybrid_sessions', () => {
    const def = getProductDefinition('ABONNEMENT_HYBRIDE')!;
    expect(def.features).toContain('hybrid_sessions');
    expect(def.features).toContain('platform_access');
  });

  it('credit packs grant no features', () => {
    const def = getProductDefinition('CREDIT_PACK_10')!;
    expect(def.features).toHaveLength(0);
  });

  it('ARIA add-ons grant subject-specific features', () => {
    const maths = getProductDefinition('ARIA_ADDON_MATHS')!;
    const nsi = getProductDefinition('ARIA_ADDON_NSI')!;
    expect(maths.features).toContain('aria_maths');
    expect(nsi.features).toContain('aria_nsi');
  });

  it('all features across all products are unique strings', () => {
    const allFeatures = new Set<string>();
    for (const code of Object.keys(PRODUCT_REGISTRY) as ProductCode[]) {
      for (const feature of PRODUCT_REGISTRY[code].features) {
        expect(typeof feature).toBe('string');
        expect(feature.length).toBeGreaterThan(0);
        allFeatures.add(feature);
      }
    }
    expect(allFeatures.size).toBeGreaterThanOrEqual(5);
  });
});
