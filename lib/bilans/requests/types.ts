export const ACCOUNT_VERIFICATION_STATES = [
  'UNVERIFIED',
  'VERIFICATION_PENDING',
  'VERIFIED',
] as const;

export type AccountVerificationState = (typeof ACCOUNT_VERIFICATION_STATES)[number];

export const BILAN_REQUEST_STATUSES = [
  'NEW',
  'READY_FOR_ASSESSMENT',
  'ASSESSMENT_IN_PROGRESS',
  'ASSESSMENT_SUBMITTED',
  'SCORED',
  'REVIEW_PENDING',
  'PUBLISHED',
  'HUMAN_FOLLOWUP_REQUIRED',
  'TECHNICAL_ACTION_REQUIRED',
  'CANCELLED',
] as const;

export type BilanRequestStatus = (typeof BILAN_REQUEST_STATUSES)[number];

export const BILAN_REQUEST_ACTORS = [
  'SYSTEM',
  'PARENT_FLOW',
  'WORKER',
  'ASSISTANTE',
  'COACH',
  'ADMIN',
] as const;

export type BilanRequestActor = (typeof BILAN_REQUEST_ACTORS)[number];

export const BILAN_REQUEST_EVENT_TYPES = [
  'REQUEST_CREATED',
  'ACCOUNT_VERIFICATION_REQUESTED',
  'ACCOUNT_VERIFIED',
  'CHILD_SELECTED',
  'CHILD_CREATED',
  'ASSESSMENT_STARTED',
  'ASSESSMENT_AUTOSAVE_CHECKPOINTED',
  'ASSESSMENT_SUBMITTED',
  'ASSESSMENT_SCORED',
  'ASSESSMENT_SCORING_FAILED',
  'REPORT_READY_FOR_REVIEW',
  'REPORT_APPROVED',
  'REPORT_REJECTED',
  'REPORT_PUBLISHED',
  'HUMAN_FOLLOWUP_REQUIRED',
  'TECHNICAL_ACTION_REQUIRED',
  'NOTIFICATION_DELIVERY_FAILED',
  'REQUEST_CANCELLED',
] as const;

export type BilanRequestEventType = (typeof BILAN_REQUEST_EVENT_TYPES)[number];

export type BilanRequestTransition = Readonly<{
  from: BilanRequestStatus;
  to: BilanRequestStatus;
  actor: BilanRequestActor;
}>;

export type BilanRequestEvent = Readonly<{
  id: string;
  requestId: string;
  type: BilanRequestEventType;
  actor: BilanRequestActor;
  occurredAt: string;
  correlationId: string;
  payload?: Readonly<Record<string, string | number | boolean | null>>;
}>;
