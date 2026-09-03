import {
  getAriaAddonCatalogItem,
  getSpecialPackCatalogItem,
  getOperationalSubscriptionPlan,
} from '@/lib/operational-catalog';
import { ARIA_SUSPENSION_REASON, isSaleSuspended, type SaleSurface } from '@/lib/commerce/sale-suspension';

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
 * `metadata.itemType` on an already-created `Payment` row uses the exact
 * same `PaymentCatalogType` vocabulary (`bank-transfer/confirm/route.ts`
 * stores `itemType: data.type` verbatim). Unknown/legacy values (payments
 * created by another flow, or predating this metadata convention) are never
 * treated as suspended — this check only ever narrows staff approval for
 * surfaces it can positively identify, never blocks unrelated flows.
 */
export function isStoredPaymentItemTypeSaleSuspended(itemType: unknown): boolean {
  if (itemType !== 'subscription' && itemType !== 'addon' && itemType !== 'pack') return false;
  return isSaleSuspended(paymentCatalogTypeToSaleSurface(itemType));
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
