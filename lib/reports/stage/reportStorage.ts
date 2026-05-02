import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

/**
 * Get the base directory for generated reports storage.
 * Uses GENERATED_REPORTS_DIR env var, or falls back to private/generated-reports.
 * Never uses public/ directories.
 */
/**
 * Check if a path contains a segment exactly equal to "public".
 * Prevents storing reports in publicly accessible directories.
 */
function containsPublicSegment(resolvedPath: string): boolean {
  const normalized = path.normalize(resolvedPath);
  const segments = normalized.split(path.sep);
  return segments.some((segment) => segment === 'public');
}

export function getGeneratedReportsDir(): string {
  const envDir = process.env.GENERATED_REPORTS_DIR;
  if (envDir) {
    const resolved = path.resolve(envDir);
    if (containsPublicSegment(resolved)) {
      throw new Error('Generated reports directory must not be inside public/');
    }
    return resolved;
  }
  // Fallback to private directory (not publicly accessible)
  return path.join(process.cwd(), 'private', 'generated-reports');
}

/**
 * Ensure the generated reports directory exists.
 * Creates it recursively if absent.
 */
export async function ensureGeneratedReportsDir(): Promise<void> {
  const dir = getGeneratedReportsDir();
  const storageConfigured = Boolean(process.env.GENERATED_REPORTS_DIR);
  try {
    await fs.mkdir(dir, { recursive: true });
    logger.debug({ storageConfigured }, '[Reports] Ensured generated reports directory exists');
  } catch (error) {
    logger.error({ storageConfigured, error: (error as Error).message }, '[Reports] Failed to create generated reports directory');
    throw new Error(`Failed to create reports directory`);
  }
}

/**
 * Validate a path component to prevent path traversal attacks.
 * Rejects components containing path separators or parent directory references.
 */
function validatePathComponent(component: string, name: string): void {
  if (!component || typeof component !== 'string') {
    throw new Error(`${name} is required and must be a non-empty string`);
  }
  // Prevent path traversal: reject any path separators or parent directory references
  if (component.includes('/') || component.includes('\\') || component.includes('..')) {
    throw new Error(`Invalid ${name}: path traversal detected`);
  }
  // Validate format (alphanumeric with dashes/underscores, typical for CUIDs)
  if (!/^[a-zA-Z0-9_-]+$/.test(component)) {
    throw new Error(`Invalid ${name}: contains forbidden characters`);
  }
}

/**
 * Get the PDF file path for a generated report.
 * Organizes files by studentId for better structure and isolation.
 *
 * @param reportId - The report ID (CUID)
 * @param studentId - Optional student ID for directory organization
 * @returns Absolute path to the PDF file
 */
export function getGeneratedReportPdfPath(reportId: string, studentId?: string): string {
  validatePathComponent(reportId, 'reportId');

  const baseDir = getGeneratedReportsDir();

  if (studentId) {
    validatePathComponent(studentId, 'studentId');
    return path.join(baseDir, studentId, `${reportId}.pdf`);
  }

  return path.join(baseDir, `${reportId}.pdf`);
}

interface WritePdfParams {
  reportId: string;
  studentId?: string;
  pdfBuffer: Buffer;
}

/**
 * Write a generated report PDF to durable storage.
 * Creates parent directories if needed.
 *
 * @returns Object with filePath on success
 * @throws Error if write fails or path validation fails
 */
export async function writeGeneratedReportPdf({
  reportId,
  studentId,
  pdfBuffer,
}: WritePdfParams): Promise<{ filePath: string }> {
  // Ensure directory exists
  await ensureGeneratedReportsDir();

  const filePath = getGeneratedReportPdfPath(reportId, studentId);

  // Ensure parent directory exists (for studentId subdirectory)
  const parentDir = path.dirname(filePath);
  try {
    await fs.mkdir(parentDir, { recursive: true });
  } catch (error) {
    logger.error({ reportId, studentId, error: (error as Error).message }, '[Reports] Failed to create parent directory');
    throw new Error(`Failed to create directory for report: ${reportId}`);
  }

  const storageConfigured = Boolean(process.env.GENERATED_REPORTS_DIR);
  try {
    await fs.writeFile(filePath, pdfBuffer);
    logger.info({ reportId, studentId, storageConfigured }, '[Reports] PDF written to durable storage');
    return { filePath };
  } catch (error) {
    logger.error({ reportId, studentId, storageConfigured, error: (error as Error).message }, '[Reports] Failed to write PDF');
    throw new Error(`Failed to write PDF: ${reportId}`);
  }
}

interface ReadPdfParams {
  reportId: string;
  studentId?: string;
}

/**
 * Read a generated report PDF from durable storage.
 *
 * @returns Buffer containing the PDF
 * @throws Error if file not found or read fails
 */
export async function readGeneratedReportPdf({
  reportId,
  studentId,
}: ReadPdfParams): Promise<Buffer> {
  const filePath = getGeneratedReportPdfPath(reportId, studentId);

  const storageConfigured = Boolean(process.env.GENERATED_REPORTS_DIR);
  try {
    const buffer = await fs.readFile(filePath);
    logger.debug({ reportId, studentId, storageConfigured }, '[Reports] PDF read from durable storage');
    return buffer;
  } catch (error) {
    // Distinguish between file not found and other errors
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn({ reportId, studentId, storageConfigured }, '[Reports] PDF file not found');
      throw new Error(`PDF not found: ${reportId}`);
    }
    logger.error({ reportId, studentId, storageConfigured, error: (error as Error).message }, '[Reports] Failed to read PDF');
    throw new Error(`Failed to read PDF: ${reportId}`);
  }
}
