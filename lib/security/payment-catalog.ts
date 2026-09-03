import {
  getAriaAddonCatalogItem,
  getSpecialPackCatalogItem,
  getOperationalSubscriptionPlan,
} from '@/lib/operational-catalog';
import { ARIA_SUSPENSION_REASON, isSaleSuspended, type SaleSurface } from '@/lib/commerce/sale-suspension';
import type { ProductCode } from '@/lib/entitlement/types';

export type PaymentCatalogType = 'subscription' | 'addon' | 'pack';

export type PaymentCatalogItem = {
  amount: number;
  description: string;
  displayName: string;
};

/**
 * `POST /api/payments/bank-transfer/confirm`'s `type` field maps 1:1 onto a
 * commercial sale surface — this is the ONLY mapping used anywhere a payment
 * is created or approved, so both live checks (declaration and staff
 * approval) always agree on what surface a purchase belongs to.
 */
const SALE_SURFACE_BY_CATALOG_TYPE: Readonly<Record<PaymentCatalogType, SaleSurface>> = Object.freeze({
  subscription: 'SUBSCRIPTION_PLAN',
  addon: 'ARIA_ADDON',
  pack: 'SPECIAL_PACK',
});

export function paymentCatalogTypeToSaleSurface(type: PaymentCatalogType): SaleSurface {
  return SALE_SURFACE_BY_CATALOG_TYPE[type];
}

/**
 * Legacy `metadata.itemKey`/`itemType` → canonical `ProductCode`, for
 * `Payment` rows created before `bank-transfer/confirm/route.ts` started
 * storing the exact `PaymentCatalogType` in `metadata.itemType` verbatim.
 * This is the SAME resolver `payments/validate/route.ts` uses to decide what
 * to activate on approval — moved here so sale-surface resolution (below)
 * and entitlement activation never diverge (Cubic P1-A: two separate
 * ad-hoc implementations of "what does this Payment mean" is exactly how a
 * historical payment could bypass the suspension gate).
 */
export function resolveLegacyPaymentProductCode(
  itemKey?: string,
  itemType?: string,
): ProductCode | null {
  const key = itemKey?.toUpperCase();
  const type = itemType?.toUpperCase();

  if (key === 'ESSENTIEL' || key === 'ACCES_PLATEFORME' || key === 'PLAN') {
    if (type === 'IMMERSION' || key?.includes('IMMERSION')) return 'ABONNEMENT_IMMERSION';
    if (type === 'HYBRIDE' || key?.includes('HYBRIDE')) return 'ABONNEMENT_HYBRIDE';
    return 'ABONNEMENT_ESSENTIEL';
  }
  if (key === 'HYBRIDE') return 'ABONNEMENT_HYBRIDE';
  if (key === 'IMMERSION') return 'ABONNEMENT_IMMERSION';
  if (key === 'ESSENTIEL') return 'ABONNEMENT_ESSENTIEL';

  if (key?.startsWith('ARIA_') || type?.startsWith('ARIA_')) {
    if (key?.includes('MATHS') || type?.includes('MATHS')) return 'ARIA_ADDON_MATHS';
    if (key?.includes('NSI') || type?.includes('NSI')) return 'ARIA_ADDON_NSI';
  }
  // Cubic P2 (confidence 9, pre-existing — not introduced by this PR):
  // the REAL, currently-sellable ARIA addon catalog keys
  // (lib/operational-catalog.ts's AriaAddonKey) are 'MATIERE_SUPPLEMENTAIRE'
  // and 'ANALYSE_APPROFONDIE' — subject-agnostic add-ons with no
  // corresponding ProductCode/legacySubject here at all (only the
  // MATHS/NSI-specific ARIA_ADDON_* codes exist). A bank-transfer 'addon'
  // purchase of either would resolve productCode=null today, so
  // activateEntitlements() would skip it entirely (no entitlement, not even
  // the legacy commercial one). This is currently unreachable — ARIA_ADDON
  // sales are unconditionally suspended (P0-ARIA-03,
  // lib/commerce/sale-suspension.ts) — but MUST be resolved as a real
  // product/entitlement-modeling decision (what does a subject-agnostic
  // ARIA addon even grant?) before ARIA sales ever reopen. Flagged here
  // rather than silently left unmentioned; out of scope for this PR.

  if (key?.includes('STAGE_MATHS_P1')) return 'STAGE_MATHS_P1';
  if (key?.includes('STAGE_MATHS_P2')) return 'STAGE_MATHS_P2';
  if (key?.includes('STAGE_NSI_P1')) return 'STAGE_NSI_P1';
  if (key?.includes('STAGE_NSI_P2')) return 'STAGE_NSI_P2';

  if (key?.includes('CREDIT_PACK_5')) return 'CREDIT_PACK_5';
  if (key?.includes('CREDIT_PACK_10')) return 'CREDIT_PACK_10';
  if (key?.includes('CREDIT_PACK_20')) return 'CREDIT_PACK_20';

  return null;
}

const SUBSCRIPTION_PRODUCT_PREFIX = 'ABONNEMENT_';
const ARIA_ADDON_PRODUCT_PREFIX = 'ARIA_ADDON_';

export type PersistedPaymentSaleSurface = SaleSurface | 'UNKNOWN';

/**
 * Canonical sale-surface resolution for an ALREADY-PERSISTED `Payment` row
 * (Cubic P1-A). Two independent signals are consulted and must not
 * contradict each other:
 *
 *   1. the NEW convention — `metadata.itemType` stores the exact
 *      `PaymentCatalogType` verbatim (`bank-transfer/confirm/route.ts`);
 *   2. the LEGACY convention — `metadata.itemKey`/`itemType` resolved via
 *      `resolveLegacyPaymentProductCode`, the same resolver activation uses.
 *
 * A row predating BOTH conventions (or carrying genuinely unrecognisable
 * metadata) falls back to the coarse Prisma `Payment.type`: `CREDIT_PACK`
 * never corresponds to a suspended surface and is safe to allow; `SUBSCRIPTION`
 * and `SPECIAL_PACK` both can (the historical `addon` → Prisma `SPECIAL_PACK`
 * mapping makes `SPECIAL_PACK` ambiguous), so both fail closed as `UNKNOWN`.
 * Contradictory metadata (both signals resolve, and disagree) also fails
 * closed — never guessed.
 */
export function resolvePersistedPaymentSaleSurface(payment: {
  readonly type: string;
  readonly itemKey?: unknown;
  readonly itemType?: unknown;
}): PersistedPaymentSaleSurface {
  const itemType = typeof payment.itemType === 'string' ? payment.itemType : undefined;
  const itemKey = typeof payment.itemKey === 'string' ? payment.itemKey : undefined;

  const fromNewConvention: SaleSurface | null =
    itemType === 'subscription' ? 'SUBSCRIPTION_PLAN'
      : itemType === 'addon' ? 'ARIA_ADDON'
        : itemType === 'pack' ? 'SPECIAL_PACK'
          : null;

  const legacyProductCode = resolveLegacyPaymentProductCode(itemKey, itemType);
  const fromLegacyConvention: SaleSurface | null =
    legacyProductCode?.startsWith(SUBSCRIPTION_PRODUCT_PREFIX) ? 'SUBSCRIPTION_PLAN'
      : legacyProductCode?.startsWith(ARIA_ADDON_PRODUCT_PREFIX) ? 'ARIA_ADDON'
        : legacyProductCode ? 'SPECIAL_PACK'
          : null;

  if (fromNewConvention && fromLegacyConvention && fromNewConvention !== fromLegacyConvention) {
    return 'UNKNOWN';
  }
  if (fromNewConvention) return fromNewConvention;
  if (fromLegacyConvention) return fromLegacyConvention;

  if (payment.type === 'CREDIT_PACK') return 'SPECIAL_PACK';
  return 'UNKNOWN';
}

/**
 * `true` for `SUBSCRIPTION_PLAN`/`ARIA_ADDON` AND for `UNKNOWN` (fail
 * closed) — only a positively-identified `SPECIAL_PACK` surface is ever
 * treated as sellable/approvable.
 */
export function isPersistedPaymentSaleSuspended(payment: {
  readonly type: string;
  readonly itemKey?: unknown;
  readonly itemType?: unknown;
}): boolean {
  const surface = resolvePersistedPaymentSaleSurface(payment);
  if (surface === 'UNKNOWN') return true;
  return isSaleSuspended(surface);
}

export type PaymentCatalogGateResult =
  | { readonly status: 'SELLABLE'; readonly item: PaymentCatalogItem }
  | { readonly status: 'NOT_FOUND' }
  | { readonly status: 'SALE_SUSPENDED'; readonly reason: string };

/**
 * The single, server-side authority for "can this be sold right now" —
 * catalog existence AND current sale-suspension state together. Every route
 * that can create a new commercial order (bank-transfer declaration and any
 * future equivalent) MUST resolve the catalog item through this function,
 * never through `resolvePaymentCatalogItem` directly, so a suspended surface
 * can never be reached by construction rather than by convention
 * (P0-ARIA-03 — `/api/parent/subscription-requests` already enforced this
 * for its own surface; this closes the same gate for the other route that
 * can create a real `Payment`).
 */
export function resolveSellablePaymentCatalogItem(
  type: PaymentCatalogType,
  key: string,
): PaymentCatalogGateResult {
  const item = resolvePaymentCatalogItem(type, key);
  if (!item) return { status: 'NOT_FOUND' };
  if (isSaleSuspended(paymentCatalogTypeToSaleSurface(type))) {
    return { status: 'SALE_SUSPENDED', reason: ARIA_SUSPENSION_REASON };
  }
  return { status: 'SELLABLE', item };
}

export function resolvePaymentCatalogItem(
  type: PaymentCatalogType,
  key: string,
): PaymentCatalogItem | null {
  if (type === 'subscription') {
    const plan = getOperationalSubscriptionPlan(key);
    if (!plan) return null;
    return {
      amount: plan.price,
      description: `Abonnement ${plan.name}`,
      displayName: plan.name,
    };
  }

  if (type === 'addon') {
    const addon = getAriaAddonCatalogItem(key);
    if (!addon) return null;
    return {
      amount: addon.price,
      description: `Add-on ARIA ${addon.name}`,
      displayName: addon.name,
    };
  }

  const pack = getSpecialPackCatalogItem(key);
  if (!pack) return null;
  return {
    amount: pack.price,
    description: pack.name,
    displayName: pack.name,
  };
}
