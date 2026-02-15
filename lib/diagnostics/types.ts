/**
 * Diagnostic Engine — Shared Types & Constants
 *
 * Central type definitions for the diagnostic pipeline:
 * statuses, definition packs, LLM output contracts, and scoring types.
 */

/** Pipeline status progression */
export const DiagnosticStatus = {
  RECEIVED: 'RECEIVED',
  VALIDATED: 'VALIDATED',
  SCORED: 'SCORED',
  GENERATING: 'GENERATING',
  ANALYZED: 'ANALYZED',
  FAILED: 'FAILED',
} as const;

export type DiagnosticStatusType = (typeof DiagnosticStatus)[keyof typeof DiagnosticStatus];

/** Error codes for pipeline failures */
export const DiagnosticErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SCORING_ERROR: 'SCORING_ERROR',
  OLLAMA_TIMEOUT: 'OLLAMA_TIMEOUT',
  OLLAMA_UNAVAILABLE: 'OLLAMA_UNAVAILABLE',
  OLLAMA_EMPTY_RESPONSE: 'OLLAMA_EMPTY_RESPONSE',
  RAG_UNAVAILABLE: 'RAG_UNAVAILABLE',
  RAG_TIMEOUT: 'RAG_TIMEOUT',
  DB_ERROR: 'DB_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type DiagnosticErrorCodeType = (typeof DiagnosticErrorCode)[keyof typeof DiagnosticErrorCode];

/**
 * Structured LLM output contract (V2).
 * The LLM must produce this JSON structure — validated by Zod after generation.
 */
export interface StructuredAnalysis {
  /** Top strengths identified from competency data */
  forces: AnalysisItem[];
  /** Top weaknesses / priority areas */
  faiblesses: AnalysisItem[];
  /** Personalized action plan */
  plan: PlanItem[];
  /** RAG-sourced resources and references */
  ressources: RessourceItem[];
  /** Quality flags for transparency */
  qualityFlags: QualityFlag[];
  /** RAG citation references */
  citations: Citation[];
}

export interface AnalysisItem {
  domain: string;
  label: string;
  detail: string;
  /** Evidence: score, verbatim quote, or data point */
  evidence?: string;
}

export interface PlanItem {
  week: number;
  objective: string;
  actions: string[];
  /** Measurable success indicator */
  indicator: string;
}

export interface RessourceItem {
  type: 'exercice' | 'methode' | 'fiche' | 'sujet0' | 'programme';
  label: string;
  source?: string;
  /** RAG chunk ID if from knowledge base */
  ragChunkId?: string;
}

export interface QualityFlag {
  code: string;
  message: string;
}

export interface Citation {
  index: number;
  source: string;
  chunkId?: string;
  excerpt: string;
}

/**
 * Scoring V2 — Three separate indices before aggregation
 */
export interface ScoringV2Result {
  /** Mastery on evaluated competencies (0-100) */
  masteryIndex: number;
  /** Coverage of the program (0-100) */
  coverageIndex: number;
  /** Exam readiness: automatisms + time + writing + stress (0-100) */
  examReadinessIndex: number;
  /** Derived weighted readiness score (0-100) */
  readinessScore: number;
  /** Derived risk index (0-100) */
  riskIndex: number;
  /** Decision */
  recommendation: 'Pallier2_confirmed' | 'Pallier2_conditional' | 'Pallier1_recommended';
  recommendationMessage: string;
  /** Justification for the decision (audit-friendly) */
  justification: string;
  /** What 2 conditions would upgrade to confirmed */
  upgradeConditions: string[];
  /** Per-domain breakdown */
  domainScores: DomainScoreV2[];
  /** Detected alerts */
  alerts: ScoringAlertV2[];
  /** Data quality assessment */
  dataQuality: DataQualityV2;
  /** TrustScore: how reliable is this bilan (0-100) */
  trustScore: number;
  /** Trust level for display: green/orange/red */
  trustLevel: 'green' | 'orange' | 'red';
  /** Computed pedagogical priorities */
  topPriorities: PriorityItem[];
  /** Quick wins: easy gains for automatisms */
  quickWins: PriorityItem[];
  /** High risk: blocking points requiring immediate attention */
  highRisk: PriorityItem[];
  /** Inconsistency flags detected in the data */
  inconsistencies: InconsistencyFlag[];
}

export interface DomainScoreV2 {
  domain: string;
  /** Mastery score on evaluated items (0-100) */
  score: number;
  evaluatedCount: number;
  totalCount: number;
  /** Items with status not_studied (excluded from mastery, counted in coverage) */
  notStudiedCount: number;
  /** Items with status unknown (penalizes data quality) */
  unknownCount: number;
  gaps: string[];
  dominantErrors: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ScoringAlertV2 {
  type: 'danger' | 'warning' | 'info';
  code: string;
  message: string;
  /** Impact description for Nexus report */
  impact?: string;
}

export interface DataQualityV2 {
  activeDomains: number;
  evaluatedCompetencies: number;
  notStudiedCompetencies: number;
  unknownCompetencies: number;
  lowConfidence: boolean;
  /** Overall quality: good | partial | insufficient */
  quality: 'good' | 'partial' | 'insufficient';
  /** Coherence issues count */
  coherenceIssues: number;
  /** Mini-test filled */
  miniTestFilled: boolean;
  /** Critical fields missing count */
  criticalFieldsMissing: number;
}

/** Computed priority item for bilan output */
export interface PriorityItem {
  skillId?: string;
  skillLabel: string;
  domain: string;
  reason: string;
  impact: string;
  exerciseType?: string;
}

/** Inconsistency flag for data quality audit */
export interface InconsistencyFlag {
  code: string;
  message: string;
  fields: string[];
  severity: 'warning' | 'error';
}

/**
 * DiagnosticDefinition — Declares a questionnaire type (versionned).
 * One definition = one track + level + stage combination.
 */
export interface DiagnosticDefinition {
  /** Unique key: e.g. "maths-premiere-p2" */
  key: string;
  /** Semantic version: e.g. "v1.3" */
  version: string;
  /** Display name */
  label: string;
  /** Subject track */
  track: 'maths' | 'nsi' | 'physique';
  /** School level */
  level: 'premiere' | 'terminale';
  /** Stage type */
  stage: 'pallier1' | 'pallier2';
  /** Skill registry: domains → skills */
  skills: Record<string, SkillDefinition[]>;
  /** Scoring policy: domain weights + thresholds */
  scoringPolicy: ScoringPolicy;
  /** Prompt templates per audience + version */
  prompts: PromptDefinition;
  /** RAG policy: collections, query strategy */
  ragPolicy: RAGPolicy;
  /** Risk model: discipline-specific risk factors (CdC V2 §2.2) */
  riskModel?: RiskModel;
  /** Exam format: timer, rules, structure (CdC V2 §5.2) */
  examFormat?: ExamFormat;
}

export interface SkillDefinition {
  skillId: string;
  label: string;
  domain: string;
  /** Prerequisite skill IDs */
  prerequisites?: string[];
}

export interface ScoringPolicy {
  domainWeights: Record<string, number>;
  thresholds: {
    confirmed: { readiness: number; risk: number };
    conditional: { readiness: number; risk: number };
  };
}

export interface PromptDefinition {
  version: string;
  eleve: string;
  parents: string;
  nexus: string;
}

export interface RAGPolicy {
  collections: string[];
  maxQueries: number;
  topK: number;
}

/** Risk model: discipline-specific risk factors */
export interface RiskModel {
  factors: string[];
  /** Discipline-specific risk weights (factor → weight 0-1) */
  weights?: Record<string, number>;
}

/** Exam format: structure and rules for the target exam */
export interface ExamFormat {
  /** Duration in minutes */
  duration: number;
  /** Whether calculator is allowed */
  calculatorAllowed: boolean;
  /** Description of the exam structure */
  structure: string;
  /** Total points */
  totalPoints: number;
}
