/**
 * SSN Orchestrator — Compute Score Standardisé Nexus from assessment data.
 *
 * SSN = 0.6 × Score_Disciplinaire + 0.2 × Score_Méthodologique + 0.2 × Indice_Rigueur
 *
 * Then normalized via z-score projection against cohort distribution.
 *
 * @module core/ssn/computeSSN
 */

import { prisma } from '@/lib/prisma';
import { computeCohortStats } from '@/lib/core/statistics/cohort';
import { normalizeScore, classifySSN, type SSNLevel } from '@/lib/core/statistics/normalize';

// ─── Types ──────────────────────────────────────────────────────────────────

/** SSN computation result */
export interface SSNResult {
  /** Raw composite score before normalization (0-100) */
  rawComposite: number;
  /** Normalized SSN (0-100) */
  ssn: number;
  /** Classification level */
  level: SSNLevel;
  /** Component breakdown */
  components: {
    disciplinary: number;
    methodology: number;
    rigor: number;
  };
  /** Cohort stats used for normalization */
  cohort: {
    mean: number;
    std: number;
    sampleSize: number;
  };
}

/** Weights for SSN composite formula */
export const SSN_WEIGHTS = {
  disciplinary: 0.6,
  methodology: 0.2,
  rigor: 0.2,
} as const;

// ─── Component Extraction ───────────────────────────────────────────────────

/**
 * Extract methodology score from scoringResult metrics.
 *
 * - GENERAL subject: uses "Méthodologie" category if available
 * - MATHS/NSI: uses confidenceIndex as methodology proxy
 * - Fallback: 50 (neutral) if data unavailable
 *
 * @param scoringResult - Full scoring result JSON from assessment
 * @param confidenceIndex - Assessment confidence index (fallback)
 * @returns Methodology score (0-100)
 */
function extractMethodologyScore(
  scoringResult: Record<string, unknown> | null,
  confidenceIndex: number | null
): number {
  if (!scoringResult) return confidenceIndex ?? 50;

  try {
    const metrics = scoringResult.metrics as Record<string, unknown> | undefined;
    if (!metrics) return confidenceIndex ?? 50;

    // Try to find categoryScores with a "Méthodologie" or "methodologie" key
    const categoryScores = metrics.categoryScores as Record<string, number> | undefined;
    if (categoryScores) {
      const methKey = Object.keys(categoryScores).find(
        (k) => k.toLowerCase().includes('methodolog') || k.toLowerCase().includes('méthodolog')
      );
      if (methKey && typeof categoryScores[methKey] === 'number') {
        return categoryScores[methKey];
      }
    }

    // Fallback: use confidenceIndex as methodology proxy
    return confidenceIndex ?? 50;
  } catch {
    return confidenceIndex ?? 50;
  }
}

/**
 * Extract rigor score from scoringResult.
 *
 * Uses precisionIndex (correct / attempted) as the rigor indicator.
 * Fallback: 50 (neutral) if unavailable.
 *
 * @param scoringResult - Full scoring result JSON
 * @returns Rigor score (0-100)
 */
function extractRigorScore(scoringResult: Record<string, unknown> | null): number {
  if (!scoringResult) return 50;

  try {
    const precisionIndex = scoringResult.precisionIndex;
    if (typeof precisionIndex === 'number') {
      return precisionIndex;
    }
    return 50;
  } catch {
    return 50;
  }
}

// ─── Main SSN Computation ───────────────────────────────────────────────────

/**
 * Compute SSN for a single assessment.
 *
 * Pipeline:
 * 1. Extract 3 components from scoringResult
 * 2. Compute raw composite (weighted sum)
 * 3. Fetch cohort stats for the assessment type
 * 4. Normalize via z-score projection
 *
 * @param assessmentId - Assessment ID to compute SSN for
 * @returns SSNResult or null if assessment not found / no globalScore
 */
export async function computeSSNForAssessment(
  assessmentId: string
): Promise<SSNResult | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      subject: true,
      globalScore: true,
      confidenceIndex: true,
      scoringResult: true,
    },
  });

  if (!assessment || assessment.globalScore === null) return null;

  const scoringResult = assessment.scoringResult as Record<string, unknown> | null;

  // 1. Extract components
  const disciplinary = assessment.globalScore;
  const methodology = extractMethodologyScore(scoringResult, assessment.confidenceIndex);
  const rigor = extractRigorScore(scoringResult);

  // 2. Raw composite
  const rawComposite =
    SSN_WEIGHTS.disciplinary * disciplinary +
    SSN_WEIGHTS.methodology * methodology +
    SSN_WEIGHTS.rigor * rigor;

  // 3. Cohort stats
  const cohortStats = await computeCohortStats(assessment.subject);

  // 4. Normalize
  const ssn = normalizeScore(rawComposite, cohortStats.mean, cohortStats.std);
  const level = classifySSN(ssn);

  return {
    rawComposite: Math.round(rawComposite * 10) / 10,
    ssn,
    level,
    components: {
      disciplinary,
      methodology,
      rigor,
    },
    cohort: {
      mean: cohortStats.mean,
      std: cohortStats.std,
      sampleSize: cohortStats.sampleSize,
    },
  };
}

/**
 * Compute and persist SSN for an assessment.
 *
 * Updates Assessment.ssn and optionally creates a ProgressionHistory entry
 * if the assessment is linked to a student.
 *
 * @param assessmentId - Assessment ID
 * @returns SSNResult or null
 */
export async function computeAndPersistSSN(
  assessmentId: string
): Promise<SSNResult | null> {
  const result = await computeSSNForAssessment(assessmentId);
  if (!result) return null;

  // Persist SSN on assessment (using raw SQL since new columns may not be in generated client yet)
  await prisma.$executeRawUnsafe(
    `UPDATE "assessments" SET "ssn" = $1 WHERE "id" = $2`,
    result.ssn,
    assessmentId
  );

  // Get studentId via raw query (column may not be in generated client yet)
  const studentIdRows = await prisma.$queryRawUnsafe<{ studentId: string | null }[]>(
    `SELECT "studentId" FROM "assessments" WHERE "id" = $1`,
    assessmentId
  );
  const studentId = studentIdRows[0]?.studentId;

  // If linked to a student, record in progression history
  if (studentId) {
    const { createId } = await import('@paralleldrive/cuid2');
    await prisma.$executeRawUnsafe(
      `INSERT INTO "progression_history" ("id", "studentId", "ssn", "date") VALUES ($1, $2, $3, $4)`,
      createId(),
      studentId,
      result.ssn,
      new Date()
    );
  }

  return result;
}

/**
 * Batch recompute SSN for all assessments of a given type.
 *
 * Used by the admin recompute endpoint when cohort distribution changes.
 *
 * @param type - Assessment subject type (e.g. "MATHS", "NSI", "GENERAL")
 * @returns Number of assessments updated
 */
export async function recomputeSSNBatch(type: string): Promise<{
  updated: number;
  cohort: { mean: number; std: number; sampleSize: number };
}> {
  // First recompute cohort stats
  const cohortStats = await computeCohortStats(type);

  // Fetch all assessments with globalScore for this type
  const assessments = await prisma.assessment.findMany({
    where: {
      subject: type,
      globalScore: { not: null },
    },
    select: {
      id: true,
      globalScore: true,
      confidenceIndex: true,
      scoringResult: true,
    },
  });

  let updated = 0;

  for (const assessment of assessments) {
    const scoringResult = assessment.scoringResult as Record<string, unknown> | null;
    const disciplinary = assessment.globalScore!;
    const methodology = extractMethodologyScore(scoringResult, assessment.confidenceIndex);
    const rigor = extractRigorScore(scoringResult);

    const rawComposite =
      SSN_WEIGHTS.disciplinary * disciplinary +
      SSN_WEIGHTS.methodology * methodology +
      SSN_WEIGHTS.rigor * rigor;

    const ssn = normalizeScore(rawComposite, cohortStats.mean, cohortStats.std);

    await prisma.$executeRawUnsafe(
      `UPDATE "assessments" SET "ssn" = $1 WHERE "id" = $2`,
      ssn,
      assessment.id
    );

    updated++;
  }

  return {
    updated,
    cohort: {
      mean: cohortStats.mean,
      std: cohortStats.std,
      sampleSize: cohortStats.sampleSize,
    },
  };
}
