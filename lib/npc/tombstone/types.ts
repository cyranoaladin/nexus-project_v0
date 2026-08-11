import { createHash } from 'node:crypto';

export const NPC_TOMBSTONE_PROTOCOL_VERSION = 'npc-tombstone/v1' as const;
export const NPC_TOMBSTONE_AUDIT_ACTION = 'NPC_TOMBSTONE_SUBMISSION_V1' as const;
export const NPC_TOMBSTONE_REASON_CODE =
  'PILOT_DOCUMENTS_LOST_RESPONSIBLE_DECISION_2026_08_11' as const;
export const NPC_TOMBSTONE_REASON =
  'pièces perdues — dossier pilote, décision responsable 11/08/2026' as const;

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

export const TOMBSTONE_ACTOR_ROLES = ['ADMIN', 'ASSISTANTE'] as const;

export type TombstoneInitialStatus = typeof TOMBSTONE_INITIAL_STATUSES[number];
export type TombstoneReportStatus = typeof TOMBSTONE_REPORT_STATUSES[number];
export type TombstoneReportVisibility = typeof TOMBSTONE_REPORT_VISIBILITIES[number];
export type TombstoneActorRole = typeof TOMBSTONE_ACTOR_ROLES[number];
export type TombstoneReasonCode = typeof NPC_TOMBSTONE_REASON_CODE;

export interface TombstoneRequestManifest {
  version: 1;
  submissionId: string;
  expectedInitialStatus: TombstoneInitialStatus;
  expectedPageCount: 4;
  expectedReportId: string;
  expectedReportStatus: TombstoneReportStatus;
  expectedReportVisibility: TombstoneReportVisibility;
  reasonCode: TombstoneReasonCode;
  actorId: string;
  actorRole: TombstoneActorRole;
}

export interface TombstoneArguments extends TombstoneRequestManifest {
  reason: typeof NPC_TOMBSTONE_REASON;
  exportRoot: string;
}

export interface TombstoneOperationKeyFields {
  protocolVersion: typeof NPC_TOMBSTONE_PROTOCOL_VERSION;
  submissionId: string;
  expectedInitialStatus: TombstoneInitialStatus;
  expectedPageCount: 4;
  expectedReportId: string;
  expectedReportStatus: TombstoneReportStatus;
  expectedReportVisibility: TombstoneReportVisibility;
  reasonCode: TombstoneReasonCode;
  reason: typeof NPC_TOMBSTONE_REASON;
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

export function requireTombstoneId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,190}$/.test(value)) {
    tombstoneError('NPC_TOMBSTONE_INVALID_ID', `${label} must be a bounded opaque identifier.`);
  }
  return value;
}

export function canonicalTombstoneReason(code: unknown): typeof NPC_TOMBSTONE_REASON {
  if (code !== NPC_TOMBSTONE_REASON_CODE) {
    tombstoneError(
      'NPC_TOMBSTONE_REASON_CODE_INVALID',
      'The request reason code is not approved for this operation.',
    );
  }
  return NPC_TOMBSTONE_REASON;
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
    reasonCode: fields.reasonCode,
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
    reasonCode: args.reasonCode,
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
