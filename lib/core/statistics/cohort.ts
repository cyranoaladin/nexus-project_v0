/**
 * Cohort Statistics — Compute mean and standard deviation for SSN normalization.
 *
 * Used by the SSN pipeline to normalize raw assessment scores
 * relative to the cohort distribution.
 *
 * Filtering rules:
 *   - Only COMPLETED assessments are included
 *   - Filtered by subject (type)
 *   - Optionally filtered by assessmentVersion
 *   - isLowSample flag when n < LOW_SAMPLE_THRESHOLD (30)
 *
 * @module core/statistics/cohort
 */

import { prisma } from '@/lib/prisma';
import { COMPLETED_STATUSES } from '@/lib/core/assessment-status';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum cohort size for reliable normalization */
export const LOW_SAMPLE_THRESHOLD = 30;

// ─── Types ──────────────────────────────────────────────────────────────────

/** Cohort statistics for a given assessment type */
export interface CohortStats {
  /** Arithmetic mean of raw scores */
  mean: number;
  /** Standard deviation of raw scores */
  std: number;
  /** Number of assessments in the cohort (n) */
  n: number;
  /** @deprecated Use `n` instead */
  sampleSize: number;
  /** True if n < LOW_SAMPLE_THRESHOLD (30) — percentile/SSN are estimates */
  isLowSample: boolean;
  /** Assessment type used for filtering */
  type: string;
  /** Assessment version filter (if applied) */
  assessmentVersion?: string;
  /** ISO timestamp of computation */
  computedAt: string;
}

/** Optional filter parameters for cohort computation */
export interface CohortFilter {
  /** Assessment subject (e.g. "MATHS", "NSI") */
  type: string;
  /** Optional assessment version filter */
  assessmentVersion?: string;
}

/** Audit log entry for cohort stats computation */
export interface CohortAuditEntry {
  type: string;
  stats: CohortStats;
  previousStats?: CohortStats | null;
  delta?: {
    meanDelta: number;
    stdDelta: number;
    sampleDelta: number;
  };
}

// ─── In-memory versioned cache ──────────────────────────────────────────────

const statsCache = new Map<string, CohortStats>();

/** Build cache key from filter */
function cacheKey(filter: CohortFilter): string {
  return filter.assessmentVersion
    ? `${filter.type}:${filter.assessmentVersion}`
    : filter.type;
}

/**
 * Get cached cohort stats for a given type (and optional version).
 * Returns null if not yet computed.
 */
export function getCachedCohortStats(type: string, assessmentVersion?: string): CohortStats | null {
  return statsCache.get(cacheKey({ type, assessmentVersion })) ?? null;
}

// ─── Core Computation ───────────────────────────────────────────────────────

/**
 * Compute cohort statistics (mean, std, n) for a given assessment type.
 *
 * Strict filtering:
 *   - status = "COMPLETED" only
 *   - globalScore IS NOT NULL
 *   - subject matches type
 *   - assessmentVersion matches (if provided)
 *
 * @param filter - CohortFilter or string (backward-compatible)
 * @returns CohortStats with mean, std, n, isLowSample
 */
export async function computeCohortStats(filter: CohortFilter | string): Promise<CohortStats> {
  const f: CohortFilter = typeof filter === 'string' ? { type: filter } : filter;

  // Build strict where clause — uses centralized COMPLETED_STATUSES helper
  const where: Record<string, unknown> = {
    subject: f.type,
    status: { in: COMPLETED_STATUSES as unknown as string[] },
    globalScore: { not: null },
  };

  if (f.assessmentVersion) {
    where.assessmentVersion = f.assessmentVersion;
  }

  const assessments = await prisma.assessment.findMany({
    where,
    select: { globalScore: true },
  });

  const values = assessments
    .map((a) => a.globalScore)
    .filter((v): v is number => v !== null);

  const n = values.length;

  if (n === 0) {
    const emptyStats: CohortStats = {
      mean: 50,
      std: 15,
      n: 0,
      sampleSize: 0,
      isLowSample: true,
      type: f.type,
      assessmentVersion: f.assessmentVersion,
      computedAt: new Date().toISOString(),
    };
    statsCache.set(cacheKey(f), emptyStats);
    return emptyStats;
  }

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  const stats: CohortStats = {
    mean,
    std: std === 0 ? 15 : std, // Avoid division by zero in normalization
    n,
    sampleSize: n,
    isLowSample: n < LOW_SAMPLE_THRESHOLD,
    type: f.type,
    assessmentVersion: f.assessmentVersion,
    computedAt: new Date().toISOString(),
  };

  // Update cache
  statsCache.set(cacheKey(f), stats);

  return stats;
}

/**
 * Compute cohort stats and return audit entry with delta from previous computation.
 *
 * @param filter - CohortFilter or string
 * @returns CohortAuditEntry with current stats and delta from previous
 */
export async function computeCohortStatsWithAudit(
  filter: CohortFilter | string
): Promise<CohortAuditEntry> {
  const f: CohortFilter = typeof filter === 'string' ? { type: filter } : filter;
  const previousStats = getCachedCohortStats(f.type, f.assessmentVersion);
  const stats = await computeCohortStats(f);

  const entry: CohortAuditEntry = {
    type: f.type,
    stats,
    previousStats: previousStats ?? null,
  };

  if (previousStats) {
    entry.delta = {
      meanDelta: stats.mean - previousStats.mean,
      stdDelta: stats.std - previousStats.std,
      sampleDelta: stats.n - previousStats.n,
    };
  }

  return entry;
}
