// ═══════════════════════════════════════════════════════════════════════════════
// NPC - NEXUS PEDAGOGY COCKPIT — Configuration
// Centralized configuration for file storage, validation, and AI processing
// ═══════════════════════════════════════════════════════════════════════════════

import path from 'path';

// ─── Environment-based Configuration ───

/** Base directory for uploaded copy files (ABSOLUTE path required) */
export const NPC_UPLOAD_DIR = process.env.NPC_UPLOAD_DIR
  ? path.resolve(process.env.NPC_UPLOAD_DIR)
  : path.resolve(process.cwd(), 'uploads', 'copies');

/** Maximum file size per upload (MB) */
export const NPC_MAX_FILE_SIZE_MB = parseInt(
  process.env.NPC_MAX_FILE_SIZE_MB || '10',
  10
);

/** Maximum number of pages per submission */
export const NPC_MAX_PAGES_PER_SUBMISSION = parseInt(
  process.env.NPC_MAX_PAGES_PER_SUBMISSION || '20',
  10
);

/** Maximum file size in bytes */
export const NPC_MAX_FILE_SIZE_BYTES = NPC_MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── PDF to Image Conversion Settings ───

/** DPI for PDF to image conversion */
export const NPC_PDF_DPI = parseInt(process.env.NPC_PDF_DPI || '150', 10);

/** JPEG/WebP quality (0-100) */
export const NPC_IMAGE_QUALITY = parseInt(
  process.env.NPC_IMAGE_QUALITY || '85',
  10
);

/** Output format for converted images */
export const NPC_CONVERTED_FORMAT = process.env.NPC_CONVERTED_FORMAT || 'webp';

// ─── AI Processing Settings ───

/** Chutes.ai API configuration */
export const CHUTES_API_KEY = process.env.CHUTES_API_KEY || '';
export const CHUTES_BASE_URL =
  process.env.CHUTES_BASE_URL || 'https://api.chutes.ai';

/** AI Job Worker settings */
export const NPC_WORKER_POLL_INTERVAL_MS = parseInt(
  process.env.NPC_WORKER_POLL_INTERVAL_MS || '5000',
  10
);

export const NPC_WORKER_LOCK_DURATION_MS = parseInt(
  process.env.NPC_WORKER_LOCK_DURATION_MS || '300000',
  10
);

export const NPC_MAX_RETRY_ATTEMPTS = parseInt(
  process.env.NPC_MAX_RETRY_ATTEMPTS || '3',
  10
);

/** LLM Mode for NPC: live | stub | off */
export const NPC_LLM_MODE = (process.env.NPC_LLM_MODE || 'stub') as
  | 'live'
  | 'stub'
  | 'off';

// ─── Allowed File Types ───

/** MIME types allowed for upload */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/** File extensions allowed (without dot) */
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'] as const;

/** Mapping MIME type to extension */
export const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// ─── Security Settings ───

/** Characters forbidden in filenames */
export const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/** Maximum filename length */
export const MAX_FILENAME_LENGTH = 255;

/** Secure file ID length (for random IDs) */
export const SECURE_FILE_ID_LENGTH = 32;
