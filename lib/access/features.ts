/**
 * Feature Catalog — Single source of truth for feature gating.
 *
 * Each FeatureKey maps to a definition with:
 * - label: human-readable name
 * - description: what it grants
 * - requires: entitlement features needed (from PRODUCT_REGISTRY)
 * - fallback: UX behavior when denied (HIDE | DISABLE | REDIRECT)
 * - rolesExempt: roles that bypass entitlement check (e.g. ADMIN)
 */

// ─── Feature Keys ────────────────────────────────────────────────────────────

export type FeatureKey =
  | 'platform_access'
  | 'hybrid_sessions'
  | 'immersion_mode'
  | 'aria_maths'
  | 'aria_nsi'
  | 'ai_feedback'
  | 'advanced_analytics'
  | 'priority_support'
  | 'credits_use'
  | 'admin_facturation';

// ─── Fallback Mode ───────────────────────────────────────────────────────────

export type FallbackMode = 'HIDE' | 'DISABLE' | 'REDIRECT';

// ─── Feature Definition ──────────────────────────────────────────────────────

export interface FeatureDefinition {
  /** Human-readable label */
  label: string;
  /** Description of what this feature grants */
  description: string;
  /** Entitlement features required (from PRODUCT_REGISTRY.features) */
  requires: string[];
  /** UX behavior when denied */
  fallback: FallbackMode;
  /** Roles that bypass entitlement check entirely */
  rolesExempt: string[];
}

// ─── Feature Registry ────────────────────────────────────────────────────────

export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  platform_access: {
    label: 'Accès Plateforme',
    description: 'Accès de base à la plateforme Nexus Réussite',
    requires: ['platform_access'],
    fallback: 'REDIRECT',
    rolesExempt: ['ADMIN', 'ASSISTANTE', 'COACH'],
  },
  hybrid_sessions: {
    label: 'Sessions Hybrides',
    description: 'Accès aux sessions de coaching hybrides (présentiel + en ligne)',
    requires: ['hybrid_sessions'],
    fallback: 'DISABLE',
    rolesExempt: ['ADMIN', 'ASSISTANTE'],
  },
  immersion_mode: {
    label: 'Mode Immersion',
    description: 'Accès au mode immersion complète avec suivi intensif',
    requires: ['immersion_mode'],
    fallback: 'DISABLE',
    rolesExempt: ['ADMIN', 'ASSISTANTE'],
  },
  aria_maths: {
    label: 'ARIA — Maths',
    description: 'Assistant IA spécialisé en mathématiques',
    requires: ['aria_maths'],
    fallback: 'REDIRECT',
    rolesExempt: ['ADMIN'],
  },
  aria_nsi: {
    label: 'ARIA — NSI',
    description: 'Assistant IA spécialisé en NSI',
    requires: ['aria_nsi'],
    fallback: 'REDIRECT',
    rolesExempt: ['ADMIN'],
  },
  ai_feedback: {
    label: 'AI Feedback',
    description: 'Retours personnalisés générés par intelligence artificielle',
    requires: ['ai_feedback'],
    fallback: 'DISABLE',
    rolesExempt: ['ADMIN'],
  },
  advanced_analytics: {
    label: 'Analytics Premium',
    description: 'Tableaux de bord avancés et analyses détaillées',
    requires: ['advanced_analytics'],
    fallback: 'HIDE',
    rolesExempt: ['ADMIN'],
  },
  priority_support: {
    label: 'Support Prioritaire',
    description: 'Accès au support prioritaire avec temps de réponse garanti',
    requires: ['priority_support'],
    fallback: 'DISABLE',
    rolesExempt: ['ADMIN'],
  },
  credits_use: {
    label: 'Utilisation de Crédits',
    description: 'Consommer des crédits pour réserver des sessions',
    requires: ['credits_use'],
    fallback: 'REDIRECT',
    rolesExempt: ['ADMIN', 'ASSISTANTE'],
  },
  admin_facturation: {
    label: 'Facturation Admin',
    description: 'Gestion des factures et de la facturation',
    requires: ['admin_facturation'],
    fallback: 'REDIRECT',
    rolesExempt: ['ADMIN'],
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check if a string is a valid FeatureKey.
 */
export function isValidFeatureKey(key: string): key is FeatureKey {
  return key in FEATURES;
}

/**
 * Get feature definition by key. Returns null if unknown.
 */
export function getFeatureDefinition(key: string): FeatureDefinition | null {
  if (!isValidFeatureKey(key)) return null;
  return FEATURES[key];
}

/**
 * Get all feature keys.
 */
export function getAllFeatureKeys(): FeatureKey[] {
  return Object.keys(FEATURES) as FeatureKey[];
}
