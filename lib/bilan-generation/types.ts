// ─────────────────────────────────────────────────────────────────────────────
// lib/bilan-generation/types.ts
// Generic types for the pedagogical bilan generation workflow.
// ─────────────────────────────────────────────────────────────────────────────

export const BILAN_KINDS = [
  'MATHS_PREMIERE_STAGE_PRINTEMPS',
  'EAF_STAGE_PRINTEMPS',
  'DIAGNOSTIC_MATHS_TERMINALE',
  'NPC_CORRECTION',
  'GENERIC_PEDAGOGICAL_REPORT',
] as const;

export type BilanKind = (typeof BILAN_KINDS)[number];

export type NormalizedChapter = {
  key: string;
  label: string;
  mastery?: number;
  acquiredMethods?: string[];
  vigilancePoints?: string[];
  recurringErrors?: string[];
  revealingExercise?: string;
  specificStrength?: string;
  priorityRemediation?: string;
};

export type NormalizedFinalAssessment = {
  completed?: boolean;
  approximateScore?: number;
  timeManagement?: number;
  instructionsUnderstanding?: number;
  writtenJustification?: number;
  methodChoice?: number;
  resilience?: number;
  mostAvoidableMistake?: string;
  strongestFinalTestPoint?: string;
  absolutePriority?: string;
};

export type NormalizedBilanInput = {
  bilanId: string;
  student: {
    id: string;
    firstName?: string;
    lastName?: string;
    displayName: string;
    gender?: 'male' | 'female' | 'unknown';
    gradeLevel?: string;
    track?: string;
  };
  context: {
    bilanKind: BilanKind;
    subject?: string;
    title?: string;
    durationHours?: number;
    periodLabel?: string;
    examTarget?: string;
  };
  coachInputs: {
    mainMessage?: string;
    doNotSay?: string;
    tone?: string;
    urgencyLevel?: string;
  };
  attendanceAndEngagement?: {
    attendance?: string;
    punctuality?: string;
    involvement?: number;
    concentration?: number;
    coachComment?: string;
  };
  competencies?: Record<string, unknown>;
  chapters?: NormalizedChapter[];
  finalAssessment?: NormalizedFinalAssessment;
  priorityAxes?: string[];
  legacySummary?: string;
  rawSourceData: unknown;
};

// ─────────────────────────────────────────────────────────────────────────────
// Pedagogical Profile — built by code, not by Mistral
// ─────────────────────────────────────────────────────────────────────────────

export type PedagogicalProfile = {
  executiveDiagnosis: {
    overallLevel: string;
    learningDynamic: string;
    mainRisk: string;
    mainLever: string;
  };
  keyStrengths: Array<{
    title: string;
    evidence: string;
    pedagogicalValue: string;
  }>;
  priorityWeaknesses: Array<{
    title: string;
    evidence: string;
    consequence: string;
    recommendedAction: string;
  }>;
  chapterPriorities: Array<{
    chapter: string;
    level: string;
    priority: 'high' | 'medium' | 'low';
    why: string;
    actionPlan: string;
  }>;
  finalAssessmentReading?: {
    score?: string;
    interpretation: string;
    warningPoints: string[];
    positiveSigns: string[];
  };
  parentGuidance: {
    tone: string;
    urgency: string;
    whatToAvoidSaying?: string;
    mainMessage?: string;
  };
  dataQuality: {
    missingImportantFields: string[];
    uncertaintyNotes: string[];
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Generation result
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationIssue =
  | 'EMPTY'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'MISSING_SECTIONS'
  | 'FORBIDDEN_TERM'
  | 'LEGACY_COPY'
  | 'NO_ACTIONABLE_ADVICE'
  | 'NO_STRENGTHS'
  | 'NO_WEAKNESSES'
  | 'SCORE_NOT_INTERPRETED'
  | 'VIOLATED_DO_NOT_SAY'
  | 'RAW_MARKDOWN_BOLD_TITLES';

export type QualityStatus = 'PASS' | 'WARN' | 'FAIL';

export type GenerationResult = {
  markdown: string;
  model: string;
  qualityStatus: QualityStatus;
  qualityIssues: ValidationIssue[];
  durationMs: number;
  workflowVersion: string;
};
