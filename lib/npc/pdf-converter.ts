import { serializeError } from '@/lib/utils/serialize-error';
// ═══════════════════════════════════════════════════════════════════════════════
// NPC - NEXUS PEDAGOGY COCKPIT — PDF to Image Conversion
// Server-side PDF processing for AI analysis
// ═══════════════════════════════════════════════════════════════════════════════

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import {
  NPC_PDF_DPI,
  NPC_IMAGE_QUALITY,
  NPC_CONVERTED_FORMAT,
} from './config';
import { ensureDirectory, generateSecureRelativePath } from './storage';
import { resolveNpcStoragePath } from './storage-root';

const execAsync = promisify(exec);

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
    const pdfPath = await resolveNpcStoragePath(pdfRelativePath);
    const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
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
  const { dpi = NPC_PDF_DPI, quality = NPC_IMAGE_QUALITY, format = NPC_CONVERTED_FORMAT } = options;

  try {
    const pdfPath = await resolveNpcStoragePath(pdfRelativePath);
    const outputDirectory = await ensureDirectory(outputRelativeDirectory);

    // Get page count first
    const pageCount = await getPdfPageCount(pdfRelativePath);
    if (!pageCount || pageCount === 0) {
      return { success: false, error: 'EMPTY_PDF_OR_READ_ERROR' };
    }

    // Build pdftoppm command
    // Format: pdftoppm -jpeg -r 150 -jpegopt quality=85 input.pdf output_prefix
    const formatFlag = format === 'webp' ? '-png' : `-${format}`; // WebP not directly supported, convert via png then cwebp
    const qualityOpt = format === 'jpeg' ? `-jpegopt quality=${quality}` : '';
    const outputPrefix = path.join(outputDirectory, 'page');

    const cmd = `pdftoppm ${formatFlag} -r ${dpi} ${qualityOpt} "${pdfPath}" "${outputPrefix}"`;

    await execAsync(cmd);

    // If WebP requested, convert PNG outputs
    let convertedPaths: string[] = [];
    if (format === 'webp') {
      convertedPaths = await convertPngsToWebp(
        outputRelativeDirectory,
        quality,
      );
    } else {
      // List generated files
      const files = await fs.readdir(outputDirectory);
      const ext = format === 'jpeg' ? 'jpg' : format;
      convertedPaths = files
        .filter((f) => f.endsWith(`.${ext}`))
        .sort()
        .map((f) => path.join(outputRelativeDirectory, f));
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

/**
 * Convert PNG files to WebP using cwebp
 */
async function convertPngsToWebp(
  relativeDirectory: string,
  quality: number
): Promise<string[]> {
  try {
    const directory = await resolveNpcStoragePath(relativeDirectory);
    const files = await fs.readdir(directory);
    const pngFiles = files.filter((f) => f.endsWith('.png')).sort();

    const webpPaths: string[] = [];

    for (const pngFile of pngFiles) {
      const pngRelativePath = path.join(relativeDirectory, pngFile);
      const webpRelativePath = pngRelativePath.replace(/\.png$/, '.webp');
      const pngPath = await resolveNpcStoragePath(pngRelativePath);
      const webpPath = await resolveNpcStoragePath(webpRelativePath);

      try {
        await execAsync(`cwebp -q ${quality} "${pngPath}" -o "${webpPath}"`);
        await fs.unlink(pngPath); // Clean up PNG
        webpPaths.push(webpRelativePath);
      } catch (error) {
        console.error(`[PDF Converter] WebP conversion failed for ${pngFile}:`, serializeError(error));
        // Keep PNG as fallback
        webpPaths.push(pngRelativePath);
      }
    }

    return webpPaths;
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
    const imagePath = await resolveNpcStoragePath(imageRelativePath);
    // Try identify command (ImageMagick)
    const { stdout } = await execAsync(
      `identify -format "%w %h" "${imagePath}"`
    );
    const [width, height] = stdout.trim().split(' ').map(Number);
    return { width, height };
  } catch {
    // Fallback: try file command
    try {
      const imagePath = await resolveNpcStoragePath(imageRelativePath);
      const { stdout } = await execAsync(`file "${imagePath}"`);
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
    await resolveNpcStoragePath(pdfRelativePath);

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
  NO_IMAGES_GENERATED: 'Aucune image générée',
  CONVERSION_FAILED: 'Échec de la conversion PDF',
  PATH_TRAVERSAL_DETECTED: 'Chemin invalide détecté',
  PROCESSING_FAILED: 'Échec du traitement',
};
