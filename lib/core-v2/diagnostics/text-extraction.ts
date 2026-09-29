import {
  checkPdfTextExtractionRuntime,
  extractSubmissionTextBounded as extractBounded,
  invalidatePdfTextExtractionRuntimeCheck,
} from '@/lib/bilans/render/pdf-text-extraction-runtime.mjs';

export type BoundedTextExtractionResult =
  | Readonly<{ status: 'SUCCEEDED'; text: string; characterCount: number; truncated: boolean; totalCharacterCount: number }>
  | Readonly<{ status: 'EMPTY' }>
  | Readonly<{ status: 'FAILED'; errorMessage: string }>
  | Readonly<{ status: 'UNAVAILABLE'; errorCode: 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE' | 'PDF_TEXT_EXTRACTION_HELPER_UNAVAILABLE' }>;

export { checkPdfTextExtractionRuntime, invalidatePdfTextExtractionRuntimeCheck };

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
  options: { maxStoredTextChars?: number; timeoutMs?: number; root?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<BoundedTextExtractionResult> {
  return extractBounded(pdf, options) as Promise<BoundedTextExtractionResult>;
}
