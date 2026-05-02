import { z } from 'zod';

export const COACH_MATHS_META = {
  version: '1.0.0',
  subject: 'MATHEMATIQUES',
  gradeLevel: 'PREMIERE',
  stage: 'printemps',
};

// Sub-schemas
export const attendanceAndEngagementSchema = z.object({
  attendance: z.enum(['excellente', 'reguliere', 'irreguliere', 'insuffisante']).optional(),
  punctuality: z.enum(['tres-satisfaisante', 'satisfaisante', 'a-ameliorer']).optional(),
  involvement: z.number().min(1).max(5).optional(),
  concentration: z.number().min(1).max(5).optional(),
  coachComment: z.string().optional(),
});

export const automatismesSchema = z.object({
  calculationFluency: z.number().min(1).max(5).optional(),
  identities: z.number().min(1).max(5).optional(),
  linearEquation: z.number().min(1).max(5).optional(),
  derivatives: z.number().min(1).max(5).optional(),
  strongestAutomation: z.string().optional(),
  weakestAutomation: z.string().optional(),
});

export const analysisSchema = z.object({
  productDerivative: z.number().min(1).max(5).optional(),
  quotientDerivative: z.number().min(1).max(5).optional(),
  variationTable: z.number().min(1).max(5).optional(),
  exponentialPositivity: z.number().min(1).max(5).optional(),
});

export const sequencesSchema = z.object({
  explicitFormula: z.number().min(1).max(5).optional(),
  auxiliarySequence: z.number().min(1).max(5).optional(),
  sums: z.number().min(1).max(5).optional(),
  progressReflection: z.string().optional(),
});

export const scalarProductSchema = z.object({
  coordinates: z.number().min(1).max(5).optional(),
  alKashi: z.number().min(1).max(5).optional(),
});

export const probabilitiesSchema = z.object({
  weightedTree: z.number().min(1).max(5).optional(),
  totalProbability: z.number().min(1).max(5).optional(),
  bayes: z.number().min(1).max(5).optional(),
  independenceVsIncompatibility: z.number().min(1).max(5).optional(),
  conditionalProbabilityFormula: z.number().min(1).max(5).optional(),
});

// Enhanced Final Assessment schema (P0 restructuring)
export const finalAssessmentSchema = z.object({
  // Legacy fields (kept for retrocompatibility)
  timeManagement: z.number().min(1).max(5).optional(),
  writtenClarity: z.number().min(1).max(5).optional(),
  adviceForNextAssessment: z.string().optional(),

  // New structured fields (P0)
  finalTestDone: z.enum(['NOT_DONE', 'PARTIAL', 'DONE']).optional(),
  approximateScore: z.number().min(0).max(20).optional(),
  instructionUnderstanding: z.number().min(1).max(5).optional(),
  writtenJustification: z.number().min(1).max(5).optional(),
  methodSelection: z.number().min(1).max(5).optional(),
  resilience: z.number().min(1).max(5).optional(),
  mostAvoidableMistake: z.string().max(250).optional(),
  strongestFinalTestPoint: z.string().max(250).optional(),
  priorityBeforeExam: z.string().max(250).optional(),
});

// Guided parent message schema (P0 restructuring)
// parentSummaryMessage kept for retrocompatibility but no longer primary
export const parentRecommendationsSchema = z.object({
  // Legacy fields (kept for retrocompatibility)
  estimatedCurrentLevel: z.enum(['tres-solide', 'satisfaisant', 'fragile-mais-en-progres', 'fragile', 'preoccupant']).optional(),
  recommendedFollowUp: z.enum(['autonomie-sufficient', 'consolidation-ponctuelle', 'accompagnement-regulier', 'entrainement-intensif']).optional(),
  priorityAxes: z.array(z.string()).max(6).optional(), // Limited to 6, display max 3
  parentSummaryMessage: z.string().optional(), // Kept but treated as secondary note

  // New guided fields (P0)
  parentTone: z.enum(['REASSURING', 'BALANCED', 'FIRM_BUT_SUPPORTIVE']).optional(),
  parentUrgency: z.enum(['NORMAL', 'WATCH', 'IMPORTANT', 'PRIORITY']).optional(),
  parentMainMessage: z.string().max(300).optional(),
  parentDoNotSay: z.string().max(200).optional(),
});

// Chapter diagnostic item schema (P0 restructuring)
export const chapterDiagnosticSchema = z.object({
  mastery: z.number().min(1).max(5).optional(),
  methodsAcquired: z.array(z.string().max(100)).max(10).optional(),
  vigilancePoints: z.array(z.string().max(100)).max(10).optional(),
  recurringErrors: z.array(z.string().max(100)).max(10).optional(),
  revealingExercise: z.string().max(250).optional(),
  strength: z.string().max(250).optional(),
  priorityRemediation: z.string().max(250).optional(),
});

// Global diagnostic schema (P0 restructuring)
export const globalDiagnosticSchema = z.object({
  overallProfile: z.enum(['RAPID_PROGRESS', 'STEADY_PROGRESS', 'UNEVEN_PROGRESS', 'FRAGILE_BUT_MOTIVATED', 'FRAGILE_AND_DISCOURAGED']).optional(),
  workPace: z.enum(['FAST_AND_ACCURATE', 'FAST_BUT_CARELESS', 'SLOW_BUT_ACCURATE', 'SLOW_AND_UNCERTAIN', 'IRREGULAR']).optional(),
  errorManagement: z.enum(['SELF_CORRECTING', 'ACCEPTS_HELP', 'IGNORES_ERRORS', 'REPEATS_ERRORS', 'ANXIOUS_ABOUT_MISTAKES']).optional(),
  autonomyLevel: z.enum(['FULLY_AUTONOMOUS', 'NEEDS_PROMPTS', 'NEEDS_GUIDANCE', 'DEPENDENT', 'AVOIDS_EFFORT']).optional(),
  confidenceLevel: z.enum(['OVER_CONFIDENT', 'CONFIDENT', 'HESITANT', 'LACKS_CONFIDENCE', 'ANXIOUS']).optional(),
  mainCoachMessage: z.string().max(300).optional(),
});

// Chapter diagnostics collection (P0 restructuring)
export const chapterDiagnosticsSchema = z.object({
  secondDegree: chapterDiagnosticSchema.optional(),
  derivation: chapterDiagnosticSchema.optional(),
  sequences: chapterDiagnosticSchema.optional(),
  exponential: chapterDiagnosticSchema.optional(),
  scalarProduct: chapterDiagnosticSchema.optional(),
  probabilities: chapterDiagnosticSchema.optional(),
});

// Full Bilan form schema (extended P0)
export const coachMathsBilanSchema = z.object({
  action: z.enum(['draft', 'complete']),
  // Legacy sections (kept for retrocompatibility)
  attendanceAndEngagement: attendanceAndEngagementSchema.optional(),
  automatismes: automatismesSchema.optional(),
  analysis: analysisSchema.optional(),
  sequences: sequencesSchema.optional(),
  scalarProduct: scalarProductSchema.optional(),
  probabilities: probabilitiesSchema.optional(),
  finalAssessment: finalAssessmentSchema.optional(),
  parentRecommendations: parentRecommendationsSchema.optional(),

  // New structured sections (P0)
  globalDiagnostic: globalDiagnosticSchema.optional(),
  chapterDiagnostics: chapterDiagnosticsSchema.optional(),
});

export type CoachMathsBilanFormData = z.infer<typeof coachMathsBilanSchema>;
export type AttendanceAndEngagement = z.infer<typeof attendanceAndEngagementSchema>;
export type Automatismes = z.infer<typeof automatismesSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type Sequences = z.infer<typeof sequencesSchema>;
export type ScalarProduct = z.infer<typeof scalarProductSchema>;
export type Probabilities = z.infer<typeof probabilitiesSchema>;
export type FinalAssessment = z.infer<typeof finalAssessmentSchema>;
export type ParentRecommendations = z.infer<typeof parentRecommendationsSchema>;

// Type exports for new schemas
export type ChapterDiagnostic = z.infer<typeof chapterDiagnosticSchema>;
export type GlobalDiagnostic = z.infer<typeof globalDiagnosticSchema>;
export type ChapterDiagnostics = z.infer<typeof chapterDiagnosticsSchema>;

export type CoachMathsSourceData = {
  meta: Record<string, unknown>;
  // Legacy sections (optional for retrocompatibility)
  attendanceAndEngagement?: AttendanceAndEngagement;
  automatismes?: Automatismes;
  analysis?: Analysis;
  sequences?: Sequences;
  scalarProduct?: ScalarProduct;
  probabilities?: Probabilities;
  finalAssessment?: FinalAssessment;
  parentRecommendations?: ParentRecommendations;

  // New structured sections (P0)
  globalDiagnostic?: GlobalDiagnostic;
  chapterDiagnostics?: ChapterDiagnostics;
};
