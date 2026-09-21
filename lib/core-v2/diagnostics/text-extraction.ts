import { extractPdfText } from '@/lib/bilans/render/pdf';

const EXTRACTION_TIMEOUT_MS = 20_000;
const MAX_INPUT_BYTES = 15 * 1024 * 1024; // matches the deposit route's own bound — defense in depth, not the only guard.
const MAX_STORED_TEXT_CHARS = 200_000; // a written answer, never a full-book dump; also bounds what a later step reads back.

export type BoundedTextExtractionResult =
  | Readonly<{ status: 'SUCCEEDED'; text: string; characterCount: number }>
  | Readonly<{ status: 'EMPTY' }>
  | Readonly<{ status: 'FAILED'; errorMessage: string }>;

/**
 * Bounded, best-effort text extraction for one submission's PDF bytes.
 * Never throws: every outcome (real text, no exploitable text, or a
 * failed/timed-out/oversized attempt) is an explicit typed result, never a
 * fabricated success — mission §9 ("distinguer document sans texte
 * exploitable, fichier défectueux ... avant tout traitement coûteux",
 * "jamais un succès vide").
 */
export async function extractSubmissionTextBounded(pdf: Buffer): Promise<BoundedTextExtractionResult> {
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
  return { status: 'SUCCEEDED', text: text.slice(0, MAX_STORED_TEXT_CHARS), characterCount: Math.min(text.length, MAX_STORED_TEXT_CHARS) };
}
