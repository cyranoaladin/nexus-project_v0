/**
 * Zod validation schemas for BusinessConfig namespaces.
 *
 * Each namespace has:
 * - A per-key schema (validates the JSON value for a single key)
 * - Cross-namespace invariants (e.g., lowering a price re-checks deposit floors)
 *
 * DOC-4 §2: an écriture Tier DONNÉES re-valide les invariants
 * inter-namespaces impactés.
 */
import { z } from 'zod';
import { getOverride } from './snapshot';
import pricingCanonical from '@/data/pricing-client-data.generated.json';

// ── Schema version — bump when adding/removing keys ──

export const SCHEMA_VERSION = '1.0';

// ── Static fallbacks from canonical (single source — used by invariants,
// getCurrentMinPrice, and GET /api/admin/config) ──

const canonicalRules = pricingCanonical.rules as Record<string, unknown>;

// ── Startup assertion: verify all expected fallback keys exist in canonical ──
// If a key is renamed/removed in the canonical JSON without updating the
// schema, invariants would silently become no-ops (same hole we just closed).
const EXPECTED_FALLBACK_KEYS = [
  'pricing.rules::group_max',
  'pricing.rules::group_min_open.lycee',
  'pricing.rules::group_min_open.college',
  'pricing.rules::group_min_open.online_live',
  'pricing.rules::group_min_open.stage',
  'pricing.rules::group_min_open.stage_college',
  'pricing.rules::payment.deposit_pct',
  'pricing.rules::payment.deposit_pct_annual',
  'pricing.rules::payment.deposit_pct_stage',
  'pricing.rules::payment.rounding_tnd',
  'pricing.rules::payment.installments_default',
  'pricing.rules::discounts.comptant_pct',
  'pricing.rules::discounts.fratrie_2nd_child_pct',
  'pricing.rules::discounts.ancien_eleve_min_pct',
  'pricing.rules::discounts.ancien_eleve_max_pct',
  'pricing.rules::discounts.parrainage_min_tnd',
  'pricing.rules::discounts.parrainage_max_tnd',
  'pricing.rules::discounts.carte_nexus_pct',
  'pricing.rules::discounts.global_cap_pct',
  'pricing.floors::single',
  'pricing.floors::multi',
  'pricing.floors::college',
  'pricing.floors::stage',
  'pricing.floors::coaching_1to1',
  'pricing.floors::carte_member',
  'pricing.floors::pack',
];

function resolveCanonicalKey(namespace: string, key: string): unknown | null {
  if (namespace === 'pricing.rules') {
    const parts = key.split('.');
    let current: unknown = canonicalRules;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[part];
    }
    return current ?? null;
  }
  if (namespace === 'pricing.floors') {
    const floors = canonicalRules.price_floor_per_student_hour_tnd;
    if (floors && typeof floors === 'object') {
      return (floors as Record<string, unknown>)[key] ?? null;
    }
    return null;
  }
  return null;
}

// Fail-fast at module load: every expected key must resolve to a non-null value.
for (const fk of EXPECTED_FALLBACK_KEYS) {
  const [ns, k] = fk.split('::');
  const val = resolveCanonicalKey(ns, k);
  if (val === null || val === undefined) {
    throw new Error(
      `[config/schemas] Canonical fallback missing for ${fk}. ` +
      `Update EXPECTED_FALLBACK_KEYS or fix data/pricing-client-data.generated.json.`,
    );
  }
}

/** Resolve a static fallback value for a namespace+key from canonical data. */
export function getStaticFallback(namespace: string, key: string): unknown | null {
  if (namespace === 'products.credits') {
    // No static fallback — product credits are in PRODUCT_REGISTRY (Lot 5)
    return null;
  }
  return resolveCanonicalKey(namespace, key);
}

// ── Namespace: pricing.rules ──

const pricingRulesKeySchemas = {
  group_max: z.number().int().min(1).max(20),
  'group_min_open.lycee': z.number().int().min(1).max(10),
  'group_min_open.college': z.number().int().min(1).max(10),
  'group_min_open.online_live': z.number().int().min(1).max(10),
  'group_min_open.stage': z.number().int().min(1).max(10),
  'group_min_open.stage_college': z.number().int().min(1).max(10),
  semi_individual_surcharge_pct: z.number().min(0).max(200),
  'payment.deposit_pct': z.number().min(0).max(100),
  'payment.deposit_pct_annual': z.number().min(0).max(100),
  'payment.deposit_pct_stage': z.number().min(0).max(100),
  'payment.installments_default': z.number().int().min(1).max(24),
  'payment.rounding_tnd': z.number().int().min(1).max(100),
  'discounts.comptant_pct': z.number().min(0).max(100),
  'discounts.fratrie_2nd_child_pct': z.number().min(0).max(100),
  'discounts.ancien_eleve_min_pct': z.number().min(0).max(100),
  'discounts.ancien_eleve_max_pct': z.number().min(0).max(100),
  'discounts.parrainage_min_tnd': z.number().min(0),
  'discounts.parrainage_max_tnd': z.number().min(0),
  'discounts.carte_nexus_pct': z.number().min(0).max(100),
  'discounts.global_cap_pct': z.number().min(0).max(100),
} as const;

// ── Namespace: pricing.floors ──

const pricingFloorsKeySchemas = {
  single: z.number().min(0),
  multi: z.number().min(0),
  college: z.number().min(0),
  stage: z.number().min(0),
  coaching_1to1: z.number().min(0),
  carte_member: z.number().min(0),
  pack: z.number().min(0),
} as const;

// ── Namespace: products.credits ──

const productsCreditsKeySchema = z.number().int().min(0).max(1000);

// ── Registry ──

export type NamespaceId = 'pricing.rules' | 'pricing.floors' | 'products.credits';

interface NamespaceSpec {
  /** Validate a single key's value */
  validateKey(key: string, value: unknown): z.SafeParseReturnType<unknown, unknown>;
  /** List valid keys for this namespace */
  validKeys: string[] | null; // null = any key accepted (e.g., products.credits uses productCodes)
}

const NAMESPACE_SPECS: Record<NamespaceId, NamespaceSpec> = {
  'pricing.rules': {
    validateKey(key, value) {
      const schema = pricingRulesKeySchemas[key as keyof typeof pricingRulesKeySchemas];
      if (!schema) return { success: false, error: new z.ZodError([{ code: 'custom', message: `Unknown key: ${key}`, path: [key] }]) } as z.SafeParseReturnType<unknown, never>;
      return schema.safeParse(value);
    },
    validKeys: Object.keys(pricingRulesKeySchemas),
  },
  'pricing.floors': {
    validateKey(key, value) {
      const schema = pricingFloorsKeySchemas[key as keyof typeof pricingFloorsKeySchemas];
      if (!schema) return { success: false, error: new z.ZodError([{ code: 'custom', message: `Unknown key: ${key}`, path: [key] }]) } as z.SafeParseReturnType<unknown, never>;
      return schema.safeParse(value);
    },
    validKeys: Object.keys(pricingFloorsKeySchemas),
  },
  'products.credits': {
    validateKey(_key, value) {
      return productsCreditsKeySchema.safeParse(value);
    },
    validKeys: null, // Accepts any productCode
  },
};

// ── Validation entry points ──

export function validateConfigEntry(
  namespace: string,
  key: string,
  value: unknown,
): { valid: true } | { valid: false; error: string } {
  const spec = NAMESPACE_SPECS[namespace as NamespaceId];
  if (!spec) {
    return { valid: false, error: `Unknown namespace: ${namespace}` };
  }

  // Per-key validation
  const result = spec.validateKey(key, value);
  if (!result.success) {
    return { valid: false, error: result.error.issues.map((i) => i.message).join('; ') };
  }

  return { valid: true };
}

/**
 * Cross-namespace invariants — checked after a write.
 * Returns an array of violated invariant descriptions (empty = all ok).
 *
 * Invariants:
 * 1. discount min ≤ max (ancien_eleve, parrainage)
 * 2. deposit_pct > 0 when installments_default > 1
 * 3. group_min_open ≤ group_max for each context
 * 4. global_cap_pct ≥ max individual discount
 * 5. price floors remain above minimum viable (getCurrentMinPrice)
 */
/**
 * @param resolver  Optional function to resolve existing config values.
 *                  Defaults to getOverride() (reads snapshot). Pass a
 *                  transactional resolver to read from the DB within a
 *                  transaction for TOCTOU-safe cross-key validation.
 */
export function validateCrossInvariants(
  pendingNamespace: string,
  pendingKey: string,
  pendingValue: unknown,
  resolver?: (ns: string, k: string) => unknown | null,
): string[] {
  const violations: string[] = [];
  const resolveOverride = resolver ?? ((ns: string, k: string) => getOverride(ns, k));

  // Helper: get effective value — override ?? static fallback.
  // Never returns null for a known canonical key, ensuring invariants
  // always validate against the effective state (not against a void).
  function effective<T>(ns: string, k: string): T | null {
    if (ns === pendingNamespace && k === pendingKey) return pendingValue as T;
    const override = resolveOverride(ns, k);
    if (override !== null && override !== undefined) return override as T;
    return getStaticFallback(ns, k) as T | null;
  }

  // Invariant 1: discount min ≤ max (ancien_eleve)
  if (pendingNamespace === 'pricing.rules' && (pendingKey === 'discounts.ancien_eleve_min_pct' || pendingKey === 'discounts.ancien_eleve_max_pct')) {
    const min = effective<number>('pricing.rules', 'discounts.ancien_eleve_min_pct');
    const max = effective<number>('pricing.rules', 'discounts.ancien_eleve_max_pct');
    if (min !== null && max !== null && min > max) {
      violations.push(`ancien_eleve_min_pct (${min}) > ancien_eleve_max_pct (${max})`);
    }
  }

  // Invariant 1b: parrainage min ≤ max
  if (pendingNamespace === 'pricing.rules' && (pendingKey === 'discounts.parrainage_min_tnd' || pendingKey === 'discounts.parrainage_max_tnd')) {
    const min = effective<number>('pricing.rules', 'discounts.parrainage_min_tnd');
    const max = effective<number>('pricing.rules', 'discounts.parrainage_max_tnd');
    if (min !== null && max !== null && min > max) {
      violations.push(`parrainage_min_tnd (${min}) > parrainage_max_tnd (${max})`);
    }
  }

  // Invariant 2: deposit_pct variants > 0 when installments > 1
  const depositKeys = ['payment.deposit_pct', 'payment.deposit_pct_annual', 'payment.deposit_pct_stage'] as const;
  if (pendingNamespace === 'pricing.rules' && (depositKeys.includes(pendingKey as typeof depositKeys[number]) || pendingKey === 'payment.installments_default')) {
    const installments = effective<number>('pricing.rules', 'payment.installments_default');
    if (installments !== null && installments > 1) {
      for (const dk of depositKeys) {
        const depositPct = effective<number>('pricing.rules', dk);
        if (depositPct !== null && depositPct === 0) {
          violations.push(`${dk} is 0 but installments_default is ${installments} (needs deposit > 0 for splitting)`);
        }
      }
    }
  }

  // Invariant 3: group_min_open ≤ group_max
  if (pendingNamespace === 'pricing.rules' && (pendingKey === 'group_max' || pendingKey.startsWith('group_min_open.'))) {
    const groupMax = effective<number>('pricing.rules', 'group_max');
    for (const ctx of ['lycee', 'college', 'online_live', 'stage', 'stage_college']) {
      const minOpen = effective<number>('pricing.rules', `group_min_open.${ctx}`);
      if (groupMax !== null && minOpen !== null && minOpen > groupMax) {
        violations.push(`group_min_open.${ctx} (${minOpen}) > group_max (${groupMax})`);
      }
    }
  }

  // Invariant 4: global_cap_pct ≥ max individual discount — BIDIRECTIONAL
  // Triggers when touching the cap OR any individual discount
  const discountKeys = ['discounts.comptant_pct', 'discounts.fratrie_2nd_child_pct', 'discounts.ancien_eleve_max_pct', 'discounts.carte_nexus_pct'] as const;
  if (pendingNamespace === 'pricing.rules' && (pendingKey === 'discounts.global_cap_pct' || discountKeys.includes(pendingKey as typeof discountKeys[number]))) {
    const cap = effective<number>('pricing.rules', 'discounts.global_cap_pct');
    if (cap !== null) {
      for (const dk of discountKeys) {
        const disc = effective<number>('pricing.rules', dk);
        if (disc !== null && disc > cap) {
          violations.push(`global_cap_pct (${cap}) < ${dk} (${disc}) — cap must be ≥ max individual discount`);
        }
      }
    }
  }

  // Invariant 5: payment deposit viability at price floors.
  // Scope: pricing.floors (price_floor_per_student_hour_tnd) only.
  // Offer/plan prices are NOT editable in Tier DONNÉES at this lot (Lot 3).
  // When Lot 5 makes offer prices editable, this invariant MUST extend to
  // also trigger on offer price changes and check against getCurrentMinPrice()
  // across ALL price sources (floors + offers). See DOC-4 §2 note.
  if (
    pendingNamespace === 'pricing.floors' ||
    (pendingNamespace === 'pricing.rules' && (
      // Only generic deposit_pct is checked against hourly floors.
      // _annual/_stage apply to offer/plan prices (Lot 5 scope).
      pendingKey === 'payment.deposit_pct' ||
      pendingKey === 'payment.rounding_tnd'
    ))
  ) {
    // Compute effective deposit parameters — check ALL deposit variants
    const rounding = effective<number>('pricing.rules', 'payment.rounding_tnd');
    // Only generic deposit_pct checked against hourly floors.
    // _annual/_stage checked against their respective offer prices in Lot 5.
    const floorDepositVariants = ['payment.deposit_pct'] as const;

    if (rounding !== null && rounding > 0) {
      const floorKeys = ['single', 'multi', 'college', 'stage', 'coaching_1to1', 'carte_member', 'pack'] as const;
      for (const dpk of floorDepositVariants) {
        const depositPct = effective<number>('pricing.rules', dpk);
        if (depositPct === null) continue;
        for (const fk of floorKeys) {
          const floor = effective<number>('pricing.floors', fk);
          if (floor !== null && floor > 0) {
            const deposit = Math.round((floor * depositPct) / 100 / rounding) * rounding;
            if (deposit <= 0) {
              violations.push(`deposit rounds to 0 at floor ${fk}=${floor} TND/h (${dpk}=${depositPct}%, rounding=${rounding})`);
            }
            if (deposit > floor) {
              violations.push(`deposit (${deposit}) exceeds floor price ${fk}=${floor} TND/h (${dpk}=${depositPct}%)`);
            }
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Get the dynamically computed minimum price across all floor types.
 * Uses overrides from the config store if present, else static fallbacks.
 */
export function getCurrentMinPrice(staticFloors: Record<string, number>): number {
  const effectiveFloors: number[] = [];
  for (const [floorKey, staticValue] of Object.entries(staticFloors)) {
    const override = getOverride<number>('pricing.floors', floorKey);
    effectiveFloors.push(override !== null ? override : staticValue);
  }
  return effectiveFloors.length > 0 ? Math.min(...effectiveFloors) : 0;
}

export function getValidNamespaces(): NamespaceId[] {
  return Object.keys(NAMESPACE_SPECS) as NamespaceId[];
}

export function getNamespaceKeys(namespace: NamespaceId): string[] | null {
  return NAMESPACE_SPECS[namespace]?.validKeys ?? null;
}
