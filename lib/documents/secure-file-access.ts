import { open, realpath } from 'fs/promises';
import { relative, resolve, sep, isAbsolute } from 'path';
import type { FileHandle } from 'fs/promises';

/**
 * Secure file access — canonical containment for document downloads.
 *
 * Accepts three historical path representations:
 * 1. Relative paths resolved against the storage root
 * 2. Paths with a legacy prefix (e.g. /app/storage/documents/) — prefix stripped first
 * 3. Absolute paths that, after realpath canonicalization, fall inside the storage root
 *
 * Containment uses realpath on BOTH sides to handle symlinks, then verifies
 * via path.relative() that the result stays within the root.
 *
 * TOCTOU note: openSecureDocument opens the file handle BEFORE returning,
 * eliminating the gap between path validation and file read. The residual
 * risk is filesystem-level permission/mount changes, which require root
 * access and are outside the application threat model.
 */

// ── Error types ──

export type SecureFileAccessErrorCode =
  | 'INVALID_PATH_FORMAT'
  | 'PATH_ESCAPE'
  | 'FILE_NOT_FOUND'
  | 'NOT_REGULAR_FILE'
  | 'FILE_TOO_LARGE'
  | 'STORAGE_ROOT_UNAVAILABLE';

export class SecureFileAccessError extends Error {
  constructor(
    public readonly code: SecureFileAccessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SecureFileAccessError';
  }
}

// ── Types ──

export interface SecureFileAccessOptions {
  /** Maximum file size in bytes (default: 25 MiB) */
  maxSizeBytes?: number;
  /** Legacy path prefix to strip before resolving (e.g. '/app/storage/documents/') */
  legacyPrefixToStrip?: string;
}

export interface SecureDocument {
  /** Validated file handle — caller must close it */
  handle: FileHandle;
  /** File size in bytes */
  sizeBytes: number;
}

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024; // 25 MiB
const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

// ── Core: open a document securely ──

/**
 * Open a document file with full containment, returning an open FileHandle.
 *
 * Procedure:
 * 1. Reject URLs and encoded traversal sequences
 * 2. Strip legacy prefix if applicable
 * 3. Resolve the candidate path (relative → from root; absolute → as-is)
 * 4. realpath BOTH storage root and candidate
 * 5. Verify containment via path.relative (not string prefix)
 * 6. Open the file (O_RDONLY)
 * 7. fstat the open handle to verify regular file + size
 * 8. Return the open handle — caller must close it
 *
 * If any step fails, any opened handle is closed before throwing.
 */
export async function openSecureDocument(
  storageRoot: string,
  rawPath: string,
  options: SecureFileAccessOptions = {},
): Promise<SecureDocument> {
  const maxSize = options.maxSizeBytes ?? DEFAULT_MAX_SIZE;

  // Reject URL schemes
  if (URL_SCHEME_RE.test(rawPath)) {
    throw new SecureFileAccessError('INVALID_PATH_FORMAT', 'URL schemes are not allowed');
  }

  // Reject encoded traversal before any path processing
  if (/%2e/i.test(rawPath) || /%00/.test(rawPath) || /%2f/i.test(rawPath) || /%5c/i.test(rawPath)) {
    throw new SecureFileAccessError('INVALID_PATH_FORMAT', 'Encoded path components are not allowed');
  }

  // Strip legacy prefix if configured
  let normalizedPath = rawPath;
  if (options.legacyPrefixToStrip && normalizedPath.startsWith(options.legacyPrefixToStrip)) {
    normalizedPath = normalizedPath.slice(options.legacyPrefixToStrip.length);
  }

  // Build candidate path:
  // - Absolute paths → used as-is (containment verified by realpath below)
  // - Relative paths → resolved against storage root
  const candidatePath = isAbsolute(normalizedPath)
    ? resolve(normalizedPath)
    : resolve(storageRoot, normalizedPath);

  // Canonicalize BOTH paths via realpath (follows symlinks)
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(storageRoot);
  } catch {
    throw new SecureFileAccessError('STORAGE_ROOT_UNAVAILABLE', 'Storage root is not accessible');
  }

  let canonicalPath: string;
  try {
    canonicalPath = await realpath(candidatePath);
  } catch {
    throw new SecureFileAccessError('FILE_NOT_FOUND', 'File does not exist');
  }

  // Containment check via path.relative — more robust than string prefix
  const rel = relative(canonicalRoot, canonicalPath);
  if (
    !rel ||                         // empty = candidate IS the root
    isAbsolute(rel) ||              // absolute = different volume/drive
    rel === '..' ||                 // direct parent
    rel.startsWith(`..${sep}`)      // any ancestor
  ) {
    throw new SecureFileAccessError('PATH_ESCAPE', 'Path escapes storage root');
  }

  // Open the file — eliminates TOCTOU between validation and read
  let handle: FileHandle;
  try {
    handle = await open(canonicalPath, 'r');
  } catch {
    throw new SecureFileAccessError('FILE_NOT_FOUND', 'File cannot be opened');
  }

  // Validate via fstat on the OPEN handle
  try {
    const fileStat = await handle.stat();

    if (!fileStat.isFile()) {
      await handle.close();
      throw new SecureFileAccessError('NOT_REGULAR_FILE', 'Target is not a regular file');
    }

    if (fileStat.size > maxSize) {
      await handle.close();
      throw new SecureFileAccessError('FILE_TOO_LARGE', 'File exceeds size limit');
    }

    return { handle, sizeBytes: fileStat.size };
  } catch (err) {
    // Close handle on any validation error (unless already thrown above)
    if (err instanceof SecureFileAccessError) throw err;
    await handle.close().catch(() => {});
    throw new SecureFileAccessError('FILE_NOT_FOUND', 'File validation failed');
  }
}

// ── Legacy compatibility: resolveSecurePath (returns path, not handle) ──

export interface ResolvedSecurePath {
  canonicalPath: string;
  sizeBytes: number;
}

/**
 * Resolve and validate a path without opening a handle.
 * Use openSecureDocument when possible for TOCTOU-free reads.
 */
export async function resolveSecurePath(
  storageRoot: string,
  rawPath: string,
  options: SecureFileAccessOptions = {},
): Promise<ResolvedSecurePath> {
  const doc = await openSecureDocument(storageRoot, rawPath, options);
  const { sizeBytes } = doc;
  // Read the fd path for callers that need it
  const canonicalPath = await realpath(`/proc/self/fd/${(doc.handle as any).fd}`).catch(
    // Fallback: re-resolve (slight TOCTOU but only used by legacy callers)
    async () => {
      const normalized = rawPath.startsWith(options?.legacyPrefixToStrip ?? '\0')
        ? rawPath.slice((options?.legacyPrefixToStrip ?? '').length)
        : rawPath;
      const candidate = isAbsolute(normalized) ? resolve(normalized) : resolve(storageRoot, normalized);
      return realpath(candidate);
    },
  );
  await doc.handle.close();
  return { canonicalPath, sizeBytes };
}

// ── Safe HTTP response helpers ──

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

export function safeContentType(mimeType: string | null | undefined): string {
  if (!mimeType) return 'application/octet-stream';
  return ALLOWED_MIME_TYPES.has(mimeType) ? mimeType : 'application/octet-stream';
}

/**
 * Produce a safe filename for Content-Disposition headers.
 * Strips path separators, control chars, and quotes.
 * Falls back to 'document' for empty names.
 */
export function safeFilename(name: string): string {
  if (!name) return 'document';
  const cleaned = name.replace(/[\\/\r\n"\x00-\x1f]/g, '_');
  return encodeURIComponent(cleaned);
}
