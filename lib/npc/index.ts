// ═══════════════════════════════════════════════════════════════════════════════
// NPC - NEXUS PEDAGOGY COCKPIT — Public API
// Safe exports for server-side usage
// ═══════════════════════════════════════════════════════════════════════════════

// Configuration
export {
  NPC_UPLOAD_DIR,
  NPC_MAX_FILE_SIZE_MB,
  NPC_MAX_FILE_SIZE_BYTES,
  NPC_MAX_PAGES_PER_SUBMISSION,
  NPC_PDF_DPI,
  NPC_IMAGE_QUALITY,
  NPC_CONVERTED_FORMAT,
  CHUTES_API_KEY,
  CHUTES_BASE_URL,
  NPC_WORKER_POLL_INTERVAL_MS,
  NPC_WORKER_LOCK_DURATION_MS,
  NPC_MAX_RETRY_ATTEMPTS,
  NPC_LLM_MODE,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MIME_TO_EXT,
  SECURE_FILE_ID_LENGTH,
} from './config';

// File Validation
export {
  validateFilename,
  validateMimeType,
  validateFileSize,
  validatePageCount,
  validateUploadedFile,
  sanitizeFilename,
  FILE_VALIDATION_ERRORS,
  type FileValidationResult,
  type PageValidationResult,
  type CompleteValidationInput,
} from './file-validator';

// Storage
export {
  generateSecureFileId,
  generateSecurePath,
  ensureDirectory,
  saveUploadedFile,
  readSecureFile,
  deleteSecureFile,
  fileExists,
  deleteSubmissionFiles,
  STORAGE_ERRORS,
  type StorageResult,
  type FileMetadata,
} from './storage';

// PDF Conversion
export {
  getPdfPageCount,
  convertPdfToImages,
  getImageDimensions,
  processPdfSubmission,
  PDF_CONVERSION_ERRORS,
  type PdfConversionResult,
  type PageInfo,
} from './pdf-converter';
