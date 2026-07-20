/**
 * Canonical AssessmentDefinition Contract — Lot 4
 *
 * This module defines the unified contract that links:
 * - A CurriculumContext (versioned, resolved from the registry)
 * - A skill/domain taxonomy (chapters, skills, scoring policy)
 * - Prompt templates per audience
 * - RAG policy
 * - Exam format and risk model
 *
 * All legacy DiagnosticDefinition objects must be adapted to this contract
 * via the LegacyDiagnosticAdapter before entering the canonical pipeline.
 *
 * Architecture principle:
 * - This contract is the single source of truth for diagnostic configuration.
 * - The LLM receives only a validated, minimised PromptContextPack.
 * - Scoring is deterministic and independent of LLM availability.
 */

import { z } from 'zod';
import {
  curriculumSubjectSchema,
  curriculumLevelSchema,
  curriculumTrackSchema,
  curriculumSubjectVariantSchema,
  academicYearSchema,
} from '@/lib/curriculum/schemas/curriculum';

// ─── Review status ───────────────────────────────────────────────────────────

export const definitionStatusSchema = z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']);
export type DefinitionStatus = z.infer<typeof definitionStatusSchema>;

// ─── Skill and domain taxonomy ───────────────────────────────────────────────

export const skillEntrySchema = z.object({
  skillId: z.string().min(1),
  label: z.string().min(1),
  domain: z.string().min(1),
  /** Chapter in the official programme */
  chapterId: z.string().optional(),
  /** Whether this skill is a prerequisite evaluated even if chapter not studied */
  prerequisite: z.boolean().optional(),
  /** Weight of the prerequisite in the readiness score */
  prerequisiteLevel: z.enum(['core', 'recommended']).optional(),
  /** Upstream skill IDs required before this skill */
  prerequisites: z.array(z.string()).optional(),
});

export type SkillEntry = z.infer<typeof skillEntrySchema>;

export const chapterEntrySchema = z.object({
  chapterId: z.string().min(1),
  chapterLabel: z.string().min(1),
  description: z.string(),
  domainId: z.string().min(1),
  skills: z.array(z.string()),
  /** RAG topics used to retrieve relevant resources for this chapter */
  ragTopics: z.array(z.string()).optional(),
});

export type ChapterEntry = z.infer<typeof chapterEntrySchema>;

// ─── Scoring policy ──────────────────────────────────────────────────────────

export const scoringThresholdSchema = z.object({
  readiness: z.number().min(0).max(100),
  risk: z.number().min(0).max(100),
});

export const scoringPolicySchema = z.object({
  /** Weight per domain (sum should be 1.0 but validated downstream, not here) */
  domainWeights: z.record(z.string(), z.number().min(0).max(1)),
  thresholds: z.object({
    confirmed: scoringThresholdSchema,
    conditional: scoringThresholdSchema,
  }),
});

export type ScoringPolicy = z.infer<typeof scoringPolicySchema>;

// ─── Prompt templates ────────────────────────────────────────────────────────

export const promptTemplatesSchema = z.object({
  /** Semantic version of the prompt set */
  version: z.string().min(1),
  /** Prompt for student audience (tutoiement, bienveillant) */
  eleve: z.string().min(1),
  /** Prompt for parent audience (vouvoiement, professionnel) */
  parents: z.string().min(1),
  /** Prompt for Nexus internal team (technique, factuel) */
  nexus: z.string().min(1),
});

export type PromptTemplates = z.infer<typeof promptTemplatesSchema>;

// ─── RAG policy ──────────────────────────────────────────────────────────────

export const ragPolicySchema = z.object({
  /** ChromaDB collection names to query */
  collections: z.array(z.string().min(1)),
  /** Maximum number of semantic queries per generation */
  maxQueries: z.number().int().positive(),
  /** Maximum number of chunks to retrieve per query */
  topK: z.number().int().positive(),
});

export type RAGPolicy = z.infer<typeof ragPolicySchema>;

// ─── Exam format ─────────────────────────────────────────────────────────────

export const examFormatSchema = z.object({
  /** Duration in minutes */
  duration: z.number().int().positive(),
  calculatorAllowed: z.boolean(),
  /** Human-readable description of the exam structure */
  structure: z.string(),
  totalPoints: z.number().positive(),
});

export type ExamFormat = z.infer<typeof examFormatSchema>;

// ─── Risk model ──────────────────────────────────────────────────────────────

export const riskModelSchema = z.object({
  /** Named risk factors for this diagnostic (used in alerts and reports) */
  factors: z.array(z.string().min(1)),
  /** Optional weighting per risk factor */
  weights: z.record(z.string(), z.number().min(0).max(1)).optional(),
});

export type RiskModel = z.infer<typeof riskModelSchema>;

// ─── Curriculum binding ──────────────────────────────────────────────────────

/**
 * CurriculumBinding links a definition to the exact curriculum versions
 * that were resolved at definition creation time.
 * These IDs must exist in the CURRICULUM_REGISTRY.
 */
export const curriculumBindingSchema = z.object({
  /** CurriculumVersion.id for the prerequisite programme (student's prior year) */
  prerequisiteCurriculumId: z.string().min(1),
  /** CurriculumVersion.id for the target programme (student's upcoming year) */
  targetCurriculumId: z.string().min(1),
  /** Academic year this definition targets, e.g. "2026-2027" */
  academicYear: academicYearSchema,
  /** Canonical subject from the curriculum registry */
  subject: curriculumSubjectSchema,
  /** Grade level the student is entering */
  targetLevel: curriculumLevelSchema,
  /** Grade level the student is leaving */
  currentLevel: curriculumLevelSchema,
  /** Academic track */
  track: curriculumTrackSchema,
  /** Subject variant */
  subjectVariant: curriculumSubjectVariantSchema,
  /** Optional exam session year (e.g., 2027 for BAC) */
  examSession: z.number().int().min(2000).max(2200).optional(),
});

export type CurriculumBinding = z.infer<typeof curriculumBindingSchema>;

// ─── Canonical AssessmentDefinition ──────────────────────────────────────────

/**
 * AssessmentDefinition — The canonical contract for a diagnostic assessment.
 *
 * This is the single source of truth for a diagnostic configuration.
 * All engines (scoring, report generation, RAG) consume this contract.
 *
 * Key constraints:
 * - `curriculumBinding` ties the definition to versioned official programmes.
 * - `status` must be PUBLISHED before the definition enters the live catalog.
 * - Prompt templates are immutable once PUBLISHED; update `version` for changes.
 * - Skills are organised by domain; each domain must appear in `scoringPolicy.domainWeights`.
 */
export const assessmentDefinitionSchema = z.object({
  /** Unique key, e.g. "maths-premiere-p2-2026" */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),

  /** Semantic version, e.g. "v2.0" */
  version: z.string().min(1),

  /** Human-readable label */
  label: z.string().min(1),

  /** Review/lifecycle status */
  status: definitionStatusSchema,

  /** Link to versioned curriculum programmes */
  curriculumBinding: curriculumBindingSchema,

  /**
   * Skills organised by domain ID.
   * Each domain ID must also appear in scoringPolicy.domainWeights.
   */
  skills: z.record(z.string(), z.array(skillEntrySchema)),

  /** Official programme chapters (optional enrichment for RAG and chapter-aware scoring) */
  chapters: z.array(chapterEntrySchema).optional(),

  /** Domain weights and recommendation thresholds */
  scoringPolicy: scoringPolicySchema,

  /** Prompt templates per audience */
  prompts: promptTemplatesSchema,

  /** RAG retrieval policy */
  ragPolicy: ragPolicySchema,

  /** Target exam format (for readiness and timing scoring) */
  examFormat: examFormatSchema.optional(),

  /** Risk factors specific to this diagnostic */
  riskModel: riskModelSchema.optional(),
}).superRefine((def, ctx) => {
  // Ensure all domain IDs in skills are present in scoringPolicy.domainWeights
  const weightedDomains = new Set(Object.keys(def.scoringPolicy.domainWeights));
  for (const domainId of Object.keys(def.skills)) {
    if (!weightedDomains.has(domainId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['skills', domainId],
        message: `Domain "${domainId}" has skills but is missing from scoringPolicy.domainWeights`,
      });
    }
  }
  // Ensure all weighted domains have at least one skill entry
  for (const domainId of weightedDomains) {
    if (!def.skills[domainId] || def.skills[domainId].length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scoringPolicy', 'domainWeights', domainId],
        message: `Domain "${domainId}" is weighted but has no skills defined`,
      });
    }
  }
});

export type AssessmentDefinition = z.infer<typeof assessmentDefinitionSchema>;
