// ═══════════════════════════════════════════════════════════════════════════════
// NPC - NEXUS PEDAGOGY COCKPIT — File Validation
// Server-side validation for uploaded copy files
// ═══════════════════════════════════════════════════════════════════════════════

import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MIME_TO_EXT,
  NPC_MAX_FILE_SIZE_BYTES,
  NPC_MAX_PAGES_PER_SUBMISSION,
  FORBIDDEN_FILENAME_CHARS,
  MAX_FILENAME_LENGTH,
} from './config';

// ─── Types ───

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName?: string;
  detectedExt?: string;
}

export interface PageValidationResult {
  valid: boolean;
  error?: string;
  pageCount?: number;
}

// ─── Filename Sanitization ───

/**
 * Sanitize filename for secure storage
 * - Removes forbidden characters
 * - Limits length
 * - Prevents path traversal (no / or \\)
 * - Adds random suffix to prevent collisions
 */
export function sanitizeFilename(
  originalName: string,
  secureId: string
): string {
  // Remove extension for processing
  const lastDot = originalName.lastIndexOf('.');
  const baseName =
    lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  const originalExt =
    lastDot > 0 ? originalName.slice(lastDot + 1).toLowerCase() : '';

  // Sanitize: remove forbidden chars, replace spaces with underscores
  const sanitized = baseName
    .replace(FORBIDDEN_FILENAME_CHARS, '')
    .replace(/\s+/g, '_')
    .slice(0, 50); // Limit base name length

  // Append secure ID (first 8 chars) for uniqueness
  const uniqueSuffix = secureId.slice(0, 8);

  // Build final name with extension
  return originalExt
    ? `${sanitized}_${uniqueSuffix}.${originalExt}`
    : `${sanitized}_${uniqueSuffix}`;
}

/**
 * Validate and sanitize original filename
 */
export function validateFilename(
  filename: string,
  secureId: string
): FileValidationResult {
  // Check empty
  if (!filename || filename.trim().length === 0) {
    return { valid: false, error: 'FILENAME_EMPTY' };
  }

  // Check length
  if (filename.length > MAX_FILENAME_LENGTH) {
    return { valid: false, error: 'FILENAME_TOO_LONG' };
  }

  // Check for path traversal attempts
  if (filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'PATH_TRAVERSAL_DETECTED' };
  }

  // Check for double extensions (common attack)
  const extMatches = filename.match(/\.([a-zA-Z0-9]+)/g);
  if (extMatches && extMatches.length > 1) {
    // Check for suspicious double extensions like .pdf.exe
    const suspiciousCombos = ['.exe', '.bat', '.cmd', '.sh', '.js'];
    const lowerName = filename.toLowerCase();
    for (const susp of suspiciousCombos) {
      if (lowerName.endsWith(susp)) {
        return { valid: false, error: 'SUSPICIOUS_DOUBLE_EXTENSION' };
      }
    }
  }

  // Extract and validate extension
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return { valid: false, error: 'NO_FILE_EXTENSION' };
  }

  const ext = filename.slice(lastDot + 1).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext as any)) {
    return { valid: false, error: 'EXTENSION_NOT_ALLOWED' };
  }

  return {
    valid: true,
    sanitizedName: sanitizeFilename(filename, secureId),
    detectedExt: ext,
  };
}

// ─── MIME Type Validation ───

/**
 * Validate MIME type against allowed list
 */
export function validateMimeType(
  mimeType: string,
  declaredExt?: string
): FileValidationResult {
  const normalizedMime = mimeType.toLowerCase().trim();

  if (!ALLOWED_MIME_TYPES.includes(normalizedMime as any)) {
    return { valid: false, error: 'MIME_TYPE_NOT_ALLOWED' };
  }

  // Cross-check MIME with extension if provided
  if (declaredExt) {
    const expectedExt = MIME_TO_EXT[normalizedMime];
    if (expectedExt && declaredExt.toLowerCase() !== expectedExt) {
      // Special case: jpg vs jpeg
      if (
        !(
          (declaredExt === 'jpg' || declaredExt === 'jpeg') &&
          expectedExt === 'jpg'
        )
      ) {
        return { valid: false, error: 'MIME_EXTENSION_MISMATCH' };
      }
    }
  }

  return { valid: true };
}

// ─── File Size Validation ───

/**
 * Validate file size
 */
export function validateFileSize(sizeBytes: number): FileValidationResult {
  if (sizeBytes <= 0) {
    return { valid: false, error: 'FILE_EMPTY' };
  }

  if (sizeBytes > NPC_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `FILE_TOO_LARGE:max_${NPC_MAX_FILE_SIZE_BYTES}_bytes`,
    };
  }

  return { valid: true };
}

// ─── PDF Page Count Validation ───

/**
 * Validate PDF page count
 * NOTE: This is a placeholder. Actual page count requires PDF parsing library.
 */
export function validatePageCount(pageCount: number): PageValidationResult {
  if (pageCount <= 0) {
    return { valid: false, error: 'NO_PAGES_DETECTED' };
  }

  if (pageCount > NPC_MAX_PAGES_PER_SUBMISSION) {
    return {
      valid: false,
      error: `TOO_MANY_PAGES:max_${NPC_MAX_PAGES_PER_SUBMISSION}`,
      pageCount,
    };
  }

  return { valid: true, pageCount };
}

// ─── Complete File Validation ───

export interface CompleteValidationInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  secureId: string;
}

/**
 * Perform complete server-side file validation
 * This MUST be called server-side, NEVER trust client-side validation alone
 */
export function validateUploadedFile(
  input: CompleteValidationInput
): FileValidationResult {
  // 1. Validate filename
  const filenameResult = validateFilename(input.filename, input.secureId);
  if (!filenameResult.valid) {
    return filenameResult;
  }

  // 2. Validate MIME type
  const mimeResult = validateMimeType(
    input.mimeType,
    filenameResult.detectedExt
  );
  if (!mimeResult.valid) {
    return mimeResult;
  }

  // 3. Validate file size
  const sizeResult = validateFileSize(input.sizeBytes);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  return {
    valid: true,
    sanitizedName: filenameResult.sanitizedName,
    detectedExt: filenameResult.detectedExt,
  };
}

// ─── Error Code Mapping (for user-friendly messages) ───

export const FILE_VALIDATION_ERRORS: Record<string, string> = {
  FILENAME_EMPTY: 'Le nom du fichier est vide',
  FILENAME_TOO_LONG: 'Le nom du fichier est trop long',
  PATH_TRAVERSAL_DETECTED: 'Nom de fichier invalide détecté',
  SUSPICIOUS_DOUBLE_EXTENSION: 'Extension de fichier suspecte',
  NO_FILE_EXTENSION: 'Le fichier doit avoir une extension',
  EXTENSION_NOT_ALLOWED:
    'Type de fichier non autorisé. Acceptés: PDF, JPG, PNG, WebP',
  MIME_TYPE_NOT_ALLOWED: 'Format de fichier non supporté',
  MIME_EXTENSION_MISMATCH: 'Extension incompatible avec le contenu',
  FILE_EMPTY: 'Le fichier est vide',
  FILE_TOO_LARGE: 'Fichier trop volumineux (max 10 Mo)',
  NO_PAGES_DETECTED: 'Aucune page détectée dans le PDF',
  TOO_MANY_PAGES: 'Trop de pages (maximum 20)',
};
