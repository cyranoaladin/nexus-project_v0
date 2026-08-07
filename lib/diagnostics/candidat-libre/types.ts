export const DIAGNOSTIC_KEY = 'BAC_GENERAL_CANDIDAT_INDIVIDUEL_2027' as const;
export const DIAGNOSTIC_VERSION = '2026.08.05-v1' as const;

export type DiagnosticAudience = 'ELEVE' | 'PARENT';

export type DiagnosticQuestionType =
  | 'single'
  | 'multiple'
  | 'numeric'
  | 'short'
  | 'long'
  | 'scale'
  | 'acknowledgement'
  | 'upload'
  | 'information';

export type DiagnosticModuleKind =
  | 'questionnaire'
  | 'academic'
  | 'oral'
  | 'documents'
  | 'learning-potential'
  | 'review';

export type DiagnosticModuleStatus =
  | 'LOCKED'
  | 'AVAILABLE'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'AUTO_SCORED'
  | 'NEEDS_REVIEW'
  | 'REVIEWED';

export type DiagnosticCampaignStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'WAITING_PARENT'
  | 'WAITING_RETENTION'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'REVIEWED'
  | 'CLOSED'
  | 'CANCELLED';

export interface DiagnosticOption {
  id: string;
  label: string;
}

export interface DiagnosticUploadRule {
  category:
    | 'IDENTITY'
    | 'CYCLADES'
    | 'FRENCH_BAC_TRANSCRIPT'
    | 'TUNISIAN_BAC_TRANSCRIPT'
    | 'SCHOOL_REPORT'
    | 'EXAM_ACCOMMODATION'
    | 'WRITTEN_COPY'
    | 'ORAL_RECORDING'
    | 'OTHER';
  accept: string[];
  maxFiles: number;
  maxBytesPerFile: number;
  required: boolean;
  help?: string;
}

export interface DiagnosticQuestion {
  id: string;
  type: DiagnosticQuestionType;
  prompt: string;
  description?: string;
  instruction?: string;
  options?: DiagnosticOption[];
  min?: number;
  max?: number;
  step?: number;
  leftLabel?: string;
  rightLabel?: string;
  placeholder?: string;
  required?: boolean;
  allowNotStudied?: boolean;
  competencies: string[];
  domains: string[];
  maxPoints: number;
  manualReview?: boolean;
  uploadRule?: DiagnosticUploadRule;
  wordLimit?: number;
}

export interface DiagnosticModuleDefinition {
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  audience: DiagnosticAudience;
  kind: DiagnosticModuleKind;
  estimatedMinutes: number;
  timed: boolean;
  prerequisites: string[];
  unlockDelayHours?: number;
  instructions: string[];
  questions: DiagnosticQuestion[];
  scoreDomains: string[];
  requiredForSubmission: boolean;
}

export type DiagnosticAnswerValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export interface DiagnosticAnswer {
  questionId: string;
  value: DiagnosticAnswerValue;
  status?: 'ANSWERED' | 'NOT_STUDIED' | 'SKIPPED';
  confidence?: 0 | 1 | 2 | 3;
  answeredAt?: string;
}

export interface DiagnosticModuleDraft {
  moduleKey: string;
  answers: Record<string, DiagnosticAnswer>;
  currentQuestionIndex: number;
  elapsedMs: number;
  integrity: {
    accepted: boolean;
    focusLossCount: number;
    fullscreenExitCount: number;
    copyPasteCount: number;
    userAgent?: string;
  };
}

export interface QuestionScoreEvidence {
  questionId: string;
  points: number;
  maxPoints: number;
  status: 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'NOT_STUDIED' | 'MANUAL_REVIEW';
  domains: string[];
  competencies: string[];
  confidence?: number;
}

export interface DiagnosticAutoScore {
  points: number;
  maxPoints: number;
  percentage: number | null;
  coveragePercentage: number;
  domainScores: Record<string, {
    points: number;
    maxPoints: number;
    percentage: number | null;
  }>;
  evidence: QuestionScoreEvidence[];
  manualReviewQuestionIds: string[];
  confidenceCalibration: {
    answeredWithConfidence: number;
    overconfidenceCount: number;
    underconfidenceCount: number;
  };
}

export interface DiagnosticDocumentView {
  id: string;
  category: DiagnosticUploadRule['category'];
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'UPLOADED' | 'ACCEPTED' | 'REJECTED' | 'NEEDS_REPLACEMENT';
  reviewNote?: string | null;
  createdAt: string;
  downloadUrl?: string;
}

export interface DiagnosticModuleView {
  key: string;
  status: DiagnosticModuleStatus;
  progress: number;
  startedAt?: string | null;
  submittedAt?: string | null;
  availableAt?: string | null;
  elapsedMs?: number;
  autoScore?: DiagnosticAutoScore | null;
  reviewSummary?: string | null;
}

export interface DiagnosticCampaignView {
  id: string;
  diagnosticKey: string;
  definitionVersion: string;
  status: DiagnosticCampaignStatus;
  targetSession: number;
  student: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    school: string | null;
    gradeLevel: string;
  };
  modules: DiagnosticModuleView[];
  documents: DiagnosticDocumentView[];
  completionPercentage: number;
  studentConsentAt?: string | null;
  parentConsentAt?: string | null;
  submittedAt?: string | null;
  retentionDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleSubmissionResponse {
  success: true;
  module: DiagnosticModuleView;
  unlockedModuleKeys: string[];
  campaignStatus: DiagnosticCampaignStatus;
}
