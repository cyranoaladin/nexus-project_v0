export const LIFECYCLE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'SCORING_FAILED',
  'SCORED',
  'REPORT_GENERATION_FAILED',
  'REPORT_PENDING_REVIEW',
  'COACH_VALIDATED',
  'COACH_REJECTED',
  'PUBLISHED',
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const LIFECYCLE_ACTORS = ['STUDENT', 'PARENT', 'COACH', 'WORKER'] as const;
export type LifecycleActor = (typeof LIFECYCLE_ACTORS)[number];

export const TRANSITION_ACTIONS = [
  'SUBMIT',
  'SCORE',
  'MARK_SCORING_FAILED',
  'RETRY_SCORING',
  'CREATE_REPORT',
  'MARK_REPORT_GENERATION_FAILED',
  'RETRY_REPORT_GENERATION',
  'VALIDATE_REPORT',
  'REJECT_REPORT',
  'REQUEST_REGENERATION',
  'REGENERATE_REPORT',
  'PUBLISH_REPORT',
] as const;
export type TransitionAction = (typeof TRANSITION_ACTIONS)[number];

export type LifecycleTransition = Readonly<{
  from: LifecycleStatus;
  action: TransitionAction;
  actor: LifecycleActor;
  to: LifecycleStatus;
}>;

export const BILAN_ERROR_CODES = [
  'BILAN_VALIDATION_ERROR',
  'BILAN_INVALID_TRANSITION',
  'BILAN_INVALID_ACTOR',
  'BILAN_CATALOG_VERSION_MISMATCH',
  'BILAN_INVALID_REPORT_REVISION',
  'BILAN_REPORT_NOT_VALIDATED',
  'BILAN_NOTIFICATION_NOT_SUPPORTED',
] as const;
export type BilanErrorCode = (typeof BILAN_ERROR_CODES)[number];

export type CatalogSubject =
  | 'MATHEMATIQUES'
  | 'PHYSIQUE_CHIMIE'
  | 'NSI'
  | 'FRANCAIS'
  | 'SVT'
  | 'SES';
export type SchoolLevel = 'SECONDE' | 'PREMIERE' | 'TERMINALE';
export type EvidenceStatus = 'MASTERED' | 'IN_PROGRESS' | 'NOT_ACQUIRED';
export type NotificationType = 'QUESTIONNAIRE_SUBMITTED' | 'BILAN_GENERATED' | 'BILAN_PUBLISHED';
export type NotificationChannel = 'WHATSAPP';

export type CatalogRef = Readonly<{
  id: string;
  subject: CatalogSubject;
  level: SchoolLevel;
  version: string;
}>;

export type AttemptSubmission = Readonly<{
  attemptId: string;
  catalog: CatalogRef;
  answers: ReadonlyArray<Readonly<{ questionId: string; answer: string | number | boolean | null }>>;
  submittedAt: string;
}>;

export type ScoreSnapshot = Readonly<{
  attemptId: string;
  algorithmVersion: string;
  totalScore: number;
  maxScore: number;
  scoredAt: string;
}>;

export type EvidenceItem = Readonly<{
  skillId: string;
  status: EvidenceStatus;
  rationale: string;
}>;

export type ReportRevision = Readonly<{
  id: string;
  attemptId: string;
  revision: number;
  status: Extract<LifecycleStatus, 'REPORT_PENDING_REVIEW' | 'COACH_VALIDATED' | 'COACH_REJECTED' | 'PUBLISHED'>;
  generatedAt: string;
  validatedAt?: string;
  evidence: ReadonlyArray<EvidenceItem>;
}>;

export type ReportRegeneration = Readonly<{
  previousRevision: ReportRevision;
  nextRevision: ReportRevision;
}>;

export type NotificationEvent = Readonly<{
  id: string;
  type: NotificationType;
  recipientRole: Extract<LifecycleActor, 'STUDENT' | 'PARENT' | 'COACH'>;
  channel: NotificationChannel;
  occurredAt: string;
}>;
