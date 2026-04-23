/**
 * F49: Canonical Bilan Types
 * Unified type definitions for all bilan sources (Diagnostic, Assessment, StageBilan)
 */

// ============================================================================
// Enums (mirrored from Prisma schema)
// ============================================================================

export enum BilanType {
  DIAGNOSTIC_PRE_STAGE = 'DIAGNOSTIC_PRE_STAGE', // Legacy Diagnostic (Pallier 2)
  ASSESSMENT_QCM = 'ASSESSMENT_QCM',             // Legacy Assessment (QCM)
  STAGE_POST = 'STAGE_POST',                     // Legacy StageBilan (coach)
  CONTINUOUS = 'CONTINUOUS',                     // Maths 1ère BilanView
}

export enum BilanStatus {
  PENDING = 'PENDING',
  SCORING = 'SCORING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ============================================================================
// Core Data Structures
// ============================================================================

export interface DomainScore {
  domain: string; // e.g., "analysis", "algebra", "prob_stats", "geometry"
  score: number;  // 0-100
}

export interface BilanScores {
  global: number;         // 0-100
  confidence?: number;    // 0-100 (self-awareness index)
  ssn?: number;          // Score Standardisé Nexus (z-score 0-100)
  uai?: number;          // Unified Academic Index (multi-discipline)
  domains: DomainScore[];
}

export interface BilanRenders {
  student: string; // Markdown: bienveillant, tutoiement
  parents: string; // Markdown: professionnel, vouvoiement
  nexus: string;   // Markdown: technique, factuel
}

export interface BilanAnalysis {
  forces: string[];
  faiblesses: string[];
  plan: string[];
  ressources?: string[];
  qualityFlags?: string[];
}

// ============================================================================
// Source Data Unions (type-specific raw inputs)
// ============================================================================

export interface DiagnosticSourceData {
  version: string;
  submittedAt: string;
  identity: {
    firstName: string;
    lastName: string;
    email: string;
  };
  schoolContext: {
    establishment?: string;
    mathTrack?: string;
  };
  performance: {
    mathAverage?: string;
    generalAverage?: string;
    classRanking?: string;
  };
  competencies: Record<string, unknown>;
  examPrep: Record<string, unknown>;
  miniTest?: {
    score: number;
    completedInTime: boolean;
    timeUsedMinutes: number;
  };
}

export interface AssessmentSourceData {
  answers: Record<string, string>; // questionId -> optionId
  duration?: number;
  startedAt?: string;
  completedAt?: string;
  questionBankId: string;
}

export interface StageBilanSourceData {
  scoreGlobal: number;
  domainScores: Record<string, number>;
  strengths: string[];
  areasForGrowth: string[];
  nextSteps?: string;
}

export type BilanSourceData = DiagnosticSourceData | AssessmentSourceData | StageBilanSourceData | Record<string, unknown>;

// ============================================================================
// Canonical Bilan Interface
// ============================================================================

export interface Bilan {
  id: string;
  publicShareId: string;

  // Typology
  type: BilanType;
  subject: string; // MATHS, NSI, GENERAL, etc.

  // Legacy links (migration traceability)
  legacyDiagnosticId?: string;
  legacyAssessmentId?: string;
  legacyStageBilanId?: string;

  // Source data
  sourceData?: BilanSourceData;

  // Student info
  studentId?: string;
  studentEmail: string;
  studentName: string;
  studentPhone?: string;

  // Relations
  stageId?: string;
  coachId?: string;

  // Scores
  globalScore?: number;
  confidenceIndex?: number;
  ssn?: number;
  uai?: number;
  domainScores?: DomainScore[];

  // Renders (tri-destinataire)
  studentMarkdown?: string;
  parentsMarkdown?: string;
  nexusMarkdown?: string;

  // Analysis
  analysis?: BilanAnalysis;
  analysisJson?: Record<string, unknown>;

  // Lifecycle
  status: BilanStatus;
  progress: number; // 0-100
  isPublished: boolean;
  publishedAt?: Date | string;

  // Error tracking
  errorCode?: string;
  errorDetails?: string;
  retryCount: number;

  // Versioning
  sourceVersion?: string;
  engineVersion?: string;
  ragUsed: boolean;
  ragCollections: string[];

  // Timestamps
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// API Payloads
// ============================================================================

export interface CreateBilanInput {
  type: BilanType;
  subject: string;
  studentEmail: string;
  studentName: string;
  studentPhone?: string;
  studentId?: string;
  sourceData?: BilanSourceData;
  stageId?: string;
  coachId?: string;
}

export interface UpdateBilanInput {
  status?: BilanStatus;
  progress?: number;
  globalScore?: number;
  confidenceIndex?: number;
  ssn?: number;
  uai?: number;
  domainScores?: DomainScore[];
  studentMarkdown?: string;
  parentsMarkdown?: string;
  nexusMarkdown?: string;
  analysisJson?: Record<string, unknown>;
  isPublished?: boolean;
  errorCode?: string;
  errorDetails?: string;
  retryCount?: number;
  sourceVersion?: string;
  engineVersion?: string;
  ragUsed?: boolean;
  ragCollections?: string[];
}

export interface BilanFilter {
  type?: BilanType;
  status?: BilanStatus;
  subject?: string;
  studentId?: string;
  stageId?: string;
  coachId?: string;
  isPublished?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

// ============================================================================
// Migration Types
// ============================================================================

export interface MigrationResult {
  source: 'Diagnostic' | 'Assessment' | 'StageBilan';
  sourceId: string;
  bilanId: string;
  success: boolean;
  error?: string;
}

export interface MigrationReport {
  total: number;
  succeeded: number;
  failed: number;
  results: MigrationResult[];
  dryRun: boolean;
}
