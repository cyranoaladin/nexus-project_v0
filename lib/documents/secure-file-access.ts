import { realpath, stat } from 'fs/promises';
import { resolve, sep } from 'path';

/**
 * Secure file access — canonical containment for document downloads.
 *
 * Resolves a raw path (from DB or user input) against a storage root,
 * then verifies containment using realpath on BOTH sides to handle symlinks.
 *
 * @throws {SecureFileAccessError} with a safe error code (no path leakage)
 */

export type SecureFileAccessErrorCode =
  | 'ABSOLUTE_PATH_REJECTED'
  | 'PATH_ESCAPE'
  | 'FILE_NOT_FOUND'
  | 'NOT_REGULAR_FILE'
  | 'FILE_TOO_LARGE';

export class SecureFileAccessError extends Error {
  constructor(
    public readonly code: SecureFileAccessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SecureFileAccessError';
  }
}

export interface ResolvedSecurePath {
  /** Canonical absolute path, safe to read */
  canonicalPath: string;
  /** File size in bytes */
  sizeBytes: number;
}

export interface SecureFileAccessOptions {
  /** Maximum file size in bytes (default: 25 MiB) */
  maxSizeBytes?: number;
  /** Legacy path prefix to strip before resolving (e.g. '/app/storage/documents/') */
  legacyPrefixToStrip?: string;
}

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024; // 25 MiB

/**
 * Resolve and contain a file path within a storage root.
 *
 * Procedure:
 * 1. Reject absolute paths (unless legacy prefix is stripped first)
 * 2. Resolve relative path against storageRoot
 * 3. realpath BOTH storageRoot and resolved path
 * 4. Verify canonical path is strictly inside canonical root
 * 5. Verify target is a regular file (not device, socket, dir, pipe)
 * 6. Verify size is within limit
 */
export async function resolveSecurePath(
  storageRoot: string,
  rawPath: string,
  options: SecureFileAccessOptions = {},
): Promise<ResolvedSecurePath> {
  const maxSize = options.maxSizeBytes ?? DEFAULT_MAX_SIZE;

  // Strip legacy prefix if configured
  let normalizedPath = rawPath;
  if (options.legacyPrefixToStrip && normalizedPath.startsWith(options.legacyPrefixToStrip)) {
    normalizedPath = normalizedPath.slice(options.legacyPrefixToStrip.length);
  }

  // Reject absolute paths after prefix stripping
  if (normalizedPath.startsWith('/') || normalizedPath.startsWith('\\') || /^[A-Za-z]:/.test(normalizedPath)) {
    throw new SecureFileAccessError('ABSOLUTE_PATH_REJECTED', 'Absolute paths are not allowed');
  }

  // Reject URL-encoded traversal
  if (normalizedPath.includes('%2e') || normalizedPath.includes('%2E') || normalizedPath.includes('%00')) {
    throw new SecureFileAccessError('PATH_ESCAPE', 'Encoded traversal detected');
  }

  // Resolve against storage root
  const resolvedPath = resolve(storageRoot, normalizedPath);

  // Canonicalize BOTH paths via realpath (follows symlinks)
  let canonicalRoot: string;
  let canonicalPath: string;
  try {
    canonicalRoot = await realpath(storageRoot);
  } catch {
    throw new SecureFileAccessError('FILE_NOT_FOUND', 'Storage root is not accessible');
  }

  try {
    canonicalPath = await realpath(resolvedPath);
  } catch {
    throw new SecureFileAccessError('FILE_NOT_FOUND', 'File does not exist');
  }

  // Containment check using path separator
  const canonicalPrefix = canonicalRoot.endsWith(sep) ? canonicalRoot : `${canonicalRoot}${sep}`;
  if (!canonicalPath.startsWith(canonicalPrefix)) {
    throw new SecureFileAccessError('PATH_ESCAPE', 'Path escapes storage root');
  }

  // Verify it's a regular file
  const fileStat = await stat(canonicalPath);
  if (!fileStat.isFile()) {
    throw new SecureFileAccessError('NOT_REGULAR_FILE', 'Target is not a regular file');
  }

  // Size check
  if (fileStat.size > maxSize) {
    throw new SecureFileAccessError('FILE_TOO_LARGE', 'File exceeds size limit');
  }

  return { canonicalPath, sizeBytes: fileStat.size };
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

export function safeFilename(name: string): string {
  return encodeURIComponent(name.replace(/[\\/\r\n"]/g, '_'));
}
