/**
 * Unified Academic Index (UAI) — Multi-discipline composite score.
 *
 * Combines SSN scores across disciplines into a single comparable index.
 *
 * Formula: UAI = Σ(w_i × SSN_i) where Σw_i = 1
 *
 * Default weights:
 *   - MATHS: 0.60
 *   - NSI:   0.40
 *
 * Weights are configurable per student or globally.
 *
 * @module core/uai/computeUAI
 */

import { prisma } from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Weight configuration for UAI computation */
export interface UAIWeights {
  [subject: string]: number;
}

/** UAI computation result */
export interface UAIResult {
  /** Unified Academic Index (0-100) */
  uai: number;
  /** Weights used */
  weights: UAIWeights;
  /** Individual SSN values per subject */
  components: { subject: string; ssn: number; weight: number; contribution: number }[];
  /** Number of subjects included */
  subjectCount: number;
}

// ─── Default Weights ────────────────────────────────────────────────────────

/** Default subject weights for UAI */
export const DEFAULT_UAI_WEIGHTS: UAIWeights = {
  MATHS: 0.60,
  NSI: 0.40,
};

// ─── Core Computation ───────────────────────────────────────────────────────

/**
 * Compute UAI from a map of subject SSN values.
 *
 * @param ssnBySubject - Map of subject → SSN value
 * @param weights - Optional custom weights (defaults to DEFAULT_UAI_WEIGHTS)
 * @returns UAIResult or null if no valid SSN values
 */
export function computeUAI(
  ssnBySubject: Record<string, number>,
  weights: UAIWeights = DEFAULT_UAI_WEIGHTS
): UAIResult | null {
  const subjects = Object.keys(ssnBySubject).filter(
    (s) => typeof ssnBySubject[s] === 'number' && !isNaN(ssnBySubject[s])
  );

  if (subjects.length === 0) return null;

  // Normalize weights to sum to 1 for available subjects
  const availableWeights: UAIWeights = {};
  let totalWeight = 0;

  for (const subject of subjects) {
    const w = weights[subject] ?? (1 / subjects.length); // Equal weight if not configured
    availableWeights[subject] = w;
    totalWeight += w;
  }

  // Normalize
  if (totalWeight > 0) {
    for (const subject of subjects) {
      availableWeights[subject] = availableWeights[subject] / totalWeight;
    }
  }

  // Compute UAI
  const components = subjects.map((subject) => {
    const ssn = ssnBySubject[subject];
    const weight = availableWeights[subject];
    return {
      subject,
      ssn,
      weight: Math.round(weight * 1000) / 1000,
      contribution: Math.round(ssn * weight * 10) / 10,
    };
  });

  const uai = Math.round(
    components.reduce((sum, c) => sum + c.ssn * c.weight, 0) * 10
  ) / 10;

  return {
    uai: Math.max(0, Math.min(100, uai)),
    weights: availableWeights,
    components,
    subjectCount: subjects.length,
  };
}

/**
 * Compute and persist UAI for a student based on their latest SSN per subject.
 *
 * Fetches the most recent assessment SSN for each subject,
 * computes UAI, and updates the latest assessment with the UAI value.
 *
 * @param studentEmail - Student email to look up assessments
 * @param weights - Optional custom weights
 * @returns UAIResult or null if insufficient data
 */
export async function computeAndPersistUAI(
  studentEmail: string,
  weights: UAIWeights = DEFAULT_UAI_WEIGHTS
): Promise<UAIResult | null> {
  // F18 — Fetch latest SSN per subject for this student via Prisma
  // Note: DISTINCT ON is PostgreSQL-specific; we use groupBy-like pattern with Prisma
  const assessments = await prisma.assessment.findMany({
    where: {
      studentEmail,
      ssn: { not: null },
    },
    orderBy: [{ subject: 'asc' }, { createdAt: 'desc' }],
    select: { subject: true, ssn: true, id: true },
  });

  if (!Array.isArray(assessments) || assessments.length === 0) return null;

  // Group by subject and take first (latest) for each
  const seenSubjects = new Set<string>();
  const latestAssessments = assessments.filter((a) => {
    if (seenSubjects.has(a.subject)) return false;
    seenSubjects.add(a.subject);
    return true;
  });

  if (latestAssessments.length < 2) return null; // Need at least 2 subjects for UAI

  const ssnBySubject: Record<string, number> = {};
  for (const a of latestAssessments) {
    if (a.ssn !== null) {
      ssnBySubject[a.subject] = a.ssn;
    }
  }

  const result = computeUAI(ssnBySubject, weights);
  if (!result) return null;

  // F18 — Persist UAI on the most recent assessment for each subject via Prisma
  for (const a of latestAssessments) {
    await prisma.assessment.update({
      where: { id: a.id },
      data: { uai: result.uai },
    });
  }

  return result;
}
