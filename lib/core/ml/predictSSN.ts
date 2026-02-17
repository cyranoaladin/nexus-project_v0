/**
 * ML Predictive Module — SSN Projection Engine
 *
 * Predicts future SSN at 8-week horizon using lightweight Ridge regression.
 * No heavy ML dependencies — pure TypeScript computation.
 *
 * Model: SSN_future = β₀ + β₁(SSN_current) + β₂(hours) + β₃(methodology) + β₄(trend)
 *
 * @module core/ml/predictSSN
 */

import { prisma } from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Input features for SSN prediction */
export interface PredictionInput {
  /** Current SSN (0-100) */
  ssn: number;
  /** Weekly study hours */
  weeklyHours: number;
  /** Methodology score (0-100) */
  methodologyScore: number;
  /** Progression trend from historical SSN values */
  progressionTrend: number;
}

/** Prediction result */
export interface PredictionResult {
  /** Projected SSN at 8-week horizon (0-100) */
  ssnProjected: number;
  /** Prediction confidence (0-100) */
  confidence: number;
  /** Model version used */
  modelVersion: string;
  /** Input features snapshot */
  inputSnapshot: PredictionInput;
  /** Breakdown of confidence components */
  confidenceBreakdown: {
    bilansNorm: number;
    stabiliteTrend: number;
    dispersionInverse: number;
  };
}

/** Ridge regression coefficients */
interface RidgeCoefficients {
  intercept: number;
  ssn: number;
  hours: number;
  methodology: number;
  trend: number;
}

// ─── Model Configuration ────────────────────────────────────────────────────

/** Current model version */
export const MODEL_VERSION = 'ridge_v1';

/**
 * Ridge regression coefficients.
 * Calibrated on initial cohort data. Will be updated as more data arrives.
 */
const BETA: RidgeCoefficients = {
  intercept: 5,
  ssn: 0.6,
  hours: 1.2,
  methodology: 0.3,
  trend: 0.8,
};

/** Confidence formula weights */
const CONFIDENCE_WEIGHTS = {
  bilans: 0.4,
  stabilite: 0.3,
  dispersion: 0.3,
} as const;

// ─── Confidence Computation ─────────────────────────────────────────────────

/**
 * Compute stabilitéTrend with cohérenceAmplitude.
 *
 * stabilitéTrend = 0.6 × cohérenceDirection + 0.4 × cohérenceAmplitude
 *
 * - cohérenceDirection: consecutive deltas have same sign → high consistency
 * - cohérenceAmplitude: consecutive deltas have similar magnitude → high consistency
 *
 * @param ssnHistory - Chronological array of past SSN values
 * @returns Stability score (0-100)
 */
export function computeStabiliteTrend(ssnHistory: number[]): number {
  if (ssnHistory.length < 3) return 50; // neutral with insufficient data

  const deltas: number[] = [];
  for (let i = 1; i < ssnHistory.length; i++) {
    deltas.push(ssnHistory[i] - ssnHistory[i - 1]);
  }

  if (deltas.length < 2) return 50;

  // Direction consistency
  let consistentDir = 0;
  for (let i = 1; i < deltas.length; i++) {
    if (Math.sign(deltas[i]) === Math.sign(deltas[i - 1])) consistentDir++;
  }
  const dirScore = (consistentDir / (deltas.length - 1)) * 100;

  // Amplitude consistency
  let ampRatioSum = 0;
  for (let i = 1; i < deltas.length; i++) {
    const a = Math.abs(deltas[i]);
    const b = Math.abs(deltas[i - 1]);
    const maxAB = Math.max(a, b);
    ampRatioSum += maxAB === 0 ? 1 : Math.min(a, b) / maxAB;
  }
  const ampScore = (ampRatioSum / (deltas.length - 1)) * 100;

  return Math.round(0.6 * dirScore + 0.4 * ampScore);
}

/**
 * Compute prediction confidence index.
 *
 * confidence = 0.4 × nombreBilansNormalisé + 0.3 × stabilitéTrend + 0.3 × dispersionInverse
 *
 * @param assessmentCount - Number of past assessments for this student
 * @param ssnHistory - Array of past SSN values (chronological)
 * @returns Confidence (0-100) and component breakdown
 */
export function computePredictionConfidence(
  assessmentCount: number,
  ssnHistory: number[]
): { confidence: number; breakdown: { bilansNorm: number; stabiliteTrend: number; dispersionInverse: number } } {
  // 1. nombreBilansNormalisé (0-100): 1 bilan = 20, 5+ = 100
  const bilansNorm = Math.min(assessmentCount / 5, 1) * 100;

  // 2. stabilitéTrend (0-100) with cohérenceAmplitude
  const stabiliteTrend = computeStabiliteTrend(ssnHistory);

  // 3. dispersionInverse (0-100): low std → high confidence
  let dispersionInverse = 50; // neutral default
  if (ssnHistory.length >= 2) {
    const mean = ssnHistory.reduce((a, b) => a + b, 0) / ssnHistory.length;
    const std = Math.sqrt(
      ssnHistory.reduce((a, b) => a + (b - mean) ** 2, 0) / ssnHistory.length
    );
    // std=0 → 100, std=25 → 0 (linear mapping)
    dispersionInverse = Math.max(0, Math.min(100, 100 - std * 4));
  }

  const confidence = Math.round(
    CONFIDENCE_WEIGHTS.bilans * bilansNorm +
    CONFIDENCE_WEIGHTS.stabilite * stabiliteTrend +
    CONFIDENCE_WEIGHTS.dispersion * dispersionInverse
  );

  return {
    confidence: Math.max(0, Math.min(100, confidence)),
    breakdown: {
      bilansNorm: Math.round(bilansNorm),
      stabiliteTrend: Math.round(stabiliteTrend),
      dispersionInverse: Math.round(dispersionInverse),
    },
  };
}

// ─── Core Prediction ────────────────────────────────────────────────────────

/**
 * Predict future SSN using Ridge regression model.
 *
 * @param input - Prediction input features
 * @returns Predicted SSN clamped to [0, 100]
 */
export function predictSSNFromInput(input: PredictionInput): number {
  const prediction =
    BETA.intercept +
    BETA.ssn * input.ssn +
    BETA.hours * input.weeklyHours +
    BETA.methodology * input.methodologyScore +
    BETA.trend * input.progressionTrend;

  return Math.min(100, Math.max(0, Math.round(prediction * 10) / 10));
}

/**
 * Compute progression trend from SSN history.
 *
 * Uses simple linear slope of the last N SSN values.
 * Positive = improving, negative = declining, 0 = stable.
 *
 * @param ssnHistory - Chronological array of SSN values
 * @returns Trend value (typically -20 to +20)
 */
function computeProgressionTrend(ssnHistory: number[]): number {
  if (ssnHistory.length < 2) return 0;

  // Simple slope: (last - first) / count
  const first = ssnHistory[0];
  const last = ssnHistory[ssnHistory.length - 1];
  const slope = (last - first) / ssnHistory.length;

  // Clamp to reasonable range
  return Math.max(-20, Math.min(20, slope));
}

// ─── Full Pipeline ──────────────────────────────────────────────────────────

/**
 * Full prediction pipeline for a student.
 *
 * 1. Fetch student's SSN history from progression_history
 * 2. Compute progression trend
 * 3. Predict future SSN
 * 4. Compute confidence
 * 5. Persist to projection_history
 *
 * @param studentId - Student ID (from students table)
 * @param weeklyHours - Estimated weekly study hours
 * @param methodologyScore - Methodology score (0-100), or null to use latest
 * @returns PredictionResult or null if insufficient data
 */
export async function predictSSNForStudent(
  studentId: string,
  weeklyHours: number = 3,
  methodologyScore?: number
): Promise<PredictionResult | null> {
  // Fetch SSN history via raw query (table may not be in generated client yet)
  const history = await prisma.$queryRawUnsafe<{ ssn: number; date: Date }[]>(
    `SELECT "ssn", "date" FROM "progression_history" WHERE "studentId" = $1 ORDER BY "date" ASC`,
    studentId
  );

  if (history.length === 0) return null;

  const ssnHistory = history.map((h) => h.ssn);
  const currentSSN = ssnHistory[ssnHistory.length - 1];

  // Compute trend
  const progressionTrend = computeProgressionTrend(ssnHistory);

  // Use provided methodology score or default to 50
  const methScore = methodologyScore ?? 50;

  const input: PredictionInput = {
    ssn: currentSSN,
    weeklyHours,
    methodologyScore: methScore,
    progressionTrend,
  };

  // Predict
  const ssnProjected = predictSSNFromInput(input);

  // Confidence
  const { confidence, breakdown } = computePredictionConfidence(
    ssnHistory.length,
    ssnHistory
  );

  // Persist to projection_history
  const { createId } = await import('@paralleldrive/cuid2');
  await prisma.$executeRawUnsafe(
    `INSERT INTO "projection_history" ("id", "studentId", "ssnProjected", "confidenceIndex", "modelVersion", "inputSnapshot", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    createId(),
    studentId,
    ssnProjected,
    confidence,
    MODEL_VERSION,
    JSON.stringify(input),
    new Date()
  );

  return {
    ssnProjected,
    confidence,
    modelVersion: MODEL_VERSION,
    inputSnapshot: input,
    confidenceBreakdown: breakdown,
  };
}
