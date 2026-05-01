// ═══════════════════════════════════════════════════════════════════════════════
// NPC - NEXUS PEDAGOGY COCKPIT — Secure File Storage
// Server-side only - handles secure path generation and file operations
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { NPC_UPLOAD_DIR, SECURE_FILE_ID_LENGTH } from './config';
import { sanitizeFilename } from './file-validator';

// ─── Types ───

export interface StorageResult {
  success: boolean;
  error?: string;
  secureId?: string;
  filePath?: string;
  relativePath?: string;
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

// ─── Secure Path Generation ───

/**
 * Generate cryptographically secure random ID
 */
export function generateSecureFileId(): string {
  return randomBytes(SECURE_FILE_ID_LENGTH).toString('hex');
}

/**
 * Generate secure directory structure
 * Format: uploads/copies/{studentId}/{submissionId}/{pageNumber}/
 * This prevents enumeration attacks and organizes by entity
 */
export function generateSecurePath(
  studentId: string,
  submissionId: string,
  pageNumber: number,
  filename: string
): string {
  // Create hierarchical structure
  const baseDir = NPC_UPLOAD_DIR;
  const studentDir = path.join(baseDir, studentId.slice(0, 8)); // First 8 chars for partitioning
  const submissionDir = path.join(studentDir, submissionId.slice(0, 12));
  const pageDir = path.join(submissionDir, `page_${pageNumber}`);

  return path.join(pageDir, filename);
}

/**
 * Ensure directory exists (recursive)
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true, mode: 0o750 }); // rwxr-x---
  }
}

// ─── File Operations ───

/**
 * Save uploaded file to secure location
 * SERVER-SIDE ONLY - never expose this to client
 */
export async function saveUploadedFile(
  fileBuffer: Buffer,
  metadata: FileMetadata
): Promise<StorageResult> {
  try {
    // Validate inputs
    if (!metadata.studentId || !metadata.submissionId) {
      return { success: false, error: 'MISSING_ENTITY_IDS' };
    }

    // Generate secure path
    const filePath = generateSecurePath(
      metadata.studentId,
      metadata.submissionId,
      metadata.pageNumber || 1,
      metadata.sanitizedName
    );

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await ensureDirectory(dir);

    // Write file with restricted permissions
    await fs.writeFile(filePath, fileBuffer, { mode: 0o640 }); // rw-r-----

    // Verify file was written
    const stats = await fs.stat(filePath);
    if (stats.size !== metadata.sizeBytes) {
      // Rollback on size mismatch
      await fs.unlink(filePath).catch(() => {});
      return { success: false, error: 'SIZE_MISMATCH_AFTER_WRITE' };
    }

    // Return relative path for database storage (never return absolute path)
    const relativePath = path.relative(NPC_UPLOAD_DIR, filePath);

    return {
      success: true,
      secureId: metadata.secureId,
      filePath,
      relativePath,
    };
  } catch (error) {
    console.error('[NPC Storage] Save failed:', error);
    return { success: false, error: 'SAVE_FAILED' };
  }
}

/**
 * Read file from secure storage
 * SERVER-SIDE ONLY
 */
export async function readSecureFile(
  relativePath: string
): Promise<Buffer | null> {
  try {
    // Prevent path traversal: ensure path is within upload dir
    const absolutePath = path.resolve(NPC_UPLOAD_DIR, relativePath);
    const resolvedUploadDir = path.resolve(NPC_UPLOAD_DIR);

    if (!absolutePath.startsWith(resolvedUploadDir)) {
      console.error('[NPC Storage] Path traversal attempt:', relativePath);
      return null;
    }

    return await fs.readFile(absolutePath);
  } catch (error) {
    console.error('[NPC Storage] Read failed:', error);
    return null;
  }
}

/**
 * Delete file from secure storage
 */
export async function deleteSecureFile(
  relativePath: string
): Promise<boolean> {
  try {
    // Prevent path traversal
    const absolutePath = path.resolve(NPC_UPLOAD_DIR, relativePath);
    const resolvedUploadDir = path.resolve(NPC_UPLOAD_DIR);

    if (!absolutePath.startsWith(resolvedUploadDir)) {
      console.error('[NPC Storage] Path traversal attempt:', relativePath);
      return false;
    }

    await fs.unlink(absolutePath);
    return true;
  } catch (error) {
    console.error('[NPC Storage] Delete failed:', error);
    return false;
  }
}

/**
 * Check if file exists
 */
export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    // Prevent path traversal
    const absolutePath = path.resolve(NPC_UPLOAD_DIR, relativePath);
    const resolvedUploadDir = path.resolve(NPC_UPLOAD_DIR);

    if (!absolutePath.startsWith(resolvedUploadDir)) {
      return false;
    }

    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

// ─── Directory Cleanup ───

/**
 * Delete all files associated with a submission
 */
export async function deleteSubmissionFiles(
  studentId: string,
  submissionId: string
): Promise<boolean> {
  try {
    const baseDir = NPC_UPLOAD_DIR;
    const studentDir = path.join(baseDir, studentId.slice(0, 8));
    const submissionDir = path.join(studentDir, submissionId.slice(0, 12));

    // Verify path is within upload directory
    const resolvedUploadDir = path.resolve(NPC_UPLOAD_DIR);
    const resolvedSubmissionDir = path.resolve(submissionDir);

    if (!resolvedSubmissionDir.startsWith(resolvedUploadDir)) {
      console.error('[NPC Storage] Path traversal attempt in cleanup');
      return false;
    }

    // Remove submission directory recursively
    await fs.rm(submissionDir, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error('[NPC Storage] Cleanup failed:', error);
    return false;
  }
}

// ─── Error Messages ───

export const STORAGE_ERRORS: Record<string, string> = {
  MISSING_ENTITY_IDS: 'IDs étudiant/soumission manquants',
  SIZE_MISMATCH_AFTER_WRITE: 'Erreur de taille après écriture',
  SAVE_FAILED: 'Échec de la sauvegarde du fichier',
  PATH_TRAVERSAL: 'Tentative de traversée de répertoire détectée',
};
