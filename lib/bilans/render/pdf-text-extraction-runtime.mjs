import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const CHILD_HELPER = 'lib/bilans/render/pdf-text-extraction-child.mjs';
const DEFAULT_TIMEOUT_MS = 20_000;
const RUNTIME_CHECK_TIMEOUT_MS = 5_000;
const UNAVAILABLE_RECHECK_MS = 5_000;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const DEFAULT_MAX_STORED_TEXT_CHARS = 200_000;
const availabilityByRoot = new Map();

function errorWithCode(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isMissingPdfJs(stderr) {
  return stderr.includes('ERR_MODULE_NOT_FOUND')
    && stderr.includes('pdfjs-dist');
}

function documentFailureCode(stderr) {
  const match = stderr.match(/PDFJS_DOCUMENT_EXTRACTION_FAILED:([A-Za-z0-9_]+)/);
  return match ? `PDFJS_DOCUMENT_EXTRACTION_FAILED:${match[1]}` : null;
}

function runChild({ root, args, input, timeoutMs, env }) {
  const cwd = resolve(root);
  const helperPath = resolve(cwd, CHILD_HELPER);
  return new Promise((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [helperPath, ...args], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(env ? { env } : {}),
    });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      rejectChild(errorWithCode('BILAN_PDF_TEXT_EXTRACTION_TIMEOUT'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => {
      const remaining = Math.max(0, 400 - Buffer.concat(stderr).length);
      if (remaining > 0) stderr.push(Buffer.from(chunk).subarray(0, remaining));
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectChild(errorWithCode(error.code === 'ENOENT' ? 'PDF_TEXT_EXTRACTION_HELPER_UNAVAILABLE' : 'PDF_TEXT_EXTRACTION_PROCESS_FAILED'));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const output = Buffer.concat(stdout).toString('utf8');
      const errorText = Buffer.concat(stderr).toString('utf8');
      if (code === 0) resolveChild(output);
      else if (isMissingPdfJs(errorText)) rejectChild(errorWithCode('PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE'));
      else if (documentFailureCode(errorText)) rejectChild(errorWithCode(documentFailureCode(errorText)));
      else rejectChild(errorWithCode(`BILAN_PDF_TEXT_EXTRACTION_FAILED:${code ?? 'UNKNOWN'}`));
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

/** @typedef {{ available: true } | { available: false, code: 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE' | 'PDF_TEXT_EXTRACTION_HELPER_UNAVAILABLE' | 'PDF_TEXT_EXTRACTION_ENGINE_UNAVAILABLE' }} PdfTextRuntimeCheck */

/**
 * Probes the exact Node child helper used by extraction. The result is cached
 * for the immutable process root. Success stays cached; unavailability blocks
 * claims but is rechecked after a bounded cooldown so a transient child failure
 * cannot permanently strand the queue. Concurrent drains share one probe.
 * @param {{ root?: string, timeoutMs?: number, env?: NodeJS.ProcessEnv, now?: () => number }} [options]
 * @returns {Promise<PdfTextRuntimeCheck>}
 */
export function checkPdfTextExtractionRuntime(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const now = options.now ?? (() => performance.now());
  const cached = availabilityByRoot.get(root);
  if (cached && cached.expiresAt > now()) return cached.promise;
  const entry = { expiresAt: Infinity, promise: runChild({
    root,
    args: ['--check'],
    timeoutMs: options.timeoutMs ?? RUNTIME_CHECK_TIMEOUT_MS,
    env: options.env,
  }).then((output) => {
    if (output !== 'PDFJS_RUNTIME_AVAILABLE') {
      entry.expiresAt = now() + UNAVAILABLE_RECHECK_MS;
      return { available: false, code: 'PDF_TEXT_EXTRACTION_ENGINE_UNAVAILABLE' };
    }
    return { available: true };
  }).catch((error) => {
    entry.expiresAt = now() + UNAVAILABLE_RECHECK_MS;
    return {
      available: false,
      code: error?.code === 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE'
        ? 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE'
        : error?.code === 'PDF_TEXT_EXTRACTION_HELPER_UNAVAILABLE'
          ? 'PDF_TEXT_EXTRACTION_HELPER_UNAVAILABLE'
          : 'PDF_TEXT_EXTRACTION_ENGINE_UNAVAILABLE',
    };
  }) };
  availabilityByRoot.set(root, entry);
  return entry.promise;
}

/** @param {string} [root] */
export function invalidatePdfTextExtractionRuntimeCheck(root = process.cwd()) {
  availabilityByRoot.delete(resolve(root));
}

/**
 * Extracts text in a bounded child process, preserving the existing explicit
 * SUCCEEDED / EMPTY / FAILED distinction and treating a missing runtime
 * engine as infrastructure unavailability rather than a document attempt.
 * @param {Buffer} pdf
 * @param {{ maxStoredTextChars?: number, timeoutMs?: number, root?: string, env?: NodeJS.ProcessEnv }} [options]
 * @returns {Promise<
 *   { status: 'SUCCEEDED', text: string, characterCount: number, truncated: boolean, totalCharacterCount: number }
 *   | { status: 'EMPTY' }
 *   | { status: 'FAILED', errorMessage: string }
 *   | { status: 'UNAVAILABLE', errorCode: 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE' | 'PDF_TEXT_EXTRACTION_HELPER_UNAVAILABLE' }
 * >}
 */
export async function extractSubmissionTextBounded(pdf, options = {}) {
  const maxStoredTextChars = options.maxStoredTextChars ?? DEFAULT_MAX_STORED_TEXT_CHARS;
  if (pdf.byteLength === 0) return { status: 'FAILED', errorMessage: 'EMPTY_FILE' };
  if (pdf.byteLength > MAX_INPUT_BYTES) return { status: 'FAILED', errorMessage: `FILE_TOO_LARGE:${pdf.byteLength}` };

  let raw;
  try {
    raw = await extractPdfTextRaw(pdf, options);
  } catch (error) {
    if (error?.code === 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE' || error?.code === 'PDF_TEXT_EXTRACTION_HELPER_UNAVAILABLE') {
      return { status: 'UNAVAILABLE', errorCode: error.code };
    }
    return { status: 'FAILED', errorMessage: error instanceof Error ? error.message.slice(0, 300) : 'UNKNOWN_ERROR' };
  }

  const text = raw.trim();
  if (text.length === 0) return { status: 'EMPTY' };
  const truncated = text.length > maxStoredTextChars;
  return {
    status: 'SUCCEEDED',
    text: truncated ? text.slice(0, maxStoredTextChars) : text,
    characterCount: truncated ? maxStoredTextChars : text.length,
    truncated,
    totalCharacterCount: text.length,
  };
}

/**
 * Raw extractor used by `lib/bilans/render/pdf.ts`; kept exported so the
 * existing general PDF renderer API does not change.
 * @param {Buffer} pdf
 * @param {{ timeoutMs?: number, root?: string, env?: NodeJS.ProcessEnv }} [options]
 * @returns {Promise<string>}
 */
export function extractPdfTextRaw(pdf, options = {}) {
  return runChild({
    root: options.root ?? process.cwd(),
    args: [],
    input: pdf,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    env: options.env,
  });
}
