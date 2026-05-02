import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { logger } from '@/lib/logger';

const execFileAsync = promisify(execFile);

// Error codes for stable error identification
export const LATEX_ERROR_CODES = {
  PDFLATEX_NOT_FOUND: 'PDFLATEX_NOT_FOUND',
  PDF_COMPILATION_FAILED: 'PDF_COMPILATION_FAILED',
  PDF_COMPILATION_TIMEOUT: 'PDF_COMPILATION_TIMEOUT',
} as const;

export type LatexErrorCode = typeof LATEX_ERROR_CODES[keyof typeof LATEX_ERROR_CODES];

export class LatexCompilationError extends Error {
  public readonly code: LatexErrorCode;

  constructor(code: LatexErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'LatexCompilationError';
  }
}

/**
 * Check if pdflatex is available in PATH.
 * Returns true if found, false otherwise.
 */
async function isPdflatexAvailable(): Promise<boolean> {
  try {
    await execFileAsync('pdflatex', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the configured timeout for LaTeX compilation.
 * Uses LATEX_COMPILE_TIMEOUT_MS env var, defaults to 45000ms.
 */
function getCompileTimeoutMs(): number {
  const envTimeout = process.env.LATEX_COMPILE_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 45000; // Default: 45 seconds
}

interface CompilationResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Run pdflatex with security-hardened flags.
 * Uses -halt-on-error, -no-shell-escape, -interaction=nonstopmode.
 */
async function runPdflatex(
  texFile: string,
  outputDirectory: string,
  timeoutMs: number
): Promise<CompilationResult> {
  const args = [
    '-halt-on-error',        // Stop at first error instead of interactive mode
    '-no-shell-escape',      // Prevent shell command execution from LaTeX
    '-interaction=nonstopmode', // Non-interactive mode
    `-output-directory=${outputDirectory}`,
    texFile,
  ];

  try {
    const { stdout, stderr } = await execFileAsync('pdflatex', args, {
      timeout: timeoutMs,
      encoding: 'utf-8',
    });
    return { success: true, stdout, stderr };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; code?: string; message?: string };
    return {
      success: false,
      stdout: execError.stdout || '',
      stderr: execError.stderr || '',
    };
  }
}

/**
 * Read the pdflatex log file if it exists.
 * Returns empty string if log file not found.
 */
async function readLogFile(logPath: string): Promise<string> {
  try {
    return await fs.readFile(logPath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Compile LaTeX source to PDF with security hardening.
 *
 * Security features:
 * - Verifies pdflatex exists before attempting compilation
 * - Uses fs.mkdtemp for secure temporary directory creation
 * - Runs pdflatex with -halt-on-error, -no-shell-escape, -interaction=nonstopmode
 * - Configurable timeout via LATEX_COMPILE_TIMEOUT_MS (default 45s)
 * - Captures stdout/stderr and log file for debugging
 * - Never logs LaTeX content or student data
 * - Cleans up temporary directory after success or failure
 *
 * @param texSource - LaTeX source code (must not contain sensitive data in logs)
 * @returns Buffer containing the generated PDF
 * @throws LatexCompilationError with stable error codes
 */
export async function compileLatexToPdf(texSource: string): Promise<Buffer> {
  // 1. Check pdflatex availability
  const pdflatexAvailable = await isPdflatexAvailable();
  if (!pdflatexAvailable) {
    logger.error({ error: 'pdflatex not found in PATH' }, '[LaTeX] pdflatex binary not available');
    throw new LatexCompilationError(
      LATEX_ERROR_CODES.PDFLATEX_NOT_FOUND,
      'Le compilateur LaTeX (pdflatex) n\'est pas disponible.'
    );
  }

  // 2. Create secure temporary directory using mkdtemp
  const tmpBase = path.join(os.tmpdir(), 'nexus-latex-');
  let workspaceTmp: string;
  try {
    workspaceTmp = await fs.mkdtemp(tmpBase);
  } catch (error) {
    logger.error({ error: (error as Error).message }, '[LaTeX] Failed to create temporary directory');
    throw new LatexCompilationError(
      LATEX_ERROR_CODES.PDF_COMPILATION_FAILED,
      'Impossible de créer le répertoire de compilation temporaire.'
    );
  }

  const texFile = path.join(workspaceTmp, 'document.tex');
  const pdfFile = path.join(workspaceTmp, 'document.pdf');
  const logFile = path.join(workspaceTmp, 'document.log');

  // 3. Write LaTeX source to temp file
  try {
    await fs.writeFile(texFile, texSource, 'utf-8');
  } catch (error) {
    logger.error({ error: (error as Error).message }, '[LaTeX] Failed to write source file');
    await cleanupWorkspace(workspaceTmp);
    throw new LatexCompilationError(
      LATEX_ERROR_CODES.PDF_COMPILATION_FAILED,
      'Impossible d\'écrire le fichier source LaTeX.'
    );
  }

  // 4. Get timeout and compile
  const timeoutMs = getCompileTimeoutMs();
  const startTime = Date.now();

  try {
    // First compilation pass
    const firstRun = await runPdflatex(texFile, workspaceTmp, timeoutMs);
    if (!firstRun.success) {
      const logContent = await readLogFile(logFile);
      const elapsedMs = Date.now() - startTime;
      logger.error(
        {
          elapsedMs,
          logSnippet: logContent.slice(-1000), // Last 1000 chars only, no source
        },
        '[LaTeX] First compilation pass failed'
      );
      await cleanupWorkspace(workspaceTmp);
      throw new LatexCompilationError(
        LATEX_ERROR_CODES.PDF_COMPILATION_FAILED,
        'La compilation LaTeX a échoué lors de la première passe.'
      );
    }

    // Second compilation pass (for references, TOC, etc.)
    const remainingTimeout = timeoutMs - (Date.now() - startTime);
    if (remainingTimeout <= 0) {
      logger.error({ timeoutMs }, '[LaTeX] Compilation timeout before second pass');
      await cleanupWorkspace(workspaceTmp);
      throw new LatexCompilationError(
        LATEX_ERROR_CODES.PDF_COMPILATION_TIMEOUT,
        'La compilation LaTeX a dépassé le temps imparti.'
      );
    }

    const secondRun = await runPdflatex(texFile, workspaceTmp, remainingTimeout);
    if (!secondRun.success) {
      const logContent = await readLogFile(logFile);
      const elapsedMs = Date.now() - startTime;
      logger.error(
        {
          elapsedMs,
          logSnippet: logContent.slice(-1000), // Last 1000 chars only
        },
        '[LaTeX] Second compilation pass failed'
      );
      await cleanupWorkspace(workspaceTmp);
      throw new LatexCompilationError(
        LATEX_ERROR_CODES.PDF_COMPILATION_FAILED,
        'La compilation LaTeX a échoué lors de la seconde passe.'
      );
    }

    // 5. Read the generated PDF
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await fs.readFile(pdfFile);
    } catch (error) {
      logger.error({ error: (error as Error).message }, '[LaTeX] Failed to read generated PDF');
      await cleanupWorkspace(workspaceTmp);
      throw new LatexCompilationError(
        LATEX_ERROR_CODES.PDF_COMPILATION_FAILED,
        'Impossible de lire le PDF généré.'
      );
    }

    // 6. Cleanup on success
    await cleanupWorkspace(workspaceTmp);

    const totalElapsedMs = Date.now() - startTime;
    logger.info({ elapsedMs: totalElapsedMs }, '[LaTeX] PDF compiled successfully');

    return pdfBuffer;

  } catch (error) {
    // Handle timeout specifically
    if (error instanceof LatexCompilationError && error.code === LATEX_ERROR_CODES.PDF_COMPILATION_TIMEOUT) {
      throw error;
    }

    // Re-throw known errors
    if (error instanceof LatexCompilationError) {
      throw error;
    }

    // Unknown error - wrap it
    const execError = error as { code?: string; message?: string };
    if (execError.code === 'ETIMEDOUT' || execError.message?.includes('timeout')) {
      logger.error({ error: execError.message }, '[LaTeX] Compilation timeout');
      await cleanupWorkspace(workspaceTmp);
      throw new LatexCompilationError(
        LATEX_ERROR_CODES.PDF_COMPILATION_TIMEOUT,
        'La compilation LaTeX a dépassé le temps imparti.'
      );
    }

    logger.error({ error: execError.message || 'Unknown error' }, '[LaTeX] Unexpected compilation error');
    await cleanupWorkspace(workspaceTmp);
    throw new LatexCompilationError(
      LATEX_ERROR_CODES.PDF_COMPILATION_FAILED,
      'La compilation LaTeX a échoué.'
    );
  }
}

/**
 * Clean up the temporary workspace directory.
 * Swallows errors to avoid masking primary errors.
 */
async function cleanupWorkspace(workspacePath: string): Promise<void> {
  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
    logger.debug({ workspaceDeleted: true }, '[LaTeX] Cleanup completed');
  } catch (error) {
    // Log but don't throw - cleanup failure shouldn't mask compilation errors
    logger.warn({ error: (error as Error).message }, '[LaTeX] Cleanup failed');
  }
}
