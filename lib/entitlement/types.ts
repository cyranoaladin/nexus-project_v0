/**
 * Entitlement Engine — Types & Product Registry.
 *
 * Maps invoice line items (productCode) to entitlement definitions.
 * The registry is the single source of truth for what a product code grants.
 */

// ─── Entitlement Status (mirrors Prisma enum) ───────────────────────────────

export type EntitlementStatusType = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';

/**
 * Activation mode — controls what happens when the same product is purchased again.
 *
 * - SINGLE: noop if already active (e.g. PREMIUM_LITE annual)
 * - EXTEND: prolong endsAt if already active, else create (e.g. abonnements)
 * - STACK:  always create + accumulate credits (e.g. credit packs)
 */
export type ActivationMode = 'SINGLE' | 'EXTEND' | 'STACK';

// ─── Product Code Registry ───────────────────────────────────────────────────

/**
 * Known product codes. Extensible — new products are added here.
 * Convention: UPPER_SNAKE_CASE, category prefix.
 */
export type ProductCode =
  | 'STAGE_MATHS_P1'
  | 'STAGE_MATHS_P2'
  | 'STAGE_NSI_P1'
  | 'STAGE_NSI_P2'
  | 'PREMIUM_LITE'
  | 'PREMIUM_FULL'
  | 'ABONNEMENT_ESSENTIEL'
  | 'ABONNEMENT_HYBRIDE'
  | 'ABONNEMENT_IMMERSION'
  | 'CREDIT_PACK_5'
  | 'CREDIT_PACK_10'
  | 'CREDIT_PACK_20'
  | 'ARIA_ADDON_MATHS'
  | 'ARIA_ADDON_NSI';

/**
 * Product definition — what a product code grants.
 */
export interface ProductDefinition {
  /** Product code (unique key) */
  code: ProductCode;
  /** Human-readable label */
  label: string;
  /** Category for grouping */
  category: 'stage' | 'premium' | 'abonnement' | 'credits' | 'addon';
  /** Activation mode: SINGLE (noop if active), EXTEND (prolong), STACK (accumulate) */
  mode: ActivationMode;
  /** Default duration in days (null = permanent until revoked) */
  defaultDurationDays: number | null;
  /** Whether this product grants credits */
  grantsCredits: number | null;
  /** Feature flags this product enables */
  features: string[];
}

/**
 * Product registry — single source of truth.
 * Add new products here when the catalog evolves.
 */
export const PRODUCT_REGISTRY: Record<ProductCode, ProductDefinition> = {
  // Stages
  STAGE_MATHS_P1: {
    code: 'STAGE_MATHS_P1',
    label: 'Stage Intensif Maths — Palier 1',
    category: 'stage',
    mode: 'SINGLE',
    defaultDurationDays: 90,
    grantsCredits: null,
    features: ['stage_maths_p1'],
  },
  STAGE_MATHS_P2: {
    code: 'STAGE_MATHS_P2',
    label: 'Stage Intensif Maths — Palier 2',
    category: 'stage',
    mode: 'SINGLE',
    defaultDurationDays: 90,
    grantsCredits: null,
    features: ['stage_maths_p2'],
  },
  STAGE_NSI_P1: {
    code: 'STAGE_NSI_P1',
    label: 'Stage NSI — Palier 1',
    category: 'stage',
    mode: 'SINGLE',
    defaultDurationDays: 90,
    grantsCredits: null,
    features: ['stage_nsi_p1'],
  },
  STAGE_NSI_P2: {
    code: 'STAGE_NSI_P2',
    label: 'Stage NSI — Palier 2',
    category: 'stage',
    mode: 'SINGLE',
    defaultDurationDays: 90,
    grantsCredits: null,
    features: ['stage_nsi_p2'],
  },

  // Premium tiers
  PREMIUM_LITE: {
    code: 'PREMIUM_LITE',
    label: 'Premium Lite — AI Feedback',
    category: 'premium',
    mode: 'SINGLE',
    defaultDurationDays: 365,
    grantsCredits: null,
    features: ['ai_feedback', 'priority_support'],
  },
  PREMIUM_FULL: {
    code: 'PREMIUM_FULL',
    label: 'Premium Full — Accès complet',
    category: 'premium',
    mode: 'SINGLE',
    defaultDurationDays: 365,
    grantsCredits: null,
    features: ['ai_feedback', 'priority_support', 'advanced_analytics', 'unlimited_sessions'],
  },

  // Abonnements
  ABONNEMENT_ESSENTIEL: {
    code: 'ABONNEMENT_ESSENTIEL',
    label: 'Abonnement Essentiel',
    category: 'abonnement',
    mode: 'EXTEND',
    defaultDurationDays: 30,
    grantsCredits: 4,
    features: ['platform_access', 'credits_use'],
  },
  ABONNEMENT_HYBRIDE: {
    code: 'ABONNEMENT_HYBRIDE',
    label: 'Abonnement Hybride',
    category: 'abonnement',
    mode: 'EXTEND',
    defaultDurationDays: 30,
    grantsCredits: 8,
    features: ['platform_access', 'hybrid_sessions', 'credits_use'],
  },
  ABONNEMENT_IMMERSION: {
    code: 'ABONNEMENT_IMMERSION',
    label: 'Abonnement Immersion',
    category: 'abonnement',
    mode: 'EXTEND',
    defaultDurationDays: 30,
    grantsCredits: 16,
    features: ['platform_access', 'hybrid_sessions', 'immersion_mode', 'credits_use'],
  },

  // Credit packs
  CREDIT_PACK_5: {
    code: 'CREDIT_PACK_5',
    label: 'Pack 5 crédits',
    category: 'credits',
    mode: 'STACK',
    defaultDurationDays: null,
    grantsCredits: 5,
    features: [],
  },
  CREDIT_PACK_10: {
    code: 'CREDIT_PACK_10',
    label: 'Pack 10 crédits',
    category: 'credits',
    mode: 'STACK',
    defaultDurationDays: null,
    grantsCredits: 10,
    features: [],
  },
  CREDIT_PACK_20: {
    code: 'CREDIT_PACK_20',
    label: 'Pack 20 crédits',
    category: 'credits',
    mode: 'STACK',
    defaultDurationDays: null,
    grantsCredits: 20,
    features: [],
  },

  // ARIA add-ons
  ARIA_ADDON_MATHS: {
    code: 'ARIA_ADDON_MATHS',
    label: 'ARIA — Maths',
    category: 'addon',
    mode: 'EXTEND',
    defaultDurationDays: 30,
    grantsCredits: null,
    features: ['aria_maths'],
  },
  ARIA_ADDON_NSI: {
    code: 'ARIA_ADDON_NSI',
    label: 'ARIA — NSI',
    category: 'addon',
    mode: 'EXTEND',
    defaultDurationDays: 30,
    grantsCredits: null,
    features: ['aria_nsi'],
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check if a string is a known product code.
 */
export function isValidProductCode(code: string): code is ProductCode {
  return code in PRODUCT_REGISTRY;
}

/**
 * Get product definition by code. Returns null if unknown.
 */
export function getProductDefinition(code: string): ProductDefinition | null {
  if (!isValidProductCode(code)) return null;
  return PRODUCT_REGISTRY[code];
}

/**
 * Compute entitlement end date from a product definition.
 * Returns null if the product is permanent.
 */
export function computeEndsAt(
  product: ProductDefinition,
  startsAt: Date = new Date()
): Date | null {
  if (product.defaultDurationDays === null) return null;
  return new Date(startsAt.getTime() + product.defaultDurationDays * 24 * 60 * 60 * 1000);
}

// ─── Entitlement creation input ──────────────────────────────────────────────

export interface CreateEntitlementInput {
  userId: string;
  productCode: ProductCode;
  label: string;
  sourceInvoiceId: string;
  startsAt?: Date;
  endsAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}
