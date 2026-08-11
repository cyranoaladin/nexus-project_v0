import { serializeError } from '@/lib/utils/serialize-error';
// ═══════════════════════════════════════════════════════════════════════════════
// NPC - NEXUS PEDAGOGY COCKPIT — PDF to Image Conversion
// Server-side PDF processing for AI analysis
// ═══════════════════════════════════════════════════════════════════════════════

import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import {
  NPC_PDF_DPI,
  NPC_IMAGE_QUALITY,
  NPC_CONVERTED_FORMAT,
} from './config';
import { generateSecureRelativePath } from './storage';
import {
  deleteNpcStorageFile,
  readNpcStorageFile,
  removeNpcStorageDirectory,
  withNpcStorageDirectoryPath,
  withNpcStorageFilePath,
  writeNpcStorageFileAtomic,
} from './storage-root';

const execFileAsync = promisify(execFile);

async function execStorageWriter(
  command: string,
  arguments_: string[],
): Promise<void> {
  // A private child umask keeps tool-created staging files non-writable by the
  // group/world. Positional arguments avoid interpolating paths into a shell.
  await execFileAsync(
    '/bin/sh',
    ['-c', 'umask 027; exec "$@"', 'npc-storage-tool', command, ...arguments_],
    { encoding: 'utf8' },
  );
}

// ─── Types ───

export interface PdfConversionResult {
  success: boolean;
  error?: string;
  pageCount?: number;
  convertedPaths?: string[];
}

export interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
  filePath: string;
}

// ─── PDF Page Count ───

/**
 * Get PDF page count using pdfinfo (poppler-utils)
 */
export async function getPdfPageCount(
  pdfRelativePath: string,
): Promise<number | null> {
  try {
    const stdout = await withNpcStorageFilePath(
      pdfRelativePath,
      async (pdfPath) => (
        await execFileAsync('pdfinfo', [pdfPath], { encoding: 'utf8' })
      ).stdout,
    );
    const match = stdout.match(/Pages:\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch (error) {
    console.error('[PDF Converter] Failed to get page count:', serializeError(error));
    return null;
  }
}

// ─── PDF to Image Conversion ───

/**
 * Convert PDF pages to images using pdftoppm (poppler-utils)
 * Outputs WebP format for optimal AI processing
 */
export async function convertPdfToImages(
  pdfRelativePath: string,
  outputRelativeDirectory: string,
  options: {
    dpi?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): Promise<PdfConversionResult> {
  const { dpi = NPC_PDF_DPI, quality = NPC_IMAGE_QUALITY } = options;
  const requestedFormat = options.format ?? NPC_CONVERTED_FORMAT;
  if (!['webp', 'jpeg', 'png'].includes(requestedFormat)) {
    return { success: false, error: 'UNSUPPORTED_OUTPUT_FORMAT' };
  }
  const format = requestedFormat as 'webp' | 'jpeg' | 'png';

  try {
    // Get page count first
    const pageCount = await getPdfPageCount(pdfRelativePath);
    if (!pageCount || pageCount === 0) {
      return { success: false, error: 'EMPTY_PDF_OR_READ_ERROR' };
    }

    // Build pdftoppm command
    // Format: pdftoppm -jpeg -r 150 -jpegopt quality=85 input.pdf output_prefix
    const formatFlag = format === 'webp' ? '-png' : `-${format}`; // WebP not directly supported, convert via png then cwebp
    const qualityOpt = format === 'jpeg' ? `-jpegopt quality=${quality}` : '';
    const stagingRelativeDirectory = path.join(
      outputRelativeDirectory,
      `.npc-convert-${randomBytes(16).toString('hex')}`,
    );
    const convertedPaths: string[] = [];

    try {
      await withNpcStorageFilePath(pdfRelativePath, async (pdfPath) => {
        await withNpcStorageDirectoryPath(
          stagingRelativeDirectory,
          { create: true },
          async (stagingDirectory) => {
            const arguments_ = [formatFlag, '-r', String(dpi)];
            if (qualityOpt) {
              arguments_.push('-jpegopt', `quality=${quality}`);
            }
            arguments_.push(
              pdfPath,
              path.join(stagingDirectory, 'page'),
            );
            await execStorageWriter('pdftoppm', arguments_);
          },
        );
      });

      const stagedPaths = format === 'webp'
        ? await convertPngsToWebp(stagingRelativeDirectory, quality)
        : await listConvertedPaths(stagingRelativeDirectory, format);

      for (const stagedPath of stagedPaths) {
        const persistedBytes = await readNpcStorageFile(stagedPath);
        const finalRelativePath = path.join(
          outputRelativeDirectory,
          path.basename(stagedPath),
        );
        await writeNpcStorageFileAtomic(
          finalRelativePath,
          persistedBytes,
          persistedBytes.length,
        );
        convertedPaths.push(finalRelativePath);
      }
    } finally {
      await removeNpcStorageDirectory(stagingRelativeDirectory).catch(
        () => undefined,
      );
    }

    if (convertedPaths.length === 0) {
      return { success: false, error: 'NO_IMAGES_GENERATED' };
    }

    if (convertedPaths.length !== pageCount) {
    }

    return {
      success: true,
      pageCount: convertedPaths.length,
      convertedPaths,
    };
  } catch (error) {
    console.error('[PDF Converter] Conversion failed:', serializeError(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'CONVERSION_FAILED',
    };
  }
}

async function listConvertedPaths(
  relativeDirectory: string,
  format: 'jpeg' | 'png',
): Promise<string[]> {
  return withNpcStorageDirectoryPath(
    relativeDirectory,
    { create: false },
    async (directory) => {
      const files = await fs.readdir(directory);
      const extension = format === 'jpeg' ? 'jpg' : format;
      return files
        .filter((file) => file.endsWith(`.${extension}`))
        .sort()
        .map((file) => path.join(relativeDirectory, file));
    },
  );
}

/**
 * Convert PNG files to WebP using cwebp
 */
async function convertPngsToWebp(
  relativeDirectory: string,
  quality: number
): Promise<string[]> {
  try {
    return withNpcStorageDirectoryPath(
      relativeDirectory,
      { create: false },
      async (directory) => {
        const files = await fs.readdir(directory);
        const pngFiles = files.filter((file) => file.endsWith('.png')).sort();
        const webpPaths: string[] = [];

        for (const pngFile of pngFiles) {
          const pngRelativePath = path.join(relativeDirectory, pngFile);
          const webpRelativePath = pngRelativePath.replace(/\.png$/, '.webp');
          const webpPath = path.join(directory, path.basename(webpRelativePath));

          try {
            await withNpcStorageFilePath(pngRelativePath, async (pngPath) => {
              await execStorageWriter(
                'cwebp',
                ['-q', String(quality), pngPath, '-o', webpPath],
              );
            });
            await deleteNpcStorageFile(pngRelativePath);
            webpPaths.push(webpRelativePath);
          } catch (error) {
            console.error(`[PDF Converter] WebP conversion failed for ${pngFile}:`, serializeError(error));
            // Keep PNG as fallback
            webpPaths.push(pngRelativePath);
          }
        }

        return webpPaths;
      }
    );
  } catch (error) {
    console.error('[PDF Converter] WebP batch conversion failed:', serializeError(error));
    return [];
  }
}

// ─── Image Metadata ───

/**
 * Get image dimensions using file command or identify (ImageMagick)
 */
export async function getImageDimensions(
  imageRelativePath: string
): Promise<{ width: number; height: number } | null> {
  try {
    // Try identify command (ImageMagick)
    const stdout = await withNpcStorageFilePath(
      imageRelativePath,
      async (imagePath) => (
        await execFileAsync(
          'identify',
          ['-format', '%w %h', imagePath],
          { encoding: 'utf8' },
        )
      ).stdout,
    );
    const [width, height] = stdout.trim().split(' ').map(Number);
    return { width, height };
  } catch {
    // Fallback: try file command
    try {
      const stdout = await withNpcStorageFilePath(
        imageRelativePath,
        async (imagePath) => (
          await execFileAsync('file', [imagePath], { encoding: 'utf8' })
        ).stdout,
      );
      const match = stdout.match(/(\d+)\s*x\s*(\d+)/);
      if (match) {
        return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
      }
    } catch (error) {
      console.error('[PDF Converter] Failed to get dimensions:', serializeError(error));
    }
    return null;
  }
}

// ─── Full Submission Processing ───

/**
 * Process a PDF submission: convert all pages to images
 * Returns relative paths for database storage
 */
export async function processPdfSubmission(
  pdfRelativePath: string,
  studentId: string,
  submissionId: string
): Promise<PdfConversionResult & { pageInfos?: PageInfo[] }> {
  try {
    await withNpcStorageFilePath(pdfRelativePath, async () => undefined);

    // Generate output directory
    const outputRelativeDirectory = path.dirname(
      generateSecureRelativePath(
        studentId,
        submissionId,
        0, // Special marker for converted images
        'converted',
      ),
    );

    // Convert PDF
    const result = await convertPdfToImages(
      pdfRelativePath,
      outputRelativeDirectory,
    );

    if (!result.success || !result.convertedPaths) {
      return result;
    }

    // Get dimensions for each page
    const pageInfos: PageInfo[] = [];
    for (let i = 0; i < result.convertedPaths.length; i++) {
      const imageRelativePath = result.convertedPaths[i];
      const dims = await getImageDimensions(imageRelativePath);

      pageInfos.push({
        pageNumber: i + 1,
        width: dims?.width || 0,
        height: dims?.height || 0,
        filePath: imageRelativePath,
      });
    }

    return {
      ...result,
      pageInfos,
    };
  } catch (error) {
    console.error('[PDF Converter] Submission processing failed:', serializeError(error));
    return {
      success: false,
      error: 'PROCESSING_FAILED',
    };
  }
}

// ─── Error Messages ───

export const PDF_CONVERSION_ERRORS: Record<string, string> = {
  EMPTY_PDF_OR_READ_ERROR: 'PDF vide ou erreur de lecture',
  UNSUPPORTED_OUTPUT_FORMAT: 'Format de sortie non pris en charge',
  NO_IMAGES_GENERATED: 'Aucune image générée',
  CONVERSION_FAILED: 'Échec de la conversion PDF',
  PATH_TRAVERSAL_DETECTED: 'Chemin invalide détecté',
  PROCESSING_FAILED: 'Échec du traitement',
};
