import { isAbsolute, resolve, relative } from 'path';

/**
 * Single source of truth for document storage root.
 *
 * Used by: download routes, admin upload, coach upload, payment validation.
 *
 * Production: DOCUMENT_STORAGE_ROOT is REQUIRED and must be absolute.
 * Dev/test: falls back to cwd/storage/documents.
 */

export function getDocumentStorageRoot(): string {
  const envValue = process.env.DOCUMENT_STORAGE_ROOT;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!envValue) {
      throw new Error(
        'DOCUMENT_STORAGE_ROOT is required in production. ' +
        'Set it in /etc/nexus/nexus-prod.env to a persistent absolute path.'
      );
    }
    if (!isAbsolute(envValue)) {
      throw new Error(
        'DOCUMENT_STORAGE_ROOT must be an absolute path in production.'
      );
    }
    return envValue;
  }

  return envValue ? resolve(envValue) : resolve(process.cwd(), 'storage', 'documents');
}

/** Legacy prefix stored in DB by older upload routes (/app/storage/documents/). */
export const LEGACY_STORAGE_PREFIX = '/app/storage/documents/';

/**
 * Convert an absolute storage path to a relative path for DB storage.
 *
 * Uploads should call this before persisting localPath so that documents
 * survive release swaps (the storage root is outside any release directory).
 *
 * @param absolutePath - The absolute file path (e.g. from path.join(root, filename))
 * @returns Relative path from storage root (e.g. "userId/filename.pdf")
 * @throws if the path is not under the storage root
 */
export function toRelativeStoragePath(absolutePath: string): string {
  const root = getDocumentStorageRoot();
  const rel = relative(root, absolutePath);
  if (!rel || isAbsolute(rel) || rel.startsWith('..')) {
    throw new Error('Path is not under the document storage root');
  }
  return rel;
}
