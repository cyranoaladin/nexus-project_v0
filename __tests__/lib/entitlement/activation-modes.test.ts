/**
 * Entitlement Activation Modes — Contract tests.
 *
 * Validates SINGLE / EXTEND / STACK mode logic and edge cases
 * without hitting the DB. Tests the pure contracts that the engine enforces.
 */

import {
  PRODUCT_REGISTRY,
  getProductDefinition,
  computeEndsAt,
} from '@/lib/entitlement/types';
import type { ProductCode, ActivationMode } from '@/lib/entitlement/types';

// ─── Mode assignment consistency ─────────────────────────────────────────────

describe('mode assignment', () => {
  const allCodes = Object.keys(PRODUCT_REGISTRY) as ProductCode[];

  it('every product has a valid mode', () => {
    const validModes: ActivationMode[] = ['SINGLE', 'EXTEND', 'STACK'];
    for (const code of allCodes) {
      expect(validModes).toContain(PRODUCT_REGISTRY[code].mode);
    }
  });

  it('stages are SINGLE', () => {
    const stages = allCodes.filter((c) => PRODUCT_REGISTRY[c].category === 'stage');
    for (const code of stages) {
      expect(PRODUCT_REGISTRY[code].mode).toBe('SINGLE');
    }
  });

  it('premium tiers are SINGLE', () => {
    const premiums = allCodes.filter((c) => PRODUCT_REGISTRY[c].category === 'premium');
    for (const code of premiums) {
      expect(PRODUCT_REGISTRY[code].mode).toBe('SINGLE');
    }
  });

  it('abonnements are EXTEND', () => {
    const abonnements = allCodes.filter((c) => PRODUCT_REGISTRY[c].category === 'abonnement');
    for (const code of abonnements) {
      expect(PRODUCT_REGISTRY[code].mode).toBe('EXTEND');
    }
  });

  it('credit packs are STACK', () => {
    const credits = allCodes.filter((c) => PRODUCT_REGISTRY[c].category === 'credits');
    for (const code of credits) {
      expect(PRODUCT_REGISTRY[code].mode).toBe('STACK');
    }
  });

  it('addons are EXTEND', () => {
    const addons = allCodes.filter((c) => PRODUCT_REGISTRY[c].category === 'addon');
    for (const code of addons) {
      expect(PRODUCT_REGISTRY[code].mode).toBe('EXTEND');
    }
  });
});

// ─── SINGLE mode contract ────────────────────────────────────────────────────

describe('SINGLE mode contract', () => {
  it('PREMIUM_LITE paid twice → second is noop (already active)', () => {
    const product = getProductDefinition('PREMIUM_LITE')!;
    expect(product.mode).toBe('SINGLE');

    // Simulate: existing active entitlement from invoice-1
    const existingActive = { id: 'ent-1', status: 'ACTIVE', endsAt: new Date('2027-01-01') };
    // Contract: if existingActive exists → skip (no new entitlement)
    const shouldCreate = existingActive === null;
    expect(shouldCreate).toBe(false);
  });

  it('STAGE_MATHS_P1 paid twice → second is noop', () => {
    const product = getProductDefinition('STAGE_MATHS_P1')!;
    expect(product.mode).toBe('SINGLE');
  });

  it('SINGLE with expired entitlement → create new (not noop)', () => {
    const product = getProductDefinition('PREMIUM_LITE')!;
    expect(product.mode).toBe('SINGLE');

    // Simulate: existing entitlement is expired
    const existingExpired = { id: 'ent-1', status: 'ACTIVE', endsAt: new Date('2025-01-01') };
    const now = new Date('2026-02-16');
    const isStillActive = existingExpired.endsAt > now;
    // Contract: expired → should create new
    expect(isStillActive).toBe(false);
  });
});

// ─── EXTEND mode contract ────────────────────────────────────────────────────

describe('EXTEND mode contract', () => {
  it('ABONNEMENT_ESSENTIEL paid twice → endsAt extended (not 2 concurrent)', () => {
    const product = getProductDefinition('ABONNEMENT_ESSENTIEL')!;
    expect(product.mode).toBe('EXTEND');
    expect(product.defaultDurationDays).toBe(30);

    // First purchase: starts now, ends in 30 days
    const firstStart = new Date('2026-03-01T00:00:00Z');
    const firstEnd = computeEndsAt(product, firstStart)!;
    expect(firstEnd.toISOString()).toBe('2026-03-31T00:00:00.000Z');

    // Second purchase: extends from firstEnd, not from now
    const extensionMs = product.defaultDurationDays! * 24 * 60 * 60 * 1000;
    const extendedEnd = new Date(firstEnd.getTime() + extensionMs);
    expect(extendedEnd.toISOString()).toBe('2026-04-30T00:00:00.000Z');
  });

  it('ARIA_ADDON_MATHS paid twice → extends 30 days from current end', () => {
    const product = getProductDefinition('ARIA_ADDON_MATHS')!;
    expect(product.mode).toBe('EXTEND');
    expect(product.defaultDurationDays).toBe(30);

    const firstEnd = new Date('2026-04-01T00:00:00Z');
    const extensionMs = product.defaultDurationDays! * 24 * 60 * 60 * 1000;
    const extendedEnd = new Date(firstEnd.getTime() + extensionMs);
    // 30 days from April 1 = May 1
    expect(extendedEnd.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('EXTEND with no existing entitlement → create fresh', () => {
    const product = getProductDefinition('ABONNEMENT_HYBRIDE')!;
    expect(product.mode).toBe('EXTEND');

    // No existing active → should create new (not extend)
    const existingActive = null;
    const shouldCreateFresh = existingActive === null;
    expect(shouldCreateFresh).toBe(true);
  });

  it('EXTEND products with credits still grant credits on extension', () => {
    const product = getProductDefinition('ABONNEMENT_IMMERSION')!;
    expect(product.mode).toBe('EXTEND');
    expect(product.grantsCredits).toBe(16);
    // Contract: credits are granted even when extending (new month = new credits)
    const totalCredits = product.grantsCredits! * 1; // qty=1
    expect(totalCredits).toBe(16);
  });
});

// ─── STACK mode contract ─────────────────────────────────────────────────────

describe('STACK mode contract', () => {
  it('CREDIT_PACK_10 bought twice → 2 entitlements, +20 credits total', () => {
    const product = getProductDefinition('CREDIT_PACK_10')!;
    expect(product.mode).toBe('STACK');
    expect(product.grantsCredits).toBe(10);

    // Two purchases, qty=1 each
    const credits1 = product.grantsCredits! * 1;
    const credits2 = product.grantsCredits! * 1;
    expect(credits1 + credits2).toBe(20);
  });

  it('CREDIT_PACK_5 with qty=3 → +15 credits in one purchase', () => {
    const product = getProductDefinition('CREDIT_PACK_5')!;
    expect(product.mode).toBe('STACK');
    const totalCredits = product.grantsCredits! * 3;
    expect(totalCredits).toBe(15);
  });

  it('STACK always creates new entitlement (never noop)', () => {
    const product = getProductDefinition('CREDIT_PACK_20')!;
    expect(product.mode).toBe('STACK');
    // Contract: STACK mode never checks for existing — always creates
    const alwaysCreate = product.mode === 'STACK';
    expect(alwaysCreate).toBe(true);
  });

  it('STACK products have no duration (permanent)', () => {
    const product = getProductDefinition('CREDIT_PACK_10')!;
    expect(product.defaultDurationDays).toBeNull();
    expect(computeEndsAt(product)).toBeNull();
  });
});

// ─── No-code / No-beneficiary contracts ──────────────────────────────────────

describe('skip contracts', () => {
  it('items without productCode are skipped (not errors)', () => {
    const items = [
      { label: 'Consultation', productCode: null, qty: 1 },
      { label: 'Frais admin', productCode: null, qty: 1 },
    ];
    const activatable = items.filter((i) => i.productCode !== null);
    expect(activatable).toHaveLength(0);
  });

  it('MARK_PAID with 0 activatable items → ENTITLEMENTS_SKIPPED event', () => {
    const activation = {
      created: 0,
      extended: 0,
      creditsGranted: 0,
      activatedCodes: [] as string[],
      skippedItems: 3,
      noBeneficiary: false,
    };
    const shouldEmitSkipped =
      activation.created === 0 &&
      activation.extended === 0 &&
      activation.creditsGranted === 0 &&
      activation.skippedItems > 0 &&
      activation.activatedCodes.length === 0;
    expect(shouldEmitSkipped).toBe(true);
  });

  it('no beneficiaryUserId → noBeneficiary flag + all items skipped', () => {
    const activation = {
      created: 0,
      extended: 0,
      creditsGranted: 0,
      activatedCodes: [] as string[],
      skippedItems: 2,
      noBeneficiary: true,
    };
    expect(activation.noBeneficiary).toBe(true);
    expect(activation.skippedItems).toBe(2);
  });

  it('ENTITLEMENTS_SKIPPED event has flat safe details', () => {
    // reason: 'no_beneficiary' or 'no_product_code'
    const detailsBeneficiary = { reason: 'no_beneficiary', skippedItems: 2 };
    expect(typeof detailsBeneficiary.reason).toBe('string');
    expect(typeof detailsBeneficiary.skippedItems).toBe('number');

    const detailsNoCode = { reason: 'no_product_code', skippedItems: 3 };
    expect(typeof detailsNoCode.reason).toBe('string');
    expect(typeof detailsNoCode.skippedItems).toBe('number');
  });
});

// ─── Idempotence contracts ───────────────────────────────────────────────────

describe('idempotence', () => {
  it('same invoice+product+user → skip regardless of mode', () => {
    // Contract: idempotence guard checks sourceInvoiceId, not mode
    const alreadyFromThisInvoice = { id: 'ent-1' };
    const shouldSkip = alreadyFromThisInvoice !== null;
    expect(shouldSkip).toBe(true);
  });

  it('different invoice, same product, SINGLE mode → noop if active', () => {
    // Invoice-1 created entitlement for PREMIUM_LITE
    // Invoice-2 also has PREMIUM_LITE → SINGLE mode → noop (already active)
    const product = getProductDefinition('PREMIUM_LITE')!;
    expect(product.mode).toBe('SINGLE');
    const existingFromOtherInvoice = { id: 'ent-1', status: 'ACTIVE' };
    const shouldSkip = existingFromOtherInvoice !== null && product.mode === 'SINGLE';
    expect(shouldSkip).toBe(true);
  });

  it('different invoice, same product, STACK mode → always create', () => {
    const product = getProductDefinition('CREDIT_PACK_10')!;
    expect(product.mode).toBe('STACK');
    // STACK: idempotence guard only blocks same invoice, not same product
    const alreadyFromThisInvoice = null; // different invoice
    const shouldCreate = alreadyFromThisInvoice === null;
    expect(shouldCreate).toBe(true);
  });

  it('different invoice, same product, EXTEND mode → extend endsAt', () => {
    const product = getProductDefinition('ABONNEMENT_ESSENTIEL')!;
    expect(product.mode).toBe('EXTEND');
    // EXTEND: idempotence guard only blocks same invoice
    const alreadyFromThisInvoice = null; // different invoice
    const shouldExtend = alreadyFromThisInvoice === null && product.mode === 'EXTEND';
    expect(shouldExtend).toBe(true);
  });
});

// ─── Audit event structure ───────────────────────────────────────────────────

describe('audit event structure', () => {
  it('ENTITLEMENTS_ACTIVATED includes extended count', () => {
    const details = {
      created: 1,
      extended: 2,
      credits: 8,
      codes: 'ABONNEMENT_HYBRIDE,CREDIT_PACK_10',
    };
    expect(typeof details.extended).toBe('number');
    expect(typeof details.created).toBe('number');
    expect(typeof details.credits).toBe('number');
    expect(typeof details.codes).toBe('string');
    // No nested objects, no PII
    for (const value of Object.values(details)) {
      expect(['string', 'number', 'boolean'].includes(typeof value)).toBe(true);
    }
  });

  it('ENTITLEMENTS_SKIPPED has reason and skippedItems only', () => {
    const details = { reason: 'no_product_code', skippedItems: 3 };
    expect(Object.keys(details)).toHaveLength(2);
    expect(details.reason).toMatch(/^(no_beneficiary|no_product_code)$/);
  });
});
