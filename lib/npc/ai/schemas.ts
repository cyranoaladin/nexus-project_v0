// ═══════════════════════════════════════════════════════════════════════════════
// NPC AI - Zod Schemas for AI Response Validation
// Strict schemas for type-safe AI outputs
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ─── Diagnostic Schemas ───

export const StrengthSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(1000),
  evidence: z.string().min(10).max(500),
});

export type Strength = z.infer<typeof StrengthSchema>;

export const WeaknessSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(1000),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  evidence: z.string().min(10).max(500),
});

export type Weakness = z.infer<typeof WeaknessSchema>;

export const PedagogicalDiagnosticSchema = z.object({
  summary: z.string().min(50).max(2000),
  overallLevel: z.enum(['beginner', 'developing', 'proficient', 'advanced', 'expert']),
  confidenceScore: z.number().min(0).max(1),
  strengths: z.array(StrengthSchema).min(1).max(10),
  weaknesses: z.array(WeaknessSchema).min(1).max(15),
  keyRecommendations: z.array(z.string().min(10).max(500)).min(1).max(5),
});

export type PedagogicalDiagnostic = z.infer<typeof PedagogicalDiagnosticSchema>;

// ─── Competence Matrix Schemas ───

export const CompetenceItemSchema = z.object({
  name: z.string().min(1).max(100),
  score: z.number().min(0).max(100),
  maxScore: z.number().min(1).max(100),
  level: z.enum(['not_acquired', 'partially_acquired', 'acquired', 'mastered']),
  evidence: z.string().min(10).max(500),
  recommendations: z.array(z.string().min(5).max(300)).optional(),
});

export type CompetenceItem = z.infer<typeof CompetenceItemSchema>;

export const CompetenceBlockSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  items: z.array(CompetenceItemSchema).min(1),
});

export type CompetenceBlock = z.infer<typeof CompetenceBlockSchema>;

export const CompetenceMatrixSchema = z.object({
  blocks: z.array(CompetenceBlockSchema).min(1).max(10),
  globalScore: z.number().min(0).max(100),
  globalLevel: z.enum(['not_acquired', 'partially_acquired', 'acquired', 'mastered']),
  evaluatedAt: z.string().datetime().optional(),
});

export type CompetenceMatrix = z.infer<typeof CompetenceMatrixSchema>;

// ─── Remediation Roadmap Schemas ───

export const ResourceReferenceSchema = z.object({
  type: z.enum(['document', 'exercise', 'video', 'external', 'session']),
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  url: z.string().url().optional(),
});

export type ResourceReference = z.infer<typeof ResourceReferenceSchema>;

export const RoadmapTaskSchema = z.object({
  id: z.string().min(1).max(50),
  title: z.string().min(5).max(150),
  description: z.string().min(20).max(1000),
  order: z.number().int().min(0),
  type: z.enum(['knowledge_gap', 'skill_practice', 'method_learning', 'deep_dive', 'consolidation']),
  estimatedDuration: z.string().min(3).max(50),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  resources: z.array(ResourceReferenceSchema).min(0).max(10),
  prerequisiteTaskIds: z.array(z.string()).optional(),
  targetCompetences: z.array(z.string()).min(0).max(5),
});

export type RoadmapTask = z.infer<typeof RoadmapTaskSchema>;

export const RemediationRoadmapSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(50).max(1000),
  estimatedTotalDuration: z.string().min(3).max(50),
  recommendedPace: z.enum(['intensive', 'regular', 'relaxed']),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  tasks: z.array(RoadmapTaskSchema).min(1).max(20),
});

export type RemediationRoadmap = z.infer<typeof RemediationRoadmapSchema>;

// ─── Mentor Advice Schemas ───

export const MentorAdviceSchema = z.object({
  personalizedAdvice: z.string().min(100).max(2000),
  motivationMessage: z.string().min(50).max(1000),
  studyTips: z.array(z.string().min(10).max(300)).min(1).max(5),
  nextSteps: z.array(z.string().min(10).max(300)).min(1).max(5),
  encouragement: z.string().min(20).max(500),
});

export type MentorAdvice = z.infer<typeof MentorAdviceSchema>;

// ─── OCR Result Schema ───

export const OcrResultSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  detectedLanguage: z.string().min(2).max(5).optional(),
  hasMathematicalContent: z.boolean().optional(),
  hasDiagrams: z.boolean().optional(),
  pageCount: z.number().int().min(1).optional(),
});

export type OcrResult = z.infer<typeof OcrResultSchema>;

// ─── Validation Helpers ───

export function validateDiagnostic(data: unknown): {
  success: true;
  data: PedagogicalDiagnostic;
} | {
  success: false;
  errors: z.ZodError;
} {
  const result = PedagogicalDiagnosticSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error };
}

export function validateCompetenceMatrix(data: unknown): {
  success: true;
  data: CompetenceMatrix;
} | {
  success: false;
  errors: z.ZodError;
} {
  const result = CompetenceMatrixSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error };
}

export function validateRemediationRoadmap(data: unknown): {
  success: true;
  data: RemediationRoadmap;
} | {
  success: false;
  errors: z.ZodError;
} {
  const result = RemediationRoadmapSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error };
}

export function validateMentorAdvice(data: unknown): {
  success: true;
  data: MentorAdvice;
} | {
  success: false;
  errors: z.ZodError;
} {
  const result = MentorAdviceSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error };
}
