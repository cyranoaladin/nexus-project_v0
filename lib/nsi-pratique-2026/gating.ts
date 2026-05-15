/**
 * NSI Pratique 2026 — Feature gating helpers
 *
 * Designed to plug into the existing entitlement system.
 * Currently returns "open access" for all features (no gating enforced).
 * When ready to gate, flip GATING_ENABLED to true and wire up user entitlements.
 */

/** Feature gating is disabled for V1 launch — all features open */
const GATING_ENABLED = false;

export type NsiFeatureTier = 'free' | 'premium' | 'masterium';

export interface NsiFeatureGate {
  key: string;
  label: string;
  tier: NsiFeatureTier;
}

/** NSI feature definitions with tier requirements */
export const NSI_FEATURES: NsiFeatureGate[] = [
  // Free tier
  { key: 'hero', label: 'Vue d\'ensemble', tier: 'free' },
  { key: 'plan', label: 'Plan 5 jours', tier: 'free' },
  { key: 'patterns', label: 'Patrons de code', tier: 'free' },
  { key: 'subjects_demo', label: 'Sujets démo (1, 2, 5)', tier: 'free' },
  // Premium tier
  { key: 'subjects_all', label: '23 sujets complets', tier: 'premium' },
  { key: 'flashcards', label: 'Flashcards Leitner', tier: 'premium' },
  { key: 'oral', label: 'Entraînement oral', tier: 'premium' },
  { key: 'assessment', label: 'Auto-évaluation', tier: 'premium' },
  { key: 'questions', label: 'Questions transversales', tier: 'premium' },
  { key: 'progress', label: 'Suivi de progression', tier: 'premium' },
  // Masterium tier
  { key: 'mock', label: 'Sujet blanc avancé', tier: 'masterium' },
  { key: 'export', label: 'Export/import progression', tier: 'masterium' },
  { key: 'report', label: 'Rapport de préparation', tier: 'masterium' },
];

/** Demo subject IDs available in free tier */
export const FREE_SUBJECT_IDS = [1, 2, 5] as const;

/** Check if a specific NSI feature is accessible */
export function canAccessNsiFeature(
  featureKey: string,
  _userTier: NsiFeatureTier = 'premium'
): boolean {
  if (!GATING_ENABLED) return true;

  const feature = NSI_FEATURES.find(f => f.key === featureKey);
  if (!feature) return false;

  const tierHierarchy: Record<NsiFeatureTier, number> = {
    free: 0,
    premium: 1,
    masterium: 2,
  };

  return tierHierarchy[_userTier] >= tierHierarchy[feature.tier];
}

/** Check if a specific subject is accessible */
export function canAccessSubject(
  subjectId: number,
  _userTier: NsiFeatureTier = 'premium'
): boolean {
  if (!GATING_ENABLED) return true;
  if ((FREE_SUBJECT_IDS as readonly number[]).includes(subjectId)) return true;
  return canAccessNsiFeature('subjects_all', _userTier);
}
