import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import {
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

export interface TombstoneSnapshot {
  submission: Record<string, CanonicalValue>;
  pages: Array<Record<string, CanonicalValue>>;
  report: Record<string, CanonicalValue> | null;
  job: Record<string, CanonicalValue> | null;
  audits: Array<Record<string, CanonicalValue>>;
  snapshotSha256: string;
}

export interface TombstoneExportEnvelope {
  format: 'nexus-npc-tombstone-export';
  version: 1;
  payload: {
    protocolVersion: typeof NPC_TOMBSTONE_PROTOCOL_VERSION;
    operation: {
      operationKey: string;
      auditId: string;
      arguments: TombstoneOperationKeyFields;
      generatedAt: string;
    };
    snapshot: TombstoneSnapshot;
  };
  payloadSha256: string;
}

export interface VerifiedTombstoneExport {
  envelope: TombstoneExportEnvelope;
  bytes: Buffer;
  payloadSha256: string;
  canonicalFilePath: string;
}

export interface TombstoneExportSecurityOptions {
  trustedUid?: number;
  onParentVerified?: () => void | Promise<void>;
  onFileOpened?: (flags: number) => void;
  onFileSynced?: () => void;
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
      if (!Number.isFinite(value)) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export contains a non-finite number.');
      }
      return value;
    case 'bigint':
      return value.toString();
    case 'object': {
      const output: Record<string, CanonicalValue> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        const child = (value as Record<string, unknown>)[key];
        if (child !== undefined) output[key] = canonicalize(child);
      }
      return output;
    }
    default:
      tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export contains an unsupported value.');
  }
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

interface OpaqueCommitment extends Record<string, CanonicalValue> {
  redacted: true;
  sha256: string;
  byteLength: number;
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
  if (typeof source[key] !== 'string') invalidExport(`${key} must be a string.`);
  return source[key] as string;
}

function nullableString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value !== null && typeof value !== 'string') invalidExport(`${key} must be nullable text.`);
  return value as string | null;
}

function finiteNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) invalidExport(`${key} must be finite.`);
  return value;
}

function nullableNumber(source: Record<string, unknown>, key: string): number | null {
  if (source[key] === null) return null;
  return finiteNumber(source, key);
}

function dateString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) invalidExport(`${key} must be a date.`);
  return date.toISOString();
}

function nullableDateString(source: Record<string, unknown>, key: string): string | null {
  if (source[key] === null) return null;
  return dateString(source, key);
}

function stringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    invalidExport(`${key} must be a text array.`);
  }
  return value as string[];
}

function opaqueCommitment(value: unknown): OpaqueCommitment | null {
  if (value === null) return null;
  if (value === undefined) invalidExport('Opaque export value is missing.');
  const bytes = Buffer.from(canonicalJson(value), 'utf8');
  return { redacted: true, sha256: sha256(bytes), byteLength: bytes.length };
}

function submissionProjection(value: unknown): Record<string, CanonicalValue> {
  const source = record(value, 'submission');
  return {
    id: requiredString(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    updatedAt: dateString(source, 'updatedAt'),
    studentId: requiredString(source, 'studentId'),
    coachId: nullableString(source, 'coachId'),
    subject: requiredString(source, 'subject'),
    gradeLevel: nullableString(source, 'gradeLevel'),
    title: requiredString(source, 'title'),
    description: nullableString(source, 'description'),
    sourceType: requiredString(source, 'sourceType'),
    sourceId: nullableString(source, 'sourceId'),
    status: requiredString(source, 'status'),
    unavailableReason: nullableString(source, 'unavailableReason'),
    unavailableAt: nullableDateString(source, 'unavailableAt'),
    ocrText: nullableString(source, 'ocrText'),
    ocrError: nullableString(source, 'ocrError'),
    aiJobId: nullableString(source, 'aiJobId'),
    storedFilePath: opaqueCommitment(source.storedFilePath),
    fileSizeBytes: nullableNumber(source, 'fileSizeBytes'),
    mimeType: nullableString(source, 'mimeType'),
  };
}

function pageProjection(value: unknown): Record<string, CanonicalValue> {
  const source = record(value, 'page');
  return {
    id: requiredString(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    updatedAt: dateString(source, 'updatedAt'),
    submissionId: requiredString(source, 'submissionId'),
    pageNumber: finiteNumber(source, 'pageNumber'),
    status: requiredString(source, 'status'),
    documentType: requiredString(source, 'documentType'),
    unavailableReason: nullableString(source, 'unavailableReason'),
    unavailableAt: nullableDateString(source, 'unavailableAt'),
    originalFilePath: opaqueCommitment(source.originalFilePath),
    originalFilename: nullableString(source, 'originalFilename'),
    mimeType: nullableString(source, 'mimeType'),
    sizeBytes: nullableNumber(source, 'sizeBytes'),
    sha256: nullableString(source, 'sha256'),
    uploadedById: nullableString(source, 'uploadedById'),
    convertedFilePaths: opaqueCommitment(source.convertedFilePaths),
    ocrText: nullableString(source, 'ocrText'),
    ocrConfidence: nullableNumber(source, 'ocrConfidence'),
    width: nullableNumber(source, 'width'),
    height: nullableNumber(source, 'height'),
  };
}

function reportProjection(value: unknown): Record<string, CanonicalValue> | null {
  if (value === null) return null;
  const source = record(value, 'report');
  return {
    id: requiredString(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    updatedAt: dateString(source, 'updatedAt'),
    copySubmissionId: nullableString(source, 'copySubmissionId'),
    studentId: requiredString(source, 'studentId'),
    coachId: nullableString(source, 'coachId'),
    status: requiredString(source, 'status'),
    visibility: requiredString(source, 'visibility'),
    diagnostic: opaqueCommitment(source.diagnostic),
    strengths: stringArray(source, 'strengths'),
    weaknesses: stringArray(source, 'weaknesses'),
    rawAiOutput: opaqueCommitment(source.rawAiOutput),
    validatedAiOutput: opaqueCommitment(source.validatedAiOutput),
    sentToStudentAt: nullableDateString(source, 'sentToStudentAt'),
    readByStudentAt: nullableDateString(source, 'readByStudentAt'),
    coachNotes: nullableString(source, 'coachNotes'),
    studentSummary: nullableString(source, 'studentSummary'),
  };
}

function jobProjection(value: unknown): Record<string, CanonicalValue> | null {
  if (value === null) return null;
  const source = record(value, 'job');
  return {
    id: requiredString(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    updatedAt: dateString(source, 'updatedAt'),
    type: requiredString(source, 'type'),
    status: requiredString(source, 'status'),
    priority: requiredString(source, 'priority'),
    copySubmissionId: nullableString(source, 'copySubmissionId'),
    inputData: opaqueCommitment(source.inputData),
    outputData: opaqueCommitment(source.outputData),
    errorMessage: opaqueCommitment(source.errorMessage),
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

function auditProjection(value: unknown): Record<string, CanonicalValue> {
  const source = record(value, 'audit');
  return {
    id: requiredString(source, 'id'),
    createdAt: dateString(source, 'createdAt'),
    reportId: nullableString(source, 'reportId'),
    action: requiredString(source, 'action'),
    actorId: requiredString(source, 'actorId'),
    actorRole: requiredString(source, 'actorRole'),
    entityType: requiredString(source, 'entityType'),
    entityId: requiredString(source, 'entityId'),
    details: opaqueCommitment(source.details),
  };
}

function snapshotContent(snapshot: Omit<TombstoneSnapshot, 'snapshotSha256'>): CanonicalValue {
  return canonicalize(snapshot);
}

export function buildTombstoneSnapshot(
  rawSnapshot: RawTombstoneSnapshot,
): TombstoneSnapshot {
  const content = {
    submission: submissionProjection(rawSnapshot.submission),
    pages: rawSnapshot.pages.map(pageProjection),
    report: reportProjection(rawSnapshot.report),
    job: jobProjection(rawSnapshot.job),
    audits: rawSnapshot.audits.map(auditProjection),
  };
  return { ...content, snapshotSha256: sha256(canonicalJson(snapshotContent(content))) };
}

export function createTombstoneExportEnvelope({
  args,
  rawSnapshot,
  generatedAt,
}: {
  args: TombstoneArguments;
  rawSnapshot: RawTombstoneSnapshot;
  generatedAt: Date;
}): TombstoneExportEnvelope {
  const identity = buildTombstoneOperationIdentity(args);
  const payload = {
    protocolVersion: NPC_TOMBSTONE_PROTOCOL_VERSION,
    operation: {
      operationKey: identity.operationKey,
      auditId: identity.auditId,
      arguments: identity.fields,
      generatedAt: generatedAt.toISOString(),
    },
    snapshot: buildTombstoneSnapshot(rawSnapshot),
  };
  return {
    format: 'nexus-npc-tombstone-export',
    version: 1,
    payload,
    payloadSha256: sha256(canonicalJson(payload)),
  };
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export function canonicalizeTombstoneExportPath(filePath: string): string {
  if (!isAbsolute(filePath) || filePath.includes('\0')) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PATH_INVALID',
      'Export destination must be an absolute normalized path.',
    );
  }
  const segments = filePath.split('/');
  if (
    segments[0] !== '' ||
    segments.length < 2 ||
    segments.slice(1).some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PATH_INVALID',
      'Export destination contains an unsafe raw path segment.',
    );
  }
  return `/${segments.slice(1).join('/')}`;
}

interface TrustedExportParent {
  canonicalFilePath: string;
  canonicalParentPath: string;
  entryPath: string;
  parent: FileHandle;
  handles: FileHandle[];
  trustedUid: number;
}

function descriptorPath(handle: FileHandle): string {
  return `/proc/${process.pid}/fd/${handle.fd}`;
}

function sameInode(
  left: Awaited<ReturnType<FileHandle['stat']>>,
  right: Awaited<ReturnType<typeof lstat>>,
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertDirectoryTrust(
  stats: Awaited<ReturnType<FileHandle['stat']>>,
  trustedUid: number,
  finalParent: boolean,
): void {
  if (!stats.isDirectory()) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_INVALID',
      'Export path contains a non-directory parent.',
    );
  }
  if (stats.uid !== 0 && stats.uid !== trustedUid) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_OWNER',
      'Export parent chain has an untrusted owner.',
    );
  }
  const forbiddenMode = finalParent ? 0o077 : 0o022;
  if ((Number(stats.mode) & forbiddenMode) !== 0) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_PERMISSIONS',
      finalParent
        ? 'Export parent must grant no group or world permissions.'
        : 'Export parent chain must not be group or world writable.',
    );
  }
}

async function verifyDirectoryHandle(
  handle: FileHandle,
  expectedPath: string,
  trustedUid: number,
  finalParent: boolean,
): Promise<void> {
  const descriptorStats = await handle.stat();
  assertDirectoryTrust(descriptorStats, trustedUid, finalParent);

  let resolvedDescriptor: string;
  let namedStats: Awaited<ReturnType<typeof lstat>>;
  try {
    [resolvedDescriptor, namedStats] = await Promise.all([
      realpath(descriptorPath(handle)),
      lstat(expectedPath),
    ]);
  } catch {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_CHANGED',
      'Export parent changed after secure open.',
    );
  }
  if (
    resolvedDescriptor !== expectedPath ||
    namedStats.isSymbolicLink() ||
    !sameInode(descriptorStats, namedStats)
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_CHANGED',
      'Export parent changed after secure open.',
    );
  }
}

async function closeHandles(handles: FileHandle[]): Promise<void> {
  for (const handle of [...handles].reverse()) {
    await handle.close().catch(() => undefined);
  }
}

async function openTrustedExportParent(
  filePath: string,
  options: TombstoneExportSecurityOptions,
): Promise<TrustedExportParent> {
  const canonicalFilePath = canonicalizeTombstoneExportPath(filePath);
  const segments = canonicalFilePath.slice(1).split('/');
  const filename = segments.pop();
  if (!filename) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_PATH_INVALID', 'Export filename is missing.');
  }
  const trustedUid = options.trustedUid ?? 0;
  const handles: FileHandle[] = [];
  let expectedPath = '/';

  try {
    let parent = await open(
      '/',
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    handles.push(parent);
    await verifyDirectoryHandle(parent, expectedPath, trustedUid, segments.length === 0);

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      expectedPath = join(expectedPath, segment);
      try {
        parent = await open(
          join(descriptorPath(parent), segment),
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
        );
      } catch (error) {
        if (isNodeError(error, 'ELOOP') || isNodeError(error, 'ENOTDIR')) {
          tombstoneError(
            'NPC_TOMBSTONE_EXPORT_SYMLINK',
            'Export parent chain contains a symbolic link.',
          );
        }
        if (isNodeError(error, 'ENOENT')) {
          tombstoneError(
            'NPC_TOMBSTONE_EXPORT_PARENT_INVALID',
            'Export parent does not exist.',
          );
        }
        throw error;
      }
      handles.push(parent);
      await verifyDirectoryHandle(
        parent,
        expectedPath,
        trustedUid,
        index === segments.length - 1,
      );
    }

    await options.onParentVerified?.();
    await verifyDirectoryHandle(parent, expectedPath, trustedUid, true);
    return {
      canonicalFilePath,
      canonicalParentPath: expectedPath,
      entryPath: join(descriptorPath(parent), filename),
      parent,
      handles,
      trustedUid,
    };
  } catch (error) {
    await closeHandles(handles);
    throw error;
  }
}

async function withTrustedExportParent<T>(
  filePath: string,
  options: TombstoneExportSecurityOptions,
  callback: (context: TrustedExportParent) => Promise<T>,
): Promise<T> {
  const context = await openTrustedExportParent(filePath, options);
  try {
    return await callback(context);
  } finally {
    await closeHandles(context.handles);
  }
}

const OPERATION_ARGUMENT_KEYS = [
  'protocolVersion',
  'submissionId',
  'expectedInitialStatus',
  'expectedPageCount',
  'expectedReportId',
  'expectedReportStatus',
  'expectedReportVisibility',
  'reason',
  'actorId',
  'actorRole',
] as const;
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

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function validString(value: unknown): value is string {
  return typeof value === 'string';
}

function validNullableString(value: unknown): boolean {
  return value === null || validString(value);
}

function validNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function validNullableNumber(value: unknown): boolean {
  return value === null || validNumber(value);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' &&
    !Number.isNaN(new Date(value).getTime()) &&
    new Date(value).toISOString() === value;
}

function validNullableDate(value: unknown): boolean {
  return value === null || validDate(value);
}

function validCommitment(value: unknown, nullable = true): boolean {
  if (nullable && value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const commitment = value as Record<string, unknown>;
  return hasExactKeys(commitment, ['redacted', 'sha256', 'byteLength']) &&
    commitment.redacted === true &&
    typeof commitment.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(commitment.sha256) &&
    Number.isSafeInteger(commitment.byteLength) &&
    (commitment.byteLength as number) >= 0;
}

function validCommonRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    hasExactKeys(value as Record<string, unknown>, keys);
}

function validSubmission(value: unknown): value is Record<string, CanonicalValue> {
  if (!validCommonRecord(value, SUBMISSION_KEYS)) return false;
  return ['id', 'studentId', 'subject', 'title', 'sourceType', 'status'].every((key) => validString(value[key])) &&
    validDate(value.createdAt) && validDate(value.updatedAt) &&
    ['coachId', 'gradeLevel', 'description', 'sourceId', 'unavailableReason', 'ocrText', 'ocrError', 'aiJobId', 'mimeType']
      .every((key) => validNullableString(value[key])) &&
    validNullableDate(value.unavailableAt) && validCommitment(value.storedFilePath) &&
    validNullableNumber(value.fileSizeBytes);
}

function validPage(value: unknown): value is Record<string, CanonicalValue> {
  if (!validCommonRecord(value, PAGE_KEYS)) return false;
  return ['id', 'submissionId', 'status', 'documentType'].every((key) => validString(value[key])) &&
    validDate(value.createdAt) && validDate(value.updatedAt) &&
    Number.isSafeInteger(value.pageNumber) && (value.pageNumber as number) > 0 &&
    ['unavailableReason', 'originalFilename', 'mimeType', 'sha256', 'uploadedById', 'ocrText']
      .every((key) => validNullableString(value[key])) &&
    validNullableDate(value.unavailableAt) && validCommitment(value.originalFilePath, false) &&
    validCommitment(value.convertedFilePaths, false) &&
    ['sizeBytes', 'ocrConfidence', 'width', 'height'].every((key) => validNullableNumber(value[key]));
}

function validReport(value: unknown): value is Record<string, CanonicalValue> {
  if (!validCommonRecord(value, REPORT_KEYS)) return false;
  return ['id', 'studentId', 'status', 'visibility'].every((key) => validString(value[key])) &&
    validDate(value.createdAt) && validDate(value.updatedAt) &&
    ['copySubmissionId', 'coachId', 'coachNotes', 'studentSummary'].every((key) => validNullableString(value[key])) &&
    validCommitment(value.diagnostic, false) && validCommitment(value.rawAiOutput) &&
    validCommitment(value.validatedAiOutput) &&
    Array.isArray(value.strengths) && value.strengths.every(validString) &&
    Array.isArray(value.weaknesses) && value.weaknesses.every(validString) &&
    validNullableDate(value.sentToStudentAt) && validNullableDate(value.readByStudentAt);
}

function validJob(value: unknown): value is Record<string, CanonicalValue> {
  if (!validCommonRecord(value, JOB_KEYS)) return false;
  return ['id', 'type', 'status', 'priority'].every((key) => validString(value[key])) &&
    validDate(value.createdAt) && validDate(value.updatedAt) &&
    ['copySubmissionId', 'claimedBy', 'chutesRequestId', 'modelVersion'].every((key) => validNullableString(value[key])) &&
    validCommitment(value.inputData) && validCommitment(value.outputData) && validCommitment(value.errorMessage) &&
    Number.isSafeInteger(value.retryCount) && Number.isSafeInteger(value.maxRetries) &&
    ['claimedAt', 'startedAt', 'completedAt', 'nextRetryAt'].every((key) => validNullableDate(value[key])) &&
    ['processingDurationMs', 'tokensUsed'].every((key) => validNullableNumber(value[key]));
}

function validAudit(value: unknown): value is Record<string, CanonicalValue> {
  if (!validCommonRecord(value, AUDIT_KEYS)) return false;
  return ['id', 'action', 'actorId', 'actorRole', 'entityType', 'entityId'].every((key) => validString(value[key])) &&
    validDate(value.createdAt) && validNullableString(value.reportId) && validCommitment(value.details);
}

function validateOperation(value: unknown): TombstoneExportEnvelope['payload']['operation'] {
  if (!validCommonRecord(value, ['operationKey', 'auditId', 'arguments', 'generatedAt'])) {
    invalidExport('Export operation shape is invalid.');
  }
  const operation = value as Record<string, unknown>;
  if (!validCommonRecord(operation.arguments, OPERATION_ARGUMENT_KEYS)) {
    invalidExport('Export operation arguments are invalid.');
  }
  const fields = operation.arguments as unknown as TombstoneOperationKeyFields;
  if (
    fields.protocolVersion !== NPC_TOMBSTONE_PROTOCOL_VERSION ||
    typeof fields.submissionId !== 'string' ||
    !TOMBSTONE_INITIAL_STATUSES.includes(fields.expectedInitialStatus) ||
    fields.expectedPageCount !== 4 ||
    typeof fields.expectedReportId !== 'string' ||
    !TOMBSTONE_REPORT_STATUSES.includes(fields.expectedReportStatus) ||
    !TOMBSTONE_REPORT_VISIBILITIES.includes(fields.expectedReportVisibility) ||
    typeof fields.reason !== 'string' ||
    typeof fields.actorId !== 'string' ||
    !TOMBSTONE_ACTOR_ROLES.includes(fields.actorRole) ||
    !validDate(operation.generatedAt)
  ) {
    invalidExport('Export operation values are invalid.');
  }
  const identity = buildTombstoneOperationIdentity({
    ...fields,
    exportFile: '/validated/export.json',
  });
  if (operation.operationKey !== identity.operationKey || operation.auditId !== identity.auditId) {
    invalidExport('Export operation identity is invalid.');
  }
  return operation as unknown as TombstoneExportEnvelope['payload']['operation'];
}

function validateSnapshot(value: unknown): TombstoneSnapshot {
  if (!validCommonRecord(value, ['submission', 'pages', 'report', 'job', 'audits', 'snapshotSha256'])) {
    invalidExport('Export snapshot shape is invalid.');
  }
  const snapshot = value as unknown as TombstoneSnapshot;
  if (
    !validSubmission(snapshot.submission) ||
    !Array.isArray(snapshot.pages) ||
    snapshot.pages.length === 0 ||
    !snapshot.pages.every(validPage) ||
    !validReport(snapshot.report) ||
    !validJob(snapshot.job) ||
    !Array.isArray(snapshot.audits) ||
    !snapshot.audits.every(validAudit) ||
    !/^[a-f0-9]{64}$/.test(snapshot.snapshotSha256)
  ) {
    invalidExport('Export snapshot records are incomplete.');
  }
  const submissionId = snapshot.submission.id;
  const reportId = snapshot.report.id;
  const pageIds = new Set(snapshot.pages.map((page) => page.id));
  if (
    new Set(snapshot.pages.map((page) => page.pageNumber)).size !== snapshot.pages.length ||
    snapshot.pages.some((page) => page.submissionId !== submissionId) ||
    snapshot.report.copySubmissionId !== submissionId ||
    snapshot.job.copySubmissionId !== submissionId ||
    snapshot.submission.aiJobId !== snapshot.job.id ||
    snapshot.audits.some((audit) =>
      audit.entityId !== submissionId &&
      audit.entityId !== reportId &&
      !pageIds.has(audit.entityId) &&
      audit.reportId !== reportId)
  ) {
    invalidExport('Export snapshot links are inconsistent.');
  }
  const { snapshotSha256, ...content } = snapshot;
  if (sha256(canonicalJson(snapshotContent(content))) !== snapshotSha256) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_HASH_MISMATCH', 'Snapshot hash does not match.');
  }
  return snapshot;
}

function validateEnvelope(value: unknown): TombstoneExportEnvelope {
  if (!validCommonRecord(value, ['format', 'version', 'payload', 'payloadSha256'])) {
    invalidExport('Export envelope shape is invalid.');
  }
  const source = value as Record<string, unknown>;
  if (
    source.format !== 'nexus-npc-tombstone-export' ||
    source.version !== 1 ||
    !validCommonRecord(source.payload, ['protocolVersion', 'operation', 'snapshot']) ||
    typeof source.payloadSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(source.payloadSha256)
  ) {
    invalidExport('Export envelope is not supported.');
  }
  const payload = source.payload as Record<string, unknown>;
  if (payload.protocolVersion !== NPC_TOMBSTONE_PROTOCOL_VERSION) {
    invalidExport('Export protocol is not supported.');
  }
  validateOperation(payload.operation);
  validateSnapshot(payload.snapshot);
  if (sha256(canonicalJson(payload)) !== source.payloadSha256) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_HASH_MISMATCH', 'Export payload hash does not match.');
  }
  return value as unknown as TombstoneExportEnvelope;
}

async function assertOpenedFile(
  context: TrustedExportParent,
  handle: Awaited<ReturnType<typeof open>>,
): Promise<void> {
  await verifyDirectoryHandle(
    context.parent,
    context.canonicalParentPath,
    context.trustedUid,
    true,
  );
  const [descriptorStats, namedStats] = await Promise.all([
    handle.stat(),
    lstat(context.entryPath),
  ]);
  if (
    !descriptorStats.isFile() ||
    !namedStats.isFile() ||
    namedStats.isSymbolicLink() ||
    descriptorStats.dev !== namedStats.dev ||
    descriptorStats.ino !== namedStats.ino
  ) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Export path is not a stable regular file.');
  }
  if ((descriptorStats.mode & 0o777) !== 0o600) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_PERMISSIONS', 'Export file must have mode 0600.');
  }
  if (descriptorStats.uid !== context.trustedUid) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_OWNER', 'Export file has an untrusted owner.');
  }
}

async function readEntireHandle(
  handle: Awaited<ReturnType<typeof open>>,
): Promise<Buffer> {
  const stats = await handle.stat();
  if (!Number.isSafeInteger(stats.size) || stats.size <= 0 || stats.size > 32 * 1024 * 1024) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export file size is invalid.');
  }
  const bytes = Buffer.alloc(stats.size);
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
    if (bytesRead === 0) {
      tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export ended during verified readback.');
    }
    offset += bytesRead;
  }
  return bytes;
}

function parseVerifiedBytes(
  bytes: Buffer,
  canonicalFilePath: string,
): VerifiedTombstoneExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export is not valid JSON.');
  }
  const envelope = validateEnvelope(parsed);
  return {
    envelope,
    bytes,
    payloadSha256: envelope.payloadSha256,
    canonicalFilePath,
  };
}

export async function writeVerifiedTombstoneExport(
  filePath: string,
  envelope: TombstoneExportEnvelope,
  options: TombstoneExportSecurityOptions = {},
): Promise<VerifiedTombstoneExport> {
  return withTrustedExportParent(filePath, options, async (context) => {
    try {
      const existing = await lstat(context.entryPath);
      if (existing.isSymbolicLink()) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Export destination is a symbolic link.');
      }
      tombstoneError('NPC_TOMBSTONE_EXPORT_EXISTS', 'Export destination already exists.');
    } catch (error) {
      if (!isNodeError(error, 'ENOENT')) throw error;
    }

    const flags = constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(context.entryPath, flags, 0o600);
    } catch (error) {
      if (isNodeError(error, 'ELOOP')) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Export destination is a symbolic link.');
      }
      if (isNodeError(error, 'EEXIST')) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_EXISTS', 'Export destination already exists.');
      }
      throw error;
    }
    options.onFileOpened?.(flags);

    try {
      await handle.chmod(0o600);
      const bytes = Buffer.from(`${canonicalJson(envelope)}\n`, 'utf8');
      await handle.writeFile(bytes);
      await handle.sync();
      options.onFileSynced?.();
      await assertOpenedFile(context, handle);
      const persistedBytes = await readEntireHandle(handle);
      const verified = parseVerifiedBytes(
        persistedBytes,
        context.canonicalFilePath,
      );
      if (!persistedBytes.equals(bytes)) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export changed during physical verification.');
      }

      await verifyDirectoryHandle(
        context.parent,
        context.canonicalParentPath,
        context.trustedUid,
        true,
      );
      await context.parent.sync();
      return verified;
    } finally {
      await handle.close();
    }
  });
}

export async function readVerifiedTombstoneExport(
  filePath: string,
  options: TombstoneExportSecurityOptions = {},
): Promise<VerifiedTombstoneExport> {
  return withTrustedExportParent(filePath, options, async (context) => {
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(
        context.entryPath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
    } catch (error) {
      if (isNodeError(error, 'ELOOP')) {
        tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Export destination is a symbolic link.');
      }
      throw error;
    }
    try {
      await assertOpenedFile(context, handle);
      return parseVerifiedBytes(
        await readEntireHandle(handle),
        context.canonicalFilePath,
      );
    } finally {
      await handle.close();
    }
  });
}
