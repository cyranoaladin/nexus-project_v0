import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  NPC_TOMBSTONE_PROTOCOL_VERSION,
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
  sourceIntegritySha256: string;
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
}

export interface TombstoneExportWriteHooks {
  onFileOpened?: (flags: number) => void;
  onFileSynced?: () => void;
}

const SENSITIVE_STRING = /(?:postgres(?:ql)?:\/\/|\bbearer\s+|\b(?:password|passphrase|secret|token|authorization|cookie)\s*[:=])/i;
const POSIX_ABSOLUTE_PATH = /(?:^|[\s("'=])\/(?!\/)[^\0\r\n\s]+/;
const WINDOWS_ABSOLUTE_PATH = /(?:^|[\s("'=])(?:[A-Za-z]:[\\/]|\\\\)[^\0\r\n\s]+/;

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (normalized === 'user' || normalized === 'users') return true;
  return (
    /(?:auth|authorization|password|passphrase|secret|cookie|credential|databaseurl|connectionstring|apikey)/.test(normalized) ||
    normalized.endsWith('token')
  );
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

function sanitize(value: unknown): CanonicalValue {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return '[REDACTED_BINARY]';
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'string') {
    if (/^file:\/\//i.test(value) || POSIX_ABSOLUTE_PATH.test(value) || WINDOWS_ABSOLUTE_PATH.test(value)) {
      return '[REDACTED_ABSOLUTE_PATH]';
    }
    if (SENSITIVE_STRING.test(value)) return '[REDACTED_SENSITIVE_VALUE]';
    return value;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return canonicalize(value);
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') {
    const output: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (isSensitiveKey(key)) continue;
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) output[key] = sanitize(child);
    }
    return output;
  }
  tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export contains an unsupported value.');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sanitizeRecord(value: Record<string, unknown>): Record<string, CanonicalValue> {
  return sanitize(value) as Record<string, CanonicalValue>;
}

export function buildTombstoneSnapshot(
  rawSnapshot: RawTombstoneSnapshot,
): TombstoneSnapshot {
  const sourceIntegritySha256 = sha256(canonicalJson(rawSnapshot));
  return {
    submission: sanitizeRecord(rawSnapshot.submission),
    pages: rawSnapshot.pages.map(sanitizeRecord),
    report: rawSnapshot.report ? sanitizeRecord(rawSnapshot.report) : null,
    job: rawSnapshot.job ? sanitizeRecord(rawSnapshot.job) : null,
    audits: rawSnapshot.audits.map(sanitizeRecord),
    sourceIntegritySha256,
  };
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

function validateEnvelope(value: unknown): TombstoneExportEnvelope {
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { format?: unknown }).format !== 'nexus-npc-tombstone-export' ||
    (value as { version?: unknown }).version !== 1
  ) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export envelope is not supported.');
  }
  const envelope = value as TombstoneExportEnvelope;
  const operation = envelope.payload?.operation;
  const snapshot = envelope.payload?.snapshot;
  if (
    !envelope.payload ||
    envelope.payload.protocolVersion !== NPC_TOMBSTONE_PROTOCOL_VERSION ||
    !operation ||
    typeof operation !== 'object' ||
    typeof operation.operationKey !== 'string' ||
    !/^npc-tombstone-v1:[a-f0-9]{64}$/.test(operation.operationKey) ||
    typeof operation.auditId !== 'string' ||
    !/^npc-tombstone-v1-[a-f0-9]{64}$/.test(operation.auditId) ||
    !operation.arguments ||
    typeof operation.arguments !== 'object' ||
    typeof operation.generatedAt !== 'string' ||
    Number.isNaN(new Date(operation.generatedAt).getTime()) ||
    !snapshot ||
    typeof snapshot !== 'object' ||
    !snapshot.submission ||
    typeof snapshot.submission !== 'object' ||
    !Array.isArray(snapshot.pages) ||
    !snapshot.pages.every((page) => page && typeof page === 'object' && !Array.isArray(page)) ||
    !(snapshot.report === null || (snapshot.report && typeof snapshot.report === 'object')) ||
    !(snapshot.job === null || (snapshot.job && typeof snapshot.job === 'object')) ||
    !Array.isArray(snapshot.audits) ||
    !snapshot.audits.every((audit) => audit && typeof audit === 'object' && !Array.isArray(audit)) ||
    typeof snapshot.sourceIntegritySha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(snapshot.sourceIntegritySha256) ||
    typeof envelope.payloadSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(envelope.payloadSha256)
  ) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export envelope is incomplete.');
  }
  const recomputed = sha256(canonicalJson(envelope.payload));
  if (recomputed !== envelope.payloadSha256) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_HASH_MISMATCH', 'Export payload hash does not match.');
  }
  return envelope;
}

async function assertOpenedFile(
  filePath: string,
  handle: Awaited<ReturnType<typeof open>>,
): Promise<void> {
  const [descriptorStats, namedStats] = await Promise.all([
    handle.stat(),
    lstat(filePath),
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

function parseVerifiedBytes(bytes: Buffer): VerifiedTombstoneExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export is not valid JSON.');
  }
  const envelope = validateEnvelope(parsed);
  return { envelope, bytes, payloadSha256: envelope.payloadSha256 };
}

export async function writeVerifiedTombstoneExport(
  filePath: string,
  envelope: TombstoneExportEnvelope,
  hooks: TombstoneExportWriteHooks = {},
): Promise<VerifiedTombstoneExport> {
  try {
    const existing = await lstat(filePath);
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
    handle = await open(filePath, flags, 0o600);
  } catch (error) {
    if (isNodeError(error, 'ELOOP')) {
      tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Export destination is a symbolic link.');
    }
    if (isNodeError(error, 'EEXIST')) {
      tombstoneError('NPC_TOMBSTONE_EXPORT_EXISTS', 'Export destination already exists.');
    }
    throw error;
  }
  hooks.onFileOpened?.(flags);

  try {
    await handle.chmod(0o600);
    const bytes = Buffer.from(`${canonicalJson(envelope)}\n`, 'utf8');
    await handle.writeFile(bytes);
    await handle.sync();
    hooks.onFileSynced?.();
    await assertOpenedFile(filePath, handle);
    const persistedBytes = await readEntireHandle(handle);
    const verified = parseVerifiedBytes(persistedBytes);
    if (!persistedBytes.equals(bytes)) {
      tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export changed during physical verification.');
    }

    const parent = await open(
      await realpath(dirname(filePath)),
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
    return verified;
  } finally {
    await handle.close();
  }
}

export async function readVerifiedTombstoneExport(
  filePath: string,
): Promise<VerifiedTombstoneExport> {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (isNodeError(error, 'ELOOP')) {
      tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Export destination is a symbolic link.');
    }
    throw error;
  }
  try {
    await assertOpenedFile(filePath, handle);
    return parseVerifiedBytes(await readEntireHandle(handle));
  } finally {
    await handle.close();
  }
}
