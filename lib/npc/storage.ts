import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { serializeError } from '@/lib/utils/serialize-error';
import { SECURE_FILE_ID_LENGTH } from './config';
import {
  deleteNpcStorageFile,
  ensureNpcStorageDirectory,
  npcStorageFileExists,
  readNpcStorageFile,
  removeNpcStorageDirectory,
  resolveNpcStoragePath,
  writeNpcStorageFileAtomic,
} from './storage-root';

export interface StorageResult {
  success: boolean;
  error?: string;
  secureId?: string;
  filePath?: string;
  relativePath?: string;
  sha256?: string;
}

export interface FileMetadata {
  secureId: string;
  originalName: string;
  sanitizedName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  studentId: string;
  submissionId: string;
  pageNumber?: number;
}

export function generateSecureFileId(): string {
  return randomBytes(SECURE_FILE_ID_LENGTH).toString('hex');
}

function entityPrefix(value: string, length: number, label: string): string {
  if (value.length < length || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid NPC storage ${label} segment`);
  }

  return value.slice(0, length);
}

function fileSegment(filename: string): string {
  if (
    !filename ||
    filename === '.' ||
    filename === '..' ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0')
  ) {
    throw new Error('Invalid NPC storage filename segment');
  }

  return filename;
}

export function generateSecureRelativePath(
  studentId: string,
  submissionId: string,
  pageNumber: number,
  filename: string,
): string {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 0) {
    throw new Error('Invalid NPC storage page segment');
  }

  return path.join(
    entityPrefix(studentId, 8, 'student'),
    entityPrefix(submissionId, 12, 'submission'),
    `page_${pageNumber}`,
    fileSegment(filename),
  );
}

export async function generateSecurePath(
  studentId: string,
  submissionId: string,
  pageNumber: number,
  filename: string,
): Promise<string> {
  return resolveNpcStoragePath(
    generateSecureRelativePath(
      studentId,
      submissionId,
      pageNumber,
      filename,
    ),
  );
}

export async function ensureDirectory(
  relativeDirectory: string,
): Promise<string> {
  return ensureNpcStorageDirectory(relativeDirectory);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

export async function saveUploadedFile(
  fileBuffer: Buffer,
  metadata: FileMetadata,
): Promise<StorageResult> {
  try {
    if (!metadata.studentId || !metadata.submissionId) {
      return { success: false, error: 'MISSING_ENTITY_IDS' };
    }

    const relativePath = generateSecureRelativePath(
      metadata.studentId,
      metadata.submissionId,
      metadata.pageNumber ?? 1,
      metadata.sanitizedName,
    );
    const persisted = await writeNpcStorageFileAtomic(
      relativePath,
      fileBuffer,
      metadata.sizeBytes,
    );

    return {
      success: true,
      secureId: metadata.secureId,
      filePath: persisted.filePath,
      relativePath,
      sha256: persisted.sha256,
    };
  } catch (error) {
    if (hasErrorCode(error, 'NPC_STORAGE_SIZE_MISMATCH')) {
      return { success: false, error: 'SIZE_MISMATCH_AFTER_WRITE' };
    }
    console.error('[NPC Storage] Save failed:', serializeError(error));
    return { success: false, error: 'SAVE_FAILED' };
  }
}

export async function readSecureFile(
  relativePath: string,
): Promise<Buffer | null> {
  try {
    return await readNpcStorageFile(relativePath);
  } catch (error) {
    console.error('[NPC Storage] Read failed:', serializeError(error));
    return null;
  }
}

export async function deleteSecureFile(
  relativePath: string,
): Promise<boolean> {
  try {
    await deleteNpcStorageFile(relativePath);
    return true;
  } catch (error) {
    console.error('[NPC Storage] Delete failed:', serializeError(error));
    return false;
  }
}

export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    return await npcStorageFileExists(relativePath);
  } catch {
    return false;
  }
}

export async function deleteSubmissionFiles(
  studentId: string,
  submissionId: string,
): Promise<boolean> {
  try {
    const relativeSubmissionDirectory = path.join(
      entityPrefix(studentId, 8, 'student'),
      entityPrefix(submissionId, 12, 'submission'),
    );
    await removeNpcStorageDirectory(relativeSubmissionDirectory);
    return true;
  } catch (error) {
    console.error('[NPC Storage] Cleanup failed:', serializeError(error));
    return false;
  }
}

export const STORAGE_ERRORS: Record<string, string> = {
  MISSING_ENTITY_IDS: 'IDs étudiant/soumission manquants',
  SIZE_MISMATCH_AFTER_WRITE: 'Erreur de taille après écriture',
  SAVE_FAILED: 'Échec de la sauvegarde du fichier',
  PATH_TRAVERSAL: 'Tentative de traversée de répertoire détectée',
};
