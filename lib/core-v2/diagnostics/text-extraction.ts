import { extractPdfText } from '@/lib/bilans/render/pdf';

const EXTRACTION_TIMEOUT_MS = 20_000;
const MAX_INPUT_BYTES = 15 * 1024 * 1024; // matches the deposit route's own bound — defense in depth, not the only guard.
const DEFAULT_MAX_STORED_TEXT_CHARS = 200_000; // a written answer, never a full-book dump; also bounds what a later step reads back.

export type BoundedTextExtractionResult =
  | Readonly<{ status: 'SUCCEEDED'; text: string; characterCount: number; truncated: boolean; totalCharacterCount: number }>
  | Readonly<{ status: 'EMPTY' }>
  | Readonly<{ status: 'FAILED'; errorMessage: string }>;

/**
 * Bounded, best-effort text extraction for one submission's PDF bytes.
 * Never throws: every outcome (real text, no exploitable text, or a
 * failed/timed-out/oversized attempt) is an explicit typed result, never a
 * fabricated success — mission §9 ("distinguer document sans texte
 * exploitable, fichier défectueux ... avant tout traitement coûteux",
 * "jamais un succès vide").
 *
 * Mission §6: a resource limit (here, the stored-text length cap) must
 * stay a limit, never a silent edit — SUCCEEDED with `truncated: true`
 * and the real `totalCharacterCount` (the pre-truncation length) is a
 * different, distinguishable outcome from a genuinely complete answer.
 * No caller of this function may treat `text` as the whole answer
 * without checking `truncated` first.
 */
export async function extractSubmissionTextBounded(
  pdf: Buffer,
  options: { maxStoredTextChars?: number } = {},
): Promise<BoundedTextExtractionResult> {
  const maxStoredTextChars = options.maxStoredTextChars ?? DEFAULT_MAX_STORED_TEXT_CHARS;
  if (pdf.byteLength === 0) {
    return { status: 'FAILED', errorMessage: 'EMPTY_FILE' };
  }
  if (pdf.byteLength > MAX_INPUT_BYTES) {
    return { status: 'FAILED', errorMessage: `FILE_TOO_LARGE:${pdf.byteLength}` };
  }

  let raw: string;
  try {
    raw = await extractPdfText(pdf, { timeoutMs: EXTRACTION_TIMEOUT_MS });
  } catch (error) {
    return { status: 'FAILED', errorMessage: error instanceof Error ? error.message.slice(0, 300) : 'UNKNOWN_ERROR' };
  }

  const text = raw.trim();
  if (text.length === 0) {
    return { status: 'EMPTY' };
  }
  const truncated = text.length > maxStoredTextChars;
  return {
    status: 'SUCCEEDED',
    text: truncated ? text.slice(0, maxStoredTextChars) : text,
    characterCount: truncated ? maxStoredTextChars : text.length,
    truncated,
    totalCharacterCount: text.length,
  };
}
