import { createHash } from 'node:crypto';

export const NPC_TOMBSTONE_PROTOCOL_VERSION = 'npc-tombstone/v1' as const;
export const NPC_TOMBSTONE_AUDIT_ACTION = 'NPC_TOMBSTONE_SUBMISSION_V1' as const;

export const TOMBSTONE_INITIAL_STATUSES = [
  'PENDING_UPLOAD',
  'UPLOADED',
  'PROCESSING_OCR',
  'OCR_FAILED',
  'READY_FOR_AI',
  'QUEUED_FOR_ANALYSIS',
  'ANALYZING',
  'ANALYSIS_FAILED',
  'COMPLETED',
  'ARCHIVED',
] as const;

export const TOMBSTONE_REPORT_STATUSES = [
  'DRAFT',
  'PENDING_VALIDATION',
  'VALIDATED',
  'SENT_TO_STUDENT',
  'READ_BY_STUDENT',
  'ARCHIVED',
] as const;

export const TOMBSTONE_REPORT_VISIBILITIES = [
  'COACH_ONLY',
  'COACH_AND_STUDENT',
  'STUDENT_SUMMARY_ONLY',
] as const;

export const TOMBSTONE_ACTOR_ROLES = [
  'ADMIN',
  'ASSISTANTE',
  'COACH',
  'SYSTEM',
] as const;

export type TombstoneInitialStatus = typeof TOMBSTONE_INITIAL_STATUSES[number];
export type TombstoneReportStatus = typeof TOMBSTONE_REPORT_STATUSES[number];
export type TombstoneReportVisibility = typeof TOMBSTONE_REPORT_VISIBILITIES[number];
export type TombstoneActorRole = typeof TOMBSTONE_ACTOR_ROLES[number];

export interface TombstoneArguments {
  submissionId: string;
  expectedInitialStatus: TombstoneInitialStatus;
  expectedPageCount: 4;
  expectedReportId: string;
  expectedReportStatus: TombstoneReportStatus;
  expectedReportVisibility: TombstoneReportVisibility;
  reason: string;
  actorId: string;
  actorRole: TombstoneActorRole;
  exportFile: string;
}

export interface TombstoneOperationKeyFields {
  protocolVersion: typeof NPC_TOMBSTONE_PROTOCOL_VERSION;
  submissionId: string;
  expectedInitialStatus: TombstoneInitialStatus;
  expectedPageCount: 4;
  expectedReportId: string;
  expectedReportStatus: TombstoneReportStatus;
  expectedReportVisibility: TombstoneReportVisibility;
  reason: string;
  actorId: string;
  actorRole: TombstoneActorRole;
}

export interface TombstoneOperationIdentity {
  fields: TombstoneOperationKeyFields;
  sha256: string;
  operationKey: string;
  auditId: string;
}

export class NpcTombstoneError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NpcTombstoneError';
    this.code = code;
  }
}

const TOMBSTONE_REASON_SENSITIVE_MARKER = /(?:api[-_ ]?key|auth(?:entication|orization)?|bearer|connection[-_ ]?string|cookie|credential|database[-_ ]?url|passphrase|password|secret|token)/i;
const TOMBSTONE_REASON_URL_MARKER = /(?:\b(?:file|ftp|https?):|\bwww\.|\b(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)+[a-z]{2,63}\b)/i;

export function validateTombstoneReason(value: string): string {
  if (
    value !== value.trim() ||
    value.length < 3 ||
    value.length > 160 ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    /[\\/=]/.test(value) ||
    TOMBSTONE_REASON_URL_MARKER.test(value) ||
    TOMBSTONE_REASON_SENSITIVE_MARKER.test(value)
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_INVALID_REASON',
      'Reason must be bounded plain text without paths, URLs, key-value data, or sensitive markers.',
    );
  }
  return value;
}

function canonicalOperationFields(fields: TombstoneOperationKeyFields): string {
  return JSON.stringify({
    actorId: fields.actorId,
    actorRole: fields.actorRole,
    expectedInitialStatus: fields.expectedInitialStatus,
    expectedPageCount: fields.expectedPageCount,
    expectedReportId: fields.expectedReportId,
    expectedReportStatus: fields.expectedReportStatus,
    expectedReportVisibility: fields.expectedReportVisibility,
    protocolVersion: fields.protocolVersion,
    reason: fields.reason,
    submissionId: fields.submissionId,
  });
}

export function buildTombstoneOperationIdentity(
  args: TombstoneArguments,
): TombstoneOperationIdentity {
  const fields: TombstoneOperationKeyFields = {
    protocolVersion: NPC_TOMBSTONE_PROTOCOL_VERSION,
    submissionId: args.submissionId,
    expectedInitialStatus: args.expectedInitialStatus,
    expectedPageCount: args.expectedPageCount,
    expectedReportId: args.expectedReportId,
    expectedReportStatus: args.expectedReportStatus,
    expectedReportVisibility: args.expectedReportVisibility,
    reason: args.reason,
    actorId: args.actorId,
    actorRole: args.actorRole,
  };
  const sha256 = createHash('sha256')
    .update(canonicalOperationFields(fields), 'utf8')
    .digest('hex');

  return {
    fields,
    sha256,
    operationKey: `npc-tombstone-v1:${sha256}`,
    auditId: `npc-tombstone-v1-${sha256}`,
  };
}

export function tombstoneError(code: string, message: string): never {
  throw new NpcTombstoneError(code, message);
}
