/**
 * Zod Schemas for Assessment JSON Fields
 *
 * These schemas validate the JSON data stored in Prisma `Json` columns:
 * - scoringResult: Complete scoring output from ScoringFactory
 * - answers: Student answer map (questionId → optionId)
 * - analysisJson: Structured LLM analysis output
 * - studentMetadata: Additional student context
 *
 * Usage: Always parse JSON fields through these schemas when reading from DB
 * to guarantee type safety at runtime.
 */

import { z } from 'zod';

// ─── Category Scores ────────────────────────────────────────────────────────

/** Maths category scores (all optional, 0-100) */
export const mathsCategoryScoresSchema = z.object({
  algebre: z.number().min(0).max(100).optional(),
  analyse: z.number().min(0).max(100).optional(),
  geometrie: z.number().min(0).max(100).optional(),
  combinatoire: z.number().min(0).max(100).optional(),
  logExp: z.number().min(0).max(100).optional(),
  probabilites: z.number().min(0).max(100).optional(),
});

/** NSI category scores (all optional, 0-100) */
export const nsiCategoryScoresSchema = z.object({
  python: z.number().min(0).max(100).optional(),
  poo: z.number().min(0).max(100).optional(),
  structures: z.number().min(0).max(100).optional(),
  algorithmique: z.number().min(0).max(100).optional(),
  sql: z.number().min(0).max(100).optional(),
  architecture: z.number().min(0).max(100).optional(),
});

// ─── Subject Metrics ────────────────────────────────────────────────────────

/** Maths-specific competency metrics */
export const mathsMetricsSchema = z.object({
  raisonnement: z.number().min(0).max(100),
  calcul: z.number().min(0).max(100),
  abstraction: z.number().min(0).max(100),
  categoryScores: mathsCategoryScoresSchema,
});

/** NSI-specific competency metrics */
export const nsiMetricsSchema = z.object({
  logique: z.number().min(0).max(100),
  syntaxe: z.number().min(0).max(100),
  optimisation: z.number().min(0).max(100),
  debuggage: z.number().min(0).max(100),
  categoryScores: nsiCategoryScoresSchema,
});

/** Union of subject metrics (discriminated by presence of subject-specific keys) */
export const subjectMetricsSchema = z.union([mathsMetricsSchema, nsiMetricsSchema]);

// ─── Scoring Result ─────────────────────────────────────────────────────────

/**
 * Universal scoring result schema.
 * Validates the `scoringResult` JSON column in the Assessment table.
 */
export const scoringResultSchema = z.object({
  globalScore: z.number().min(0).max(100),
  confidenceIndex: z.number().min(0).max(100),
  precisionIndex: z.number().min(0).max(100),
  metrics: subjectMetricsSchema,
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  diagnosticText: z.string(),
  lucidityText: z.string(),
  totalQuestions: z.number().int().nonnegative(),
  totalAttempted: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  totalNSP: z.number().int().nonnegative(),
  scoredAt: z.string(),
});

export type ScoringResultParsed = z.infer<typeof scoringResultSchema>;

// ─── Answers ────────────────────────────────────────────────────────────────

/**
 * Answers schema: questionId → optionId mapping.
 * Validates the `answers` JSON column.
 */
export const answersSchema = z.record(z.string(), z.string());

export type AnswersParsed = z.infer<typeof answersSchema>;

// ─── Analysis JSON ──────────────────────────────────────────────────────────

/**
 * Structured LLM analysis output schema.
 * Validates the `analysisJson` JSON column (nullable).
 */
export const analysisJsonSchema = z.object({
  studentAnalysis: z.string().optional(),
  parentsAnalysis: z.string().optional(),
  nexusAnalysis: z.string().optional(),
  generatedAt: z.string().optional(),
  modelUsed: z.string().optional(),
  ragContext: z.array(z.string()).optional(),
}).nullable();

export type AnalysisJsonParsed = z.infer<typeof analysisJsonSchema>;

// ─── Student Metadata ───────────────────────────────────────────────────────

/**
 * Additional student context schema.
 * Validates the `studentMetadata` JSON column (nullable).
 */
export const studentMetadataSchema = z.object({
  schoolYear: z.string().optional(),
  establishment: z.string().optional(),
  teacher: z.string().optional(),
}).nullable();

export type StudentMetadataParsed = z.infer<typeof studentMetadataSchema>;

// ─── Safe Parsers ───────────────────────────────────────────────────────────

/**
 * Safely parse a JSON field with a Zod schema.
 * Returns the parsed value or null if parsing fails.
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw JSON data from Prisma
 * @returns Parsed data or null
 */
export function safeParse<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[Assessment Schema] Validation failed:', result.error.flatten());
  }
  return null;
}
