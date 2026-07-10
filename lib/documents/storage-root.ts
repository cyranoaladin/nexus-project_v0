import { resolve } from 'path';

/**
 * Single source of truth for document storage root.
 *
 * Used by: download route, admin upload, coach upload, payment validation.
 * Env-configurable via DOCUMENT_STORAGE_ROOT, defaults to cwd/storage/documents.
 */
export function getDocumentStorageRoot(): string {
  return process.env.DOCUMENT_STORAGE_ROOT || resolve(process.cwd(), 'storage', 'documents');
}

/** Legacy prefix stored in DB by older upload routes (/app/storage/documents/). */
export const LEGACY_STORAGE_PREFIX = '/app/storage/documents/';
