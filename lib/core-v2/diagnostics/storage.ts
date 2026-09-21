import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { getDocumentStorageRoot } from '@/lib/documents/storage-root';
import { openSecureDocument, type SecureDocument } from '@/lib/documents/secure-file-access';

/**
 * Candidate-diagnostics document storage: a dedicated subtree of the
 * shared DOCUMENT_STORAGE_ROOT — never a release/build directory (see
 * lib/documents/storage-root.ts's own contract: the storage root is kept
 * outside any directory a release swap or rebuild could sweep).
 *
 * Deposits flow through three zones under this root:
 *   _incoming/   — staged, unverified bytes (mission §4: a copy that isn't
 *                  yet fully written, checked and scanned is never exposed
 *                  as an available submission).
 *   <assignmentId>/ — a promoted, AV-clean, verified deposit — the only
 *                  zone a DiagnosticSubmission row may ever reference.
 *   _quarantine/ — AV-rejected or orphaned (DB write failed after the file
 *                  was finalized) files. Never deleted — evidence is kept,
 *                  never silently erased.
 *
 * `writeDiagnosticStorageFile` itself is O_CREAT|O_EXCL (never overwrites),
 * but that alone is not the completeness proof — `verifyStagedFile` below
 * is the actual "written completely and matches what the caller computed
 * before writing" check the mission requires.
 */
const SUBTREE = 'candidat-libre-diagnostics';
const INCOMING_DIR = '_incoming';
const QUARANTINE_DIR = '_quarantine';

export function diagnosticsStorageRoot(): string {
  return join(getDocumentStorageRoot(), SUBTREE);
}

/**
 * The physical filename is an opaque random token, never the DB version
 * number: the version lives in DiagnosticSubmission.version (the business
 * "which deposit is current" fact); the filename only needs to never
 * collide, which a fresh random token guarantees without depending on the
 * DB write happening first.
 */
export function diagnosticSubmissionRelativePath(assignmentId: string, token: string, extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const safeToken = token.replace(/[^a-z0-9-]/gi, '');
  return join(assignmentId, `${safeToken}.${safeExt}`);
}

export function diagnosticStagingRelativePath(token: string, extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const safeToken = token.replace(/[^a-z0-9-]/gi, '');
  return join(INCOMING_DIR, `${safeToken}.${safeExt}`);
}

export function diagnosticQuarantineRelativePath(token: string, extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const safeToken = token.replace(/[^a-z0-9-]/gi, '');
  return join(QUARANTINE_DIR, `${safeToken}.${safeExt}`);
}

export function diagnosticInstrumentSubjectRelativePath(instrumentRefId: string): string {
  return join('_instruments', `${instrumentRefId}.pdf`);
}

function assertContained(root: string, destination: string): void {
  const rel = relative(root, destination);
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error('Destination escapes the diagnostics storage root.');
  }
}

/** Writes once, never overwrites. Throws (EEXIST) if the destination already exists. */
export async function writeDiagnosticStorageFile(relativePath: string, bytes: Buffer): Promise<void> {
  const root = diagnosticsStorageRoot();
  const destination = resolve(root, relativePath);
  assertContained(root, destination);

  await mkdir(dirname(destination), { recursive: true, mode: 0o750 });
  const handle = await open(destination, 'wx', 0o640);
  try {
    await handle.writeFile(bytes);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(destination).catch(() => undefined);
    throw error;
  }
  await handle.close();
}

/**
 * The actual "written completely, not corrupted, matches what the caller
 * computed before writing" proof: re-stats and re-reads the file from disk
 * (never trusts the in-memory buffer that was already written) and
 * compares size and sha256 against what the caller expected. A mismatch
 * means the write did not complete as intended — the caller must quarantine
 * the file and refuse to ever reference it from a DB row.
 */
export async function verifyStagedFile(
  relativePath: string,
  expected: { sizeBytes: number; sha256: string },
): Promise<{ ok: boolean; actualSizeBytes: number; actualSha256: string }> {
  const root = diagnosticsStorageRoot();
  const absolutePath = resolve(root, relativePath);
  assertContained(root, absolutePath);

  const stats = await stat(absolutePath);
  const bytesOnDisk = await readFile(absolutePath);
  const actualSha256 = createHash('sha256').update(bytesOnDisk).digest('hex');
  const ok = stats.size === expected.sizeBytes && actualSha256 === expected.sha256;
  return { ok, actualSizeBytes: stats.size, actualSha256 };
}

/** Atomic rename within the storage root — used to promote staging → final, or staging/final → quarantine. */
export async function moveDiagnosticStorageFile(fromRelativePath: string, toRelativePath: string): Promise<void> {
  const root = diagnosticsStorageRoot();
  const from = resolve(root, fromRelativePath);
  const to = resolve(root, toRelativePath);
  assertContained(root, from);
  assertContained(root, to);
  await mkdir(dirname(to), { recursive: true, mode: 0o750 });
  await rename(from, to);
}

export async function deleteDiagnosticStagingFile(relativePath: string): Promise<void> {
  const root = diagnosticsStorageRoot();
  const absolutePath = resolve(root, relativePath);
  assertContained(root, absolutePath);
  await unlink(absolutePath).catch(() => undefined);
}

/** Idempotent variant for catalog-fixture seeding only: replaces an existing file at the same path. */
export async function writeDiagnosticStorageFixture(relativePath: string, bytes: Buffer): Promise<void> {
  const root = diagnosticsStorageRoot();
  const destination = resolve(root, relativePath);
  assertContained(root, destination);

  await mkdir(dirname(destination), { recursive: true, mode: 0o750 });
  const handle = await open(destination, 'w', 0o640);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
}

export async function readDiagnosticStorageFile(relativePath: string, maxSizeBytes?: number): Promise<SecureDocument> {
  return openSecureDocument(diagnosticsStorageRoot(), relativePath, { maxSizeBytes });
}
