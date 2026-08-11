import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import {
  NPC_TOMBSTONE_REASON,
  NPC_TOMBSTONE_REASON_CODE,
  NPC_TOMBSTONE_PROTOCOL_VERSION,
  TOMBSTONE_ACTOR_ROLES,
  TOMBSTONE_INITIAL_STATUSES,
  TOMBSTONE_REPORT_STATUSES,
  TOMBSTONE_REPORT_VISIBILITIES,
  buildTombstoneOperationIdentity,
  type TombstoneArguments,
  type TombstoneOperationKeyFields,
  tombstoneError,
} from './types';

const GCM_AUTH_TAG_LENGTH_BYTES = 16;

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

export interface RawTombstoneSnapshot {
  submission: Record<string, unknown>;
  pages: Array<Record<string, unknown>>;
  report: Record<string, unknown> | null;
  job: Record<string, unknown> | null;
  audits: Array<Record<string, unknown>>;
}

export interface KeyedCommitment extends Record<string, CanonicalValue> {
  redacted: true;
  hmacSha256: string;
  byteLength: number;
}

export interface TombstoneSnapshot {
  submission: Record<string, CanonicalValue>;
  pages: Array<Record<string, CanonicalValue>>;
  report: Record<string, CanonicalValue> | null;
  job: Record<string, CanonicalValue> | null;
  audits: Array<Record<string, CanonicalValue>>;
  snapshotHmacSha256: string;
}

export interface TombstoneExportPayload {
  protocolVersion: typeof NPC_TOMBSTONE_PROTOCOL_VERSION;
  operation: {
    operationKey: string;
    auditId: string;
    arguments: TombstoneOperationKeyFields;
    generatedAt: string;
  };
  snapshot: TombstoneSnapshot;
}

export interface TombstoneExportEnvelope {
  format: 'nexus-npc-tombstone-export';
  version: 2;
  metadata: {
    algorithm: 'aes-256-gcm';
    keyVersion: 'v1';
    operationDigest: string;
    encoding: 'base64';
  };
  iv: string;
  authTag: string;
  ciphertext: string;
  ciphertextChecksumSha256: string;
}

export interface TombstoneCryptoContext {
  readonly keyVersion: 'v1';
  readonly encryptionKey: Buffer;
  readonly commitmentKey: Buffer;
  readonly proofKey: Buffer;
}

export interface VerifiedTombstoneExport {
  envelope: TombstoneExportEnvelope;
  payload: TombstoneExportPayload;
  bytes: Buffer;
  artifactChecksumSha256: string;
  canonicalFilePath: string;
}

function canonicalize(value: unknown): CanonicalValue {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(canonicalize);
  switch (typeof value) {
    case 'boolean':
    case 'string':
      return value;
    case 'number':
      if (!Number.isFinite(value)) invalidExport('A non-finite number is forbidden.');
      return value;
    case 'bigint':
      return value.toString();
    case 'object': {
      const result: Record<string, CanonicalValue> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        const child = (value as Record<string, unknown>)[key];
        if (child !== undefined) result[key] = canonicalize(child);
      }
      return result;
    }
    default:
      invalidExport('An unsupported export value is forbidden.');
  }
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer, context: string, value: string | Buffer): string {
  return createHmac('sha256', key).update(context).update('\0').update(value).digest('hex');
}

function deriveKey(master: Buffer, context: string): Buffer {
  return createHmac('sha256', master).update(`nexus/npc/tombstone/${context}/v1`).digest();
}

export function createTombstoneCryptoContext(
  secret: string | undefined,
): TombstoneCryptoContext {
  const value = secret?.trim();
  if (!value || value.length < 32) {
    tombstoneError(
      'NPC_TOMBSTONE_ENCRYPTION_KEY_INVALID',
      'DOCUMENT_ENCRYPTION_KEY must contain at least 32 characters.',
    );
  }
  const master = createHmac('sha256', Buffer.from(value, 'utf8'))
    .update('nexus/npc/tombstone/master/v1')
    .digest();
  return {
    keyVersion: 'v1',
    encryptionKey: deriveKey(master, 'export-encryption'),
    commitmentKey: deriveKey(master, 'snapshot-commitment'),
    proofKey: deriveKey(master, 'audit-proof'),
  };
}

export function tombstoneProofHmac(
  crypto: TombstoneCryptoContext,
  value: unknown,
): string {
  return hmac(crypto.proofKey, 'idempotence-proof', canonicalJson(value));
}

function invalidExport(message: string): never {
  tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalidExport(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(source: Record<string, unknown>, key: string): string {
  if (typeof source[key] !== 'string') invalidExport(`${key} must be text.`);
  return source[key] as string;
}

function nullableString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value !== null && typeof value !== 'string') invalidExport(`${key} must be nullable text.`);
  return value as string | null;
}

function requiredId(source: Record<string, unknown>, key: string): string {
  const value = requiredString(source, key);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,190}$/.test(value)) invalidExport(`${key} is invalid.`);
  return value;
}

function nullableId(source: Record<string, unknown>, key: string): string | null {
  const value = nullableString(source, key);
  if (value !== null && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,190}$/.test(value)) {
    invalidExport(`${key} is invalid.`);
  }
  return value;
}

function finiteNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) invalidExport(`${key} must be finite.`);
  return value;
}

function nullableNumber(source: Record<string, unknown>, key: string): number | null {
  return source[key] === null ? null : finiteNumber(source, key);
}

function dateString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) invalidExport(`${key} must be a date.`);
  return date.toISOString();
}

function nullableDateString(source: Record<string, unknown>, key: string): string | null {
  return source[key] === null ? null : dateString(source, key);
}

function stringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    invalidExport(`${key} must be a text array.`);
  }
  return value as string[];
}

function enumString(source: Record<string, unknown>, key: string): string {
  return requiredString(source, key);
}

function nullableEnumString(source: Record<string, unknown>, key: string): string | null {
  return nullableString(source, key);
}

function relativeStoragePath(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\0') ||
    value.startsWith('/') ||
    value.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    invalidExport(`${label} must be canonical relative storage metadata.`);
  }
  return value;
}

function nullableRelativeStoragePath(value: unknown, label: string): string | null {
  return value === null ? null : relativeStoragePath(value, label);
}

function keyedCommitment(
  crypto: TombstoneCryptoContext,
  context: string,
  value: unknown,
): KeyedCommitment | null {
  if (value === null) return null;
  const bytes = Buffer.from(canonicalJson(value), 'utf8');
  return {
    redacted: true,
    hmacSha256: hmac(crypto.commitmentKey, context, bytes),
    byteLength: bytes.length,
  };
}

function submissionProjection(value: unknown): Record<string, CanonicalValue> {
  const source = record(value, 'submission');
  return {
    id: requiredId(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    updatedAt: dateString(source, 'updatedAt'),
    studentId: requiredId(source, 'studentId'),
    coachId: nullableId(source, 'coachId'),
    subject: enumString(source, 'subject'),
    gradeLevel: nullableEnumString(source, 'gradeLevel'),
    title: requiredString(source, 'title'),
    description: nullableString(source, 'description'),
    sourceType: enumString(source, 'sourceType'),
    sourceId: nullableId(source, 'sourceId'),
    status: enumString(source, 'status'),
    unavailableReason: nullableString(source, 'unavailableReason'),
    unavailableAt: nullableDateString(source, 'unavailableAt'),
    ocrText: nullableString(source, 'ocrText'),
    ocrError: nullableString(source, 'ocrError'),
    aiJobId: nullableId(source, 'aiJobId'),
    storedFilePath: nullableRelativeStoragePath(source.storedFilePath, 'storedFilePath'),
    fileSizeBytes: nullableNumber(source, 'fileSizeBytes'),
    mimeType: nullableString(source, 'mimeType'),
  };
}

function pageProjection(value: unknown): Record<string, CanonicalValue> {
  const source = record(value, 'page');
  const converted = stringArray(source, 'convertedFilePaths').map((path) =>
    relativeStoragePath(path, 'convertedFilePaths'));
  return {
    id: requiredId(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    updatedAt: dateString(source, 'updatedAt'),
    submissionId: requiredId(source, 'submissionId'),
    pageNumber: finiteNumber(source, 'pageNumber'),
    status: enumString(source, 'status'),
    documentType: enumString(source, 'documentType'),
    unavailableReason: nullableString(source, 'unavailableReason'),
    unavailableAt: nullableDateString(source, 'unavailableAt'),
    originalFilePath: relativeStoragePath(source.originalFilePath, 'originalFilePath'),
    originalFilename: nullableString(source, 'originalFilename'),
    mimeType: nullableString(source, 'mimeType'),
    sizeBytes: nullableNumber(source, 'sizeBytes'),
    sha256: nullableString(source, 'sha256'),
    uploadedById: nullableId(source, 'uploadedById'),
    convertedFilePaths: converted,
    ocrText: nullableString(source, 'ocrText'),
    ocrConfidence: nullableNumber(source, 'ocrConfidence'),
    width: nullableNumber(source, 'width'),
    height: nullableNumber(source, 'height'),
  };
}

function reportProjection(
  value: unknown,
  crypto: TombstoneCryptoContext,
): Record<string, CanonicalValue> | null {
  if (value === null) return null;
  const source = record(value, 'report');
  return {
    id: requiredId(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    updatedAt: dateString(source, 'updatedAt'),
    copySubmissionId: nullableId(source, 'copySubmissionId'),
    studentId: requiredId(source, 'studentId'),
    coachId: nullableId(source, 'coachId'),
    status: enumString(source, 'status'),
    visibility: enumString(source, 'visibility'),
    diagnostic: keyedCommitment(crypto, 'report-diagnostic', source.diagnostic),
    strengths: stringArray(source, 'strengths'),
    weaknesses: stringArray(source, 'weaknesses'),
    rawAiOutput: keyedCommitment(crypto, 'report-raw-ai-output', source.rawAiOutput),
    validatedAiOutput: keyedCommitment(
      crypto,
      'report-validated-ai-output',
      source.validatedAiOutput,
    ),
    sentToStudentAt: nullableDateString(source, 'sentToStudentAt'),
    readByStudentAt: nullableDateString(source, 'readByStudentAt'),
    coachNotes: nullableString(source, 'coachNotes'),
    studentSummary: nullableString(source, 'studentSummary'),
  };
}

function jobProjection(
  value: unknown,
  crypto: TombstoneCryptoContext,
): Record<string, CanonicalValue> | null {
  if (value === null) return null;
  const source = record(value, 'job');
  return {
    id: requiredId(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    updatedAt: dateString(source, 'updatedAt'),
    type: enumString(source, 'type'),
    status: enumString(source, 'status'),
    priority: enumString(source, 'priority'),
    copySubmissionId: nullableId(source, 'copySubmissionId'),
    inputData: keyedCommitment(crypto, 'job-input', source.inputData),
    outputData: keyedCommitment(crypto, 'job-output', source.outputData),
    errorMessage: keyedCommitment(crypto, 'job-error', source.errorMessage),
    retryCount: finiteNumber(source, 'retryCount'),
    maxRetries: finiteNumber(source, 'maxRetries'),
    claimedAt: nullableDateString(source, 'claimedAt'),
    claimedBy: nullableString(source, 'claimedBy'),
    startedAt: nullableDateString(source, 'startedAt'),
    completedAt: nullableDateString(source, 'completedAt'),
    nextRetryAt: nullableDateString(source, 'nextRetryAt'),
    processingDurationMs: nullableNumber(source, 'processingDurationMs'),
    chutesRequestId: nullableString(source, 'chutesRequestId'),
    tokensUsed: nullableNumber(source, 'tokensUsed'),
    modelVersion: nullableString(source, 'modelVersion'),
  };
}

function auditProjection(
  value: unknown,
  crypto: TombstoneCryptoContext,
): Record<string, CanonicalValue> {
  const source = record(value, 'audit');
  return {
    id: requiredId(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    reportId: nullableId(source, 'reportId'),
    action: requiredString(source, 'action'),
    actorId: requiredId(source, 'actorId'),
    actorRole: requiredString(source, 'actorRole'),
    entityType: requiredString(source, 'entityType'),
    entityId: requiredId(source, 'entityId'),
    details: keyedCommitment(crypto, `audit-details:${requiredId(source, 'id')}`, source.details),
  };
}

export function buildTombstoneSnapshot(
  rawSnapshot: RawTombstoneSnapshot,
  crypto: TombstoneCryptoContext,
): TombstoneSnapshot {
  const content = {
    submission: submissionProjection(rawSnapshot.submission),
    pages: rawSnapshot.pages.map(pageProjection),
    report: reportProjection(rawSnapshot.report, crypto),
    job: jobProjection(rawSnapshot.job, crypto),
    audits: rawSnapshot.audits.map((audit) => auditProjection(audit, crypto)),
  };
  return {
    ...content,
    snapshotHmacSha256: hmac(
      crypto.commitmentKey,
      'snapshot',
      canonicalJson(content),
    ),
  };
}

function envelopeMetadata(operationDigest: string): TombstoneExportEnvelope['metadata'] {
  return {
    algorithm: 'aes-256-gcm',
    keyVersion: 'v1',
    operationDigest,
    encoding: 'base64',
  };
}

export function createTombstoneExportEnvelope({
  args,
  rawSnapshot,
  generatedAt,
  crypto,
}: {
  args: TombstoneArguments;
  rawSnapshot: RawTombstoneSnapshot;
  generatedAt: Date;
  crypto: TombstoneCryptoContext;
}): TombstoneExportEnvelope {
  const identity = buildTombstoneOperationIdentity(args);
  const payload: TombstoneExportPayload = {
    protocolVersion: NPC_TOMBSTONE_PROTOCOL_VERSION,
    operation: {
      operationKey: identity.operationKey,
      auditId: identity.auditId,
      arguments: identity.fields,
      generatedAt: generatedAt.toISOString(),
    },
    snapshot: buildTombstoneSnapshot(rawSnapshot, crypto),
  };
  const metadata = envelopeMetadata(identity.sha256);
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    crypto.encryptionKey,
    iv,
    { authTagLength: GCM_AUTH_TAG_LENGTH_BYTES },
  );
  cipher.setAAD(Buffer.from(canonicalJson(metadata), 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(canonicalJson(payload), 'utf8'),
    cipher.final(),
  ]);
  return {
    format: 'nexus-npc-tombstone-export',
    version: 2,
    metadata,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    ciphertextChecksumSha256: sha256(ciphertext),
  };
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

const SUBMISSION_KEYS = [
  'id', 'createdAt', 'updatedAt', 'studentId', 'coachId', 'subject', 'gradeLevel',
  'title', 'description', 'sourceType', 'sourceId', 'status', 'unavailableReason',
  'unavailableAt', 'ocrText', 'ocrError', 'aiJobId', 'storedFilePath',
  'fileSizeBytes', 'mimeType',
] as const;
const PAGE_KEYS = [
  'id', 'createdAt', 'updatedAt', 'submissionId', 'pageNumber', 'status',
  'documentType', 'unavailableReason', 'unavailableAt', 'originalFilePath',
  'originalFilename', 'mimeType', 'sizeBytes', 'sha256', 'uploadedById',
  'convertedFilePaths', 'ocrText', 'ocrConfidence', 'width', 'height',
] as const;
const REPORT_KEYS = [
  'id', 'createdAt', 'updatedAt', 'copySubmissionId', 'studentId', 'coachId',
  'status', 'visibility', 'diagnostic', 'strengths', 'weaknesses', 'rawAiOutput',
  'validatedAiOutput', 'sentToStudentAt', 'readByStudentAt', 'coachNotes',
  'studentSummary',
] as const;
const JOB_KEYS = [
  'id', 'createdAt', 'updatedAt', 'type', 'status', 'priority', 'copySubmissionId',
  'inputData', 'outputData', 'errorMessage', 'retryCount', 'maxRetries', 'claimedAt',
  'claimedBy', 'startedAt', 'completedAt', 'nextRetryAt', 'processingDurationMs',
  'chutesRequestId', 'tokensUsed', 'modelVersion',
] as const;
const AUDIT_KEYS = [
  'id', 'createdAt', 'reportId', 'action', 'actorId', 'actorRole', 'entityType',
  'entityId', 'details',
] as const;
const OPERATION_FIELD_KEYS = [
  'protocolVersion', 'submissionId', 'expectedInitialStatus', 'expectedPageCount',
  'expectedReportId', 'expectedReportStatus', 'expectedReportVisibility',
  'reasonCode', 'reason', 'actorId', 'actorRole',
] as const;

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,190}$/.test(value);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' &&
    !Number.isNaN(new Date(value).getTime()) &&
    new Date(value).toISOString() === value;
}

function validNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function validNullableId(value: unknown): boolean {
  return value === null || validId(value);
}

function validNullableNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function validNullableDate(value: unknown): boolean {
  return value === null || validDate(value);
}

function validKeyedCommitment(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const commitment = value as Record<string, unknown>;
  return hasExactKeys(commitment, ['redacted', 'hmacSha256', 'byteLength']) &&
    commitment.redacted === true &&
    typeof commitment.hmacSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(commitment.hmacSha256) &&
    Number.isSafeInteger(commitment.byteLength) &&
    Number(commitment.byteLength) >= 0;
}

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    hasExactKeys(value as Record<string, unknown>, keys);
}

function validSubmissionRecord(value: unknown): boolean {
  if (!exactRecord(value, SUBMISSION_KEYS)) return false;
  return validId(value.id) && validId(value.studentId) &&
    validDate(value.createdAt) && validDate(value.updatedAt) &&
    validNullableId(value.coachId) && validNullableId(value.sourceId) &&
    validNullableId(value.aiJobId) && typeof value.subject === 'string' &&
    validNullableString(value.gradeLevel) && typeof value.title === 'string' &&
    validNullableString(value.description) && typeof value.sourceType === 'string' &&
    typeof value.status === 'string' && validNullableString(value.unavailableReason) &&
    validNullableDate(value.unavailableAt) && validNullableString(value.ocrText) &&
    validNullableString(value.ocrError) && validNullableString(value.storedFilePath) &&
    validNullableNumber(value.fileSizeBytes) && validNullableString(value.mimeType);
}

function validPageRecord(value: unknown): boolean {
  if (!exactRecord(value, PAGE_KEYS)) return false;
  return validId(value.id) && validId(value.submissionId) &&
    validDate(value.createdAt) && validDate(value.updatedAt) &&
    Number.isSafeInteger(value.pageNumber) && Number(value.pageNumber) > 0 &&
    typeof value.status === 'string' && typeof value.documentType === 'string' &&
    validNullableString(value.unavailableReason) && validNullableDate(value.unavailableAt) &&
    typeof value.originalFilePath === 'string' && validNullableString(value.originalFilename) &&
    validNullableString(value.mimeType) && validNullableNumber(value.sizeBytes) &&
    validNullableString(value.sha256) && validNullableId(value.uploadedById) &&
    Array.isArray(value.convertedFilePaths) &&
    value.convertedFilePaths.every((item) => typeof item === 'string') &&
    validNullableString(value.ocrText) && validNullableNumber(value.ocrConfidence) &&
    validNullableNumber(value.width) && validNullableNumber(value.height);
}

function validReportRecord(value: unknown): boolean {
  if (value === null) return true;
  if (!exactRecord(value, REPORT_KEYS)) return false;
  return validId(value.id) && validId(value.studentId) &&
    validDate(value.createdAt) && validDate(value.updatedAt) &&
    validNullableId(value.copySubmissionId) && validNullableId(value.coachId) &&
    typeof value.status === 'string' && typeof value.visibility === 'string' &&
    validKeyedCommitment(value.diagnostic) &&
    Array.isArray(value.strengths) && value.strengths.every((item) => typeof item === 'string') &&
    Array.isArray(value.weaknesses) && value.weaknesses.every((item) => typeof item === 'string') &&
    validKeyedCommitment(value.rawAiOutput) && validKeyedCommitment(value.validatedAiOutput) &&
    validNullableDate(value.sentToStudentAt) && validNullableDate(value.readByStudentAt) &&
    validNullableString(value.coachNotes) && validNullableString(value.studentSummary);
}

function validJobRecord(value: unknown): boolean {
  if (value === null) return true;
  if (!exactRecord(value, JOB_KEYS)) return false;
  return validId(value.id) && validDate(value.createdAt) && validDate(value.updatedAt) &&
    typeof value.type === 'string' && typeof value.status === 'string' &&
    typeof value.priority === 'string' && validNullableId(value.copySubmissionId) &&
    validKeyedCommitment(value.inputData) && validKeyedCommitment(value.outputData) &&
    validKeyedCommitment(value.errorMessage) && Number.isSafeInteger(value.retryCount) &&
    Number.isSafeInteger(value.maxRetries) && validNullableDate(value.claimedAt) &&
    validNullableString(value.claimedBy) && validNullableDate(value.startedAt) &&
    validNullableDate(value.completedAt) && validNullableDate(value.nextRetryAt) &&
    validNullableNumber(value.processingDurationMs) &&
    validNullableString(value.chutesRequestId) && validNullableNumber(value.tokensUsed) &&
    validNullableString(value.modelVersion);
}

function validAuditRecord(value: unknown): boolean {
  if (!exactRecord(value, AUDIT_KEYS)) return false;
  return validId(value.id) && validDate(value.createdAt) && validNullableId(value.reportId) &&
    typeof value.action === 'string' && validId(value.actorId) &&
    typeof value.actorRole === 'string' && typeof value.entityType === 'string' &&
    validId(value.entityId) && validKeyedCommitment(value.details);
}

function canonicalBase64(value: unknown, expectedBytes?: number): Buffer {
  if (typeof value !== 'string' || value.length === 0) invalidExport('Encrypted value is invalid.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value || (expectedBytes !== undefined && bytes.length !== expectedBytes)) {
    invalidExport('Encrypted value encoding is invalid.');
  }
  return bytes;
}

function validateDecryptedPayload(
  value: unknown,
  crypto: TombstoneCryptoContext,
): TombstoneExportPayload {
  const payload = record(value, 'payload');
  if (!hasExactKeys(payload, ['protocolVersion', 'operation', 'snapshot'])) {
    invalidExport('Payload shape is invalid.');
  }
  if (payload.protocolVersion !== NPC_TOMBSTONE_PROTOCOL_VERSION) {
    invalidExport('Payload protocol is invalid.');
  }
  const operation = record(payload.operation, 'operation');
  if (!hasExactKeys(operation, ['operationKey', 'auditId', 'arguments', 'generatedAt'])) {
    invalidExport('Operation shape is invalid.');
  }
  const fields = record(operation.arguments, 'operation arguments') as unknown as TombstoneOperationKeyFields;
  if (
    !hasExactKeys(fields as unknown as Record<string, unknown>, OPERATION_FIELD_KEYS) ||
    fields.protocolVersion !== NPC_TOMBSTONE_PROTOCOL_VERSION ||
    !validId(fields.submissionId) ||
    !TOMBSTONE_INITIAL_STATUSES.includes(fields.expectedInitialStatus) ||
    fields.expectedPageCount !== 4 ||
    !validId(fields.expectedReportId) ||
    !TOMBSTONE_REPORT_STATUSES.includes(fields.expectedReportStatus) ||
    !TOMBSTONE_REPORT_VISIBILITIES.includes(fields.expectedReportVisibility) ||
    fields.reasonCode !== NPC_TOMBSTONE_REASON_CODE ||
    fields.reason !== NPC_TOMBSTONE_REASON ||
    !validId(fields.actorId) ||
    !TOMBSTONE_ACTOR_ROLES.includes(fields.actorRole)
  ) {
    invalidExport('Operation arguments are invalid.');
  }
  const args = {
    ...fields,
    version: 1 as const,
    exportRoot: '/validated',
  } as TombstoneArguments;
  const identity = buildTombstoneOperationIdentity(args);
  if (
    operation.operationKey !== identity.operationKey ||
    operation.auditId !== identity.auditId ||
    canonicalJson(fields) !== canonicalJson(identity.fields) ||
    typeof operation.generatedAt !== 'string' ||
    new Date(operation.generatedAt).toISOString() !== operation.generatedAt
  ) {
    invalidExport('Operation identity is invalid.');
  }
  const snapshot = record(payload.snapshot, 'snapshot');
  if (!hasExactKeys(snapshot, [
    'submission', 'pages', 'report', 'job', 'audits', 'snapshotHmacSha256',
  ])) {
    invalidExport('Snapshot shape is invalid.');
  }
  if (
    !Array.isArray(snapshot.pages) ||
    !Array.isArray(snapshot.audits) ||
    typeof snapshot.snapshotHmacSha256 !== 'string' ||
    !validSubmissionRecord(snapshot.submission) ||
    !snapshot.pages.every(validPageRecord) ||
    !validReportRecord(snapshot.report) ||
    !validJobRecord(snapshot.job) ||
    !snapshot.audits.every(validAuditRecord)
  ) {
    invalidExport('Snapshot collections are invalid.');
  }
  const { snapshotHmacSha256, ...snapshotContent } = snapshot;
  const expected = hmac(crypto.commitmentKey, 'snapshot', canonicalJson(snapshotContent));
  if (!safeHexEqual(snapshotHmacSha256, expected)) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_AUTH_FAILED', 'Snapshot authentication failed.');
  }
  return value as TombstoneExportPayload;
}

function safeHexEqual(left: unknown, right: string): boolean {
  if (typeof left !== 'string' || !/^[a-f0-9]{64}$/.test(left)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function decryptAndVerifyTombstoneEnvelope(
  value: unknown,
  crypto: TombstoneCryptoContext,
): TombstoneExportPayload {
  const envelope = record(value, 'envelope');
  if (!hasExactKeys(envelope, [
    'format', 'version', 'metadata', 'iv', 'authTag', 'ciphertext',
    'ciphertextChecksumSha256',
  ])) {
    invalidExport('Envelope shape is invalid.');
  }
  const metadata = record(envelope.metadata, 'metadata');
  if (
    envelope.format !== 'nexus-npc-tombstone-export' ||
    envelope.version !== 2 ||
    !hasExactKeys(metadata, ['algorithm', 'keyVersion', 'operationDigest', 'encoding']) ||
    metadata.algorithm !== 'aes-256-gcm' ||
    metadata.keyVersion !== crypto.keyVersion ||
    metadata.encoding !== 'base64' ||
    typeof metadata.operationDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(metadata.operationDigest)
  ) {
    invalidExport('Envelope metadata is invalid.');
  }
  const ciphertext = canonicalBase64(envelope.ciphertext);
  if (!safeHexEqual(envelope.ciphertextChecksumSha256, sha256(ciphertext))) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_CHECKSUM_MISMATCH', 'Ciphertext checksum does not match.');
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      crypto.encryptionKey,
      canonicalBase64(envelope.iv, 12),
      { authTagLength: GCM_AUTH_TAG_LENGTH_BYTES },
    );
    decipher.setAAD(Buffer.from(canonicalJson(metadata), 'utf8'));
    decipher.setAuthTag(
      canonicalBase64(envelope.authTag, GCM_AUTH_TAG_LENGTH_BYTES),
    );
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString('utf8')) as unknown;
    if (Buffer.from(canonicalJson(parsed), 'utf8').compare(plaintext) !== 0) {
      invalidExport('Decrypted payload is not canonically serialized.');
    }
    const payload = validateDecryptedPayload(parsed, crypto);
    if (payload.operation.operationKey !== `npc-tombstone-v1:${metadata.operationDigest}`) {
      tombstoneError('NPC_TOMBSTONE_EXPORT_OPERATION_MISMATCH', 'Artifact identity does not match.');
    }
    return payload;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error &&
      String(error.code).startsWith('NPC_TOMBSTONE_')) throw error;
    tombstoneError('NPC_TOMBSTONE_EXPORT_AUTH_FAILED', 'Artifact authentication failed.');
  }
}

export function canonicalizeTombstonePath(filePath: string): string {
  if (!isAbsolute(filePath) || filePath.includes('\0')) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_PATH_INVALID', 'Path must be absolute and canonical.');
  }
  const segments = filePath.split('/');
  if (
    segments[0] !== '' ||
    segments.length < 2 ||
    segments.slice(1).some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_PATH_INVALID', 'Path contains an unsafe raw segment.');
  }
  return `/${segments.slice(1).join('/')}`;
}

export function tombstoneArtifactPath(args: TombstoneArguments): string {
  const root = canonicalizeTombstonePath(args.exportRoot);
  return join(root, `${buildTombstoneOperationIdentity(args).sha256}.json`);
}

interface TrustedParent {
  canonicalFilePath: string;
  canonicalParentPath: string;
  entryPath: string;
  parent: FileHandle;
  handles: FileHandle[];
}

function descriptorPath(handle: FileHandle): string {
  return `/proc/${process.pid}/fd/${handle.fd}`;
}

function nodeError(error: unknown, code: string): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === code;
}

async function verifyDirectory(
  handle: FileHandle,
  expectedPath: string,
  finalParent: boolean,
): Promise<void> {
  const descriptorStats = await handle.stat();
  if (!descriptorStats.isDirectory()) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_PARENT_INVALID', 'A parent is not a directory.');
  }
  if (descriptorStats.uid !== 0) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_PARENT_OWNER', 'Every parent must be root-owned.');
  }
  if ((Number(descriptorStats.mode) & (finalParent ? 0o077 : 0o022)) !== 0) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_PERMISSIONS',
      'The artifact parent permissions are not restricted enough.',
    );
  }
  try {
    const [resolved, named] = await Promise.all([
      realpath(descriptorPath(handle)),
      lstat(expectedPath),
    ]);
    if (
      resolved !== expectedPath ||
      named.isSymbolicLink() ||
      named.dev !== descriptorStats.dev ||
      named.ino !== descriptorStats.ino
    ) {
      tombstoneError('NPC_TOMBSTONE_EXPORT_PARENT_CHANGED', 'A parent changed during verification.');
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error &&
      String(error.code).startsWith('NPC_TOMBSTONE_')) throw error;
    tombstoneError('NPC_TOMBSTONE_EXPORT_PARENT_CHANGED', 'A parent changed during verification.');
  }
}

async function closeAll(handles: FileHandle[]): Promise<void> {
  for (const handle of [...handles].reverse()) await handle.close().catch(() => undefined);
}

async function openTrustedParent(filePath: string): Promise<TrustedParent> {
  const canonicalFilePath = canonicalizeTombstonePath(filePath);
  const segments = canonicalFilePath.slice(1).split('/');
  const filename = segments.pop();
  if (!filename) invalidExport('Filename is missing.');
  const handles: FileHandle[] = [];
  let expectedPath = '/';
  try {
    let parent = await open('/', constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    handles.push(parent);
    await verifyDirectory(parent, '/', segments.length === 0);
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      expectedPath = join(expectedPath, segment);
      try {
        parent = await open(
          join(descriptorPath(parent), segment),
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
        );
      } catch (error) {
        if (nodeError(error, 'ELOOP') || nodeError(error, 'ENOTDIR')) {
          tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Symbolic links are forbidden.');
        }
        if (nodeError(error, 'ENOENT')) {
          tombstoneError('NPC_TOMBSTONE_EXPORT_PARENT_INVALID', 'Parent does not exist.');
        }
        throw error;
      }
      handles.push(parent);
      await verifyDirectory(parent, expectedPath, index === segments.length - 1);
    }
    await verifyDirectory(parent, expectedPath, true);
    return {
      canonicalFilePath,
      canonicalParentPath: expectedPath,
      entryPath: join(descriptorPath(parent), filename),
      parent,
      handles,
    };
  } catch (error) {
    await closeAll(handles);
    throw error;
  }
}

async function withTrustedParent<T>(
  filePath: string,
  callback: (context: TrustedParent) => Promise<T>,
): Promise<T> {
  const context = await openTrustedParent(filePath);
  try {
    return await callback(context);
  } finally {
    await closeAll(context.handles);
  }
}

async function assertOpenedFile(context: TrustedParent, handle: FileHandle): Promise<void> {
  await verifyDirectory(context.parent, context.canonicalParentPath, true);
  const [descriptor, named] = await Promise.all([handle.stat(), lstat(context.entryPath)]);
  if (
    !descriptor.isFile() ||
    !named.isFile() ||
    named.isSymbolicLink() ||
    descriptor.dev !== named.dev ||
    descriptor.ino !== named.ino
  ) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Artifact is not a stable regular file.');
  }
  if (descriptor.uid !== 0) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_OWNER', 'Artifact must be root-owned.');
  }
  if ((Number(descriptor.mode) & 0o777) !== 0o600) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_PERMISSIONS', 'Artifact must have mode 0600.');
  }
}

async function readHandle(handle: FileHandle, maximumBytes = 32 * 1024 * 1024): Promise<Buffer> {
  const stats = await handle.stat();
  if (!Number.isSafeInteger(stats.size) || stats.size <= 0 || stats.size > maximumBytes) {
    invalidExport('File size is invalid.');
  }
  const bytes = Buffer.alloc(stats.size);
  let offset = 0;
  while (offset < bytes.length) {
    const result = await handle.read(bytes, offset, bytes.length - offset, offset);
    if (result.bytesRead === 0) invalidExport('File ended during readback.');
    offset += result.bytesRead;
  }
  return bytes;
}

export async function readSecureRootOwnedJson(filePath: string): Promise<unknown> {
  return withTrustedParent(filePath, async (context) => {
    let handle: FileHandle;
    try {
      handle = await open(context.entryPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if (nodeError(error, 'ELOOP')) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Symbolic links are forbidden.');
      }
      throw error;
    }
    try {
      await assertOpenedFile(context, handle);
      const bytes = await readHandle(handle, 64 * 1024);
      try {
        return JSON.parse(bytes.toString('utf8')) as unknown;
      } catch {
        tombstoneError('NPC_TOMBSTONE_REQUEST_INVALID', 'Request manifest is not valid JSON.');
      }
    } finally {
      await handle.close();
    }
  });
}

function parseArtifactBytes(
  bytes: Buffer,
  canonicalFilePath: string,
  crypto: TombstoneCryptoContext,
): VerifiedTombstoneExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    invalidExport('Artifact is not JSON.');
  }
  if (!bytes.equals(Buffer.from(`${canonicalJson(parsed)}\n`, 'utf8'))) {
    invalidExport('Artifact bytes are not the exact canonical serialization.');
  }
  const payload = decryptAndVerifyTombstoneEnvelope(parsed, crypto);
  return {
    envelope: parsed as TombstoneExportEnvelope,
    payload,
    bytes,
    artifactChecksumSha256: sha256(bytes),
    canonicalFilePath,
  };
}

export async function writeVerifiedTombstoneExport(
  filePath: string,
  envelope: TombstoneExportEnvelope,
  crypto: TombstoneCryptoContext,
): Promise<VerifiedTombstoneExport> {
  return withTrustedParent(filePath, async (context) => {
    let handle: FileHandle;
    try {
      handle = await open(
        context.entryPath,
        constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
    } catch (error) {
      if (nodeError(error, 'EEXIST')) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_EXISTS', 'Artifact already exists.');
      }
      if (nodeError(error, 'ELOOP')) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Symbolic links are forbidden.');
      }
      throw error;
    }
    try {
      await handle.chmod(0o600);
      const expected = Buffer.from(`${canonicalJson(envelope)}\n`, 'utf8');
      await handle.writeFile(expected);
      await handle.sync();
      await assertOpenedFile(context, handle);
      const bytes = await readHandle(handle);
      if (!bytes.equals(expected)) invalidExport('Artifact changed during verification.');
      const verified = parseArtifactBytes(bytes, context.canonicalFilePath, crypto);
      await verifyDirectory(context.parent, context.canonicalParentPath, true);
      await context.parent.sync();
      return verified;
    } finally {
      await handle.close();
    }
  });
}

export async function readVerifiedTombstoneExport(
  filePath: string,
  crypto: TombstoneCryptoContext,
): Promise<VerifiedTombstoneExport> {
  return withTrustedParent(filePath, async (context) => {
    let handle: FileHandle;
    try {
      handle = await open(context.entryPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if (nodeError(error, 'ENOENT')) {
        tombstoneError('NPC_TOMBSTONE_ARTIFACT_REQUIRED', 'Canonical artifact is missing.');
      }
      if (nodeError(error, 'ELOOP')) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Symbolic links are forbidden.');
      }
      throw error;
    }
    try {
      await assertOpenedFile(context, handle);
      return parseArtifactBytes(await readHandle(handle), context.canonicalFilePath, crypto);
    } finally {
      await handle.close();
    }
  });
}
