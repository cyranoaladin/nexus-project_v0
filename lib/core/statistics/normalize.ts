/**
 * Score Normalization — Z-score projection to SSN scale.
 *
 * Transforms a raw score into a Score Standardisé Nexus (SSN)
 * using cohort mean and standard deviation.
 *
 * Formula: SSN = 50 + 15 × Z  where Z = (raw - mean) / std
 * Clamped to [0, 100].
 *
 * @module core/statistics/normalize
 */

// ─── SSN Classification ─────────────────────────────────────────────────────

/** SSN classification levels */
export type SSNLevel =
  | 'excellence'
  | 'tres_solide'
  | 'stable'
  | 'fragile'
  | 'prioritaire';

/** SSN classification thresholds */
export const SSN_THRESHOLDS: Record<SSNLevel, { min: number; max: number; label: string }> = {
  excellence:   { min: 85, max: 100, label: 'Excellence' },
  tres_solide:  { min: 70, max: 84,  label: 'Très solide' },
  stable:       { min: 55, max: 69,  label: 'Stable' },
  fragile:      { min: 40, max: 54,  label: 'Fragile' },
  prioritaire:  { min: 0,  max: 39,  label: 'Prioritaire' },
};

// ─── Core Normalization ─────────────────────────────────────────────────────

/**
 * Normalize a raw score to SSN scale using z-score projection.
 *
 * @param raw - Raw score (0-100)
 * @param mean - Cohort mean
 * @param std - Cohort standard deviation (must be > 0)
 * @returns SSN value clamped to [0, 100]
 */
export function normalizeScore(raw: number, mean: number, std: number): number {
  if (std === 0) return 50;

  const z = (raw - mean) / std;
  const ssn = 50 + 15 * z;

  return Math.max(0, Math.min(100, Math.round(ssn * 10) / 10));
}

/**
 * Classify an SSN value into a level.
 *
 * @param ssn - SSN value (0-100)
 * @returns SSNLevel classification
 */
export function classifySSN(ssn: number): SSNLevel {
  if (ssn >= 85) return 'excellence';
  if (ssn >= 70) return 'tres_solide';
  if (ssn >= 55) return 'stable';
  if (ssn >= 40) return 'fragile';
  return 'prioritaire';
}

/**
 * Get human-readable label for an SSN value.
 *
 * @param ssn - SSN value (0-100)
 * @returns Human-readable classification label
 */
export function getSSNLabel(ssn: number): string {
  const level = classifySSN(ssn);
  return SSN_THRESHOLDS[level].label;
}

/**
 * Compute percentile position within a distribution.
 *
 * @param score - The score to position
 * @param distribution - Array of all scores in the cohort
 * @returns Percentile (0-100)
 */
export function computePercentile(score: number, distribution: number[]): number {
  if (distribution.length === 0) return 50;
  const below = distribution.filter((s) => s < score).length;
  return Math.round((below / distribution.length) * 100);
}
