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
});

export const finalAssessmentSchema = z.object({
  timeManagement: z.number().min(1).max(5).optional(),
  writtenClarity: z.number().min(1).max(5).optional(),
  adviceForNextAssessment: z.string().optional(),
});

export const parentRecommendationsSchema = z.object({
  estimatedCurrentLevel: z.enum(['tres-solide', 'satisfaisant', 'fragile-mais-en-progres', 'fragile', 'preoccupant']).optional(),
  recommendedFollowUp: z.enum(['autonomie-sufficient', 'consolidation-ponctuelle', 'accompagnement-regulier', 'entrainement-intensif']).optional(),
  priorityAxes: z.array(z.string()).optional(),
  parentSummaryMessage: z.string().optional(),
});

// Full Bilan form schema
export const coachMathsBilanSchema = z.object({
  action: z.enum(['draft', 'complete']),
  attendanceAndEngagement: attendanceAndEngagementSchema.optional(),
  automatismes: automatismesSchema.optional(),
  analysis: analysisSchema.optional(),
  sequences: sequencesSchema.optional(),
  scalarProduct: scalarProductSchema.optional(),
  probabilities: probabilitiesSchema.optional(),
  finalAssessment: finalAssessmentSchema.optional(),
  parentRecommendations: parentRecommendationsSchema.optional(),
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

export type CoachMathsSourceData = {
  meta: Record<string, unknown>;
  attendanceAndEngagement: AttendanceAndEngagement;
  automatismes: Automatismes;
  analysis: Analysis;
  sequences: Sequences;
  scalarProduct: ScalarProduct;
  probabilities: Probabilities;
  finalAssessment: FinalAssessment;
  parentRecommendations: ParentRecommendations;
};
