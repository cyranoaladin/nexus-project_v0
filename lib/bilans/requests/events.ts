import 'server-only';

import {
  BILAN_REQUEST_ACTORS,
  BILAN_REQUEST_EVENT_TYPES,
  type BilanRequestActor,
  type BilanRequestEventType,
} from '@/lib/bilans/requests/types';

type TechnicalCode = string;

export type MinimizedEventPayloads = Readonly<{
  REQUEST_CREATED: Readonly<{
    acquisitionChannelCode?: TechnicalCode;
    subjectCode?: TechnicalCode;
    gradeCode?: TechnicalCode;
  }>;
  ACCOUNT_VERIFICATION_REQUESTED: Readonly<{ deliveryChannelCode?: TechnicalCode }>;
  ACCOUNT_VERIFIED: Readonly<{ methodCode?: TechnicalCode }>;
  CHILD_SELECTED: Readonly<{ studentId?: TechnicalCode }>;
  CHILD_CREATED: Readonly<{ studentId?: TechnicalCode }>;
  ASSESSMENT_STARTED: Readonly<{
    attemptId?: TechnicalCode;
    assessmentPackId?: TechnicalCode;
    assessmentPackVersion?: TechnicalCode;
  }>;
  ASSESSMENT_AUTOSAVE_CHECKPOINTED: Readonly<{
    attemptId?: TechnicalCode;
    sequence?: number;
  }>;
  ASSESSMENT_SUBMITTED: Readonly<{
    attemptId?: TechnicalCode;
    responseCount?: number;
    durationMs?: number;
  }>;
  ASSESSMENT_SCORED: Readonly<{
    attemptId?: TechnicalCode;
    scoringVersion?: TechnicalCode;
    scoreBasisPoints?: number;
  }>;
  ASSESSMENT_SCORING_FAILED: Readonly<{
    attemptId?: TechnicalCode;
    errorCode?: TechnicalCode;
    retryCount?: number;
  }>;
  REPORT_READY_FOR_REVIEW: Readonly<{
    revisionId?: TechnicalCode;
    audienceCode?: TechnicalCode;
  }>;
  REPORT_APPROVED: Readonly<{
    revisionId?: TechnicalCode;
    reviewerId?: TechnicalCode;
  }>;
  REPORT_REJECTED: Readonly<{
    revisionId?: TechnicalCode;
    reviewerId?: TechnicalCode;
    reasonCode?: TechnicalCode;
  }>;
  REPORT_PUBLISHED: Readonly<{
    artifactId?: TechnicalCode;
    revisionId?: TechnicalCode;
    audienceCode?: TechnicalCode;
  }>;
  HUMAN_FOLLOWUP_REQUIRED: Readonly<{ reasonCode?: TechnicalCode }>;
  TECHNICAL_ACTION_REQUIRED: Readonly<{
    reasonCode?: TechnicalCode;
    errorCode?: TechnicalCode;
  }>;
  NOTIFICATION_DELIVERY_FAILED: Readonly<{
    deliveryChannelCode?: TechnicalCode;
    errorCode?: TechnicalCode;
    attemptCount?: number;
  }>;
  REQUEST_CANCELLED: Readonly<{ reasonCode?: TechnicalCode }>;
}>;

type EventInputFor<Type extends BilanRequestEventType> = Readonly<{
  requestId: string;
  type: Type;
  actor: BilanRequestActor;
  correlationId: string;
  payload?: MinimizedEventPayloads[Type];
}>;

export type AppendBilanRequestEventInput = {
  [Type in BilanRequestEventType]: EventInputFor<Type>;
}[BilanRequestEventType];

type EventCreateArguments = Readonly<{
  data: Readonly<{
    requestId: string;
    type: BilanRequestEventType;
    actor: BilanRequestActor;
    correlationId: string;
    payload: Readonly<Record<string, string | number>>;
    occurredAt: Date;
  }>;
}>;

export type BilanRequestEventClient = Readonly<{
  bilanRequestEvent: Readonly<{
    create: (arguments_: EventCreateArguments) => Promise<unknown>;
  }>;
}>;

const PAYLOAD_KEYS = {
  REQUEST_CREATED: ['acquisitionChannelCode', 'subjectCode', 'gradeCode'],
  ACCOUNT_VERIFICATION_REQUESTED: ['deliveryChannelCode'],
  ACCOUNT_VERIFIED: ['methodCode'],
  CHILD_SELECTED: ['studentId'],
  CHILD_CREATED: ['studentId'],
  ASSESSMENT_STARTED: ['attemptId', 'assessmentPackId', 'assessmentPackVersion'],
  ASSESSMENT_AUTOSAVE_CHECKPOINTED: ['attemptId', 'sequence'],
  ASSESSMENT_SUBMITTED: ['attemptId', 'responseCount', 'durationMs'],
  ASSESSMENT_SCORED: ['attemptId', 'scoringVersion', 'scoreBasisPoints'],
  ASSESSMENT_SCORING_FAILED: ['attemptId', 'errorCode', 'retryCount'],
  REPORT_READY_FOR_REVIEW: ['revisionId', 'audienceCode'],
  REPORT_APPROVED: ['revisionId', 'reviewerId'],
  REPORT_REJECTED: ['revisionId', 'reviewerId', 'reasonCode'],
  REPORT_PUBLISHED: ['artifactId', 'revisionId', 'audienceCode'],
  HUMAN_FOLLOWUP_REQUIRED: ['reasonCode'],
  TECHNICAL_ACTION_REQUIRED: ['reasonCode', 'errorCode'],
  NOTIFICATION_DELIVERY_FAILED: ['deliveryChannelCode', 'errorCode', 'attemptCount'],
  REQUEST_CANCELLED: ['reasonCode'],
} as const satisfies Record<BilanRequestEventType, readonly string[]>;

const ACQUISITION_CODES = new Set([
  'WEBSITE',
  'WHATSAPP',
  'PHONE',
  'EMAIL',
  'REFERRAL',
  'CAMPAIGN',
  'OTHER',
]);

const SUBJECT_CODES = new Set([
  'MATHEMATIQUES',
  'NSI',
  'FRANCAIS',
  'PHILOSOPHIE',
  'HISTOIRE_GEO',
  'ANGLAIS',
  'ESPAGNOL',
  'PHYSIQUE_CHIMIE',
  'SVT',
  'SES',
]);

const GRADE_CODES = new Set([
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE',
  'POSTBAC',
  'AUTRE',
]);

const DELIVERY_CHANNEL_CODES = new Set(['EMAIL', 'WHATSAPP']);
const VERIFICATION_METHOD_CODES = new Set(['MAGIC_LINK', 'EXISTING_SESSION']);
const AUDIENCE_CODES = new Set(['STUDENT', 'PARENT', 'NEXUS']);
const REASON_CODES = new Set([
  'NO_PUBLISHED_PACK',
  'MANUAL_REVIEW_REQUIRED',
  'RETRY_EXHAUSTED',
  'REQUESTED_BY_FAMILY',
  'REQUESTED_BY_TEAM',
  'INVALID_ASSESSMENT',
  'OPERATIONAL_FOLLOWUP',
]);
const ERROR_CODES = new Set([
  'SCORING_FAILED',
  'REPORT_GENERATION_FAILED',
  'NOTIFICATION_FAILED',
  'RATE_LIMIT_UNAVAILABLE',
  'INVALID_SUBMISSION',
  'PROVIDER_UNAVAILABLE',
]);

const UUID_IDENTIFIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CUID_V1_IDENTIFIER = /^c[a-z0-9]{24}$/;
const CUID_V2_IDENTIFIER = /^[a-z][a-z0-9]{23}$/;
const CORRELATION_IDENTIFIER = /^corr_[A-Za-z0-9_-]{16,128}$/;
const ASSESSMENT_PACK_IDENTIFIER = /^pack_[a-z0-9]+(?:_[a-z0-9]+)*$/;
const SIMPLE_VERSION_IDENTIFIER = /^v?\d{1,3}(?:\.\d{1,3}){0,2}$/;
const PREFIXED_VERSION_IDENTIFIER = /^[a-z][a-z0-9_-]*-v\d{1,3}(?:\.\d{1,3}){0,2}$/;
const SENSITIVE_KEY = /(?:e.?mail|phone|telephone|tel|(?:child|student|minor).*name|name.*(?:child|student|minor)|school|establishment|main.?need|(?:^|_)need|message|free.?text|answer|solution|report.*content|content.*report)/i;

function containsSensitiveKey(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      return true;
    }

    if (containsSensitiveKey(nestedValue)) {
      return true;
    }
  }

  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= maximum;
}

function isClosedCode(value: unknown, codes: ReadonlySet<string>): value is string {
  return typeof value === 'string' && codes.has(value);
}

function isPrismaIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && (UUID_IDENTIFIER.test(value)
      || CUID_V1_IDENTIFIER.test(value)
      || CUID_V2_IDENTIFIER.test(value));
}

function isAssessmentPackIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 80
    && ASSESSMENT_PACK_IDENTIFIER.test(value);
}

function isVersionIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 64
    && (SIMPLE_VERSION_IDENTIFIER.test(value)
      || PREFIXED_VERSION_IDENTIFIER.test(value));
}

const PAYLOAD_VALUE_VALIDATORS: Readonly<Record<
  string,
  (value: unknown) => value is string | number
>> = {
  acquisitionChannelCode: (value): value is string => isClosedCode(value, ACQUISITION_CODES),
  subjectCode: (value): value is string => isClosedCode(value, SUBJECT_CODES),
  gradeCode: (value): value is string => isClosedCode(value, GRADE_CODES),
  deliveryChannelCode: (value): value is string => isClosedCode(value, DELIVERY_CHANNEL_CODES),
  methodCode: (value): value is string => isClosedCode(value, VERIFICATION_METHOD_CODES),
  audienceCode: (value): value is string => isClosedCode(value, AUDIENCE_CODES),
  reasonCode: (value): value is string => isClosedCode(value, REASON_CODES),
  errorCode: (value): value is string => isClosedCode(value, ERROR_CODES),
  studentId: isPrismaIdentifier,
  attemptId: isPrismaIdentifier,
  assessmentPackId: isAssessmentPackIdentifier,
  revisionId: isPrismaIdentifier,
  reviewerId: isPrismaIdentifier,
  artifactId: isPrismaIdentifier,
  assessmentPackVersion: isVersionIdentifier,
  scoringVersion: isVersionIdentifier,
  scoreBasisPoints: (value): value is number => isBoundedInteger(value, 10_000),
  responseCount: (value): value is number => isBoundedInteger(value, 500),
  retryCount: (value): value is number => isBoundedInteger(value, 20),
  attemptCount: (value): value is number => isBoundedInteger(value, 20),
  sequence: (value): value is number => isBoundedInteger(value, 10_000),
  durationMs: (value): value is number => isBoundedInteger(value, 14_400_000),
};

function minimizedPayload(
  type: BilanRequestEventType,
  value: unknown,
): Readonly<Record<string, string | number>> {
  const payload = value ?? {};

  if (!isPlainObject(payload) || containsSensitiveKey(payload)) {
    throw new Error('Invalid minimized event payload');
  }

  const allowedKeys = new Set<string>(PAYLOAD_KEYS[type]);
  const result: Record<string, string | number> = {};

  for (const [key, item] of Object.entries(payload)) {
    const validate = PAYLOAD_VALUE_VALIDATORS[key];
    if (!allowedKeys.has(key) || !validate || !validate(item)) {
      throw new Error('Invalid minimized event payload');
    }
    result[key] = item;
  }

  return result;
}

function validateEnvelope(input: AppendBilanRequestEventInput): void {
  if (!isPrismaIdentifier(input.requestId)
    || !(isPrismaIdentifier(input.correlationId)
      || CORRELATION_IDENTIFIER.test(input.correlationId))
    || !BILAN_REQUEST_EVENT_TYPES.includes(input.type)
    || !BILAN_REQUEST_ACTORS.includes(input.actor)) {
    throw new Error('Invalid bilan request event envelope');
  }
}

export async function appendBilanRequestEvent(
  client: BilanRequestEventClient,
  input: AppendBilanRequestEventInput,
  options: Readonly<{ now?: Date }> = {},
): Promise<unknown> {
  validateEnvelope(input);
  const payload = minimizedPayload(input.type, input.payload);
  const occurredAt = options.now ?? new Date();
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new Error('Invalid bilan request event date');
  }

  return client.bilanRequestEvent.create({
    data: {
      requestId: input.requestId,
      type: input.type,
      actor: input.actor,
      correlationId: input.correlationId,
      payload,
      occurredAt,
    },
  });
}
