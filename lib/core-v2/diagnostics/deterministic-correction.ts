import type { DiagnosticMcqAnswerKey } from './demo-answer-key';

export type DeterministicCorrectionResult =
  | Readonly<{ itemId: string; kind: 'MCQ'; status: 'MATCHED'; selectedOption: string; correct: boolean }>
  | Readonly<{ itemId: string; kind: 'MCQ'; status: 'NO_MATCH' }>;

/**
 * Deterministic correction (mission §7/§9) — applied ONLY to an
 * objectively verifiable item (a closed question with a stable key),
 * never to an open task; that distinction is structural here, not a
 * judgment call left to a caller. Pure, synchronous, no I/O: this is the
 * "no AI budget needed" half of correction, and it stays usable
 * regardless of whether the AI-assisted half is ever authorized.
 *
 * Never guesses: if the extracted text does not confidently match the
 * expected answer shape, the outcome is NO_MATCH — an explicit signal
 * that this item needs pedagogical (or, later, AI-assisted) review, never
 * a fabricated score standing in for a real one.
 */
export function correctDeterministicMcqItem(extractedText: string, key: DiagnosticMcqAnswerKey): DeterministicCorrectionResult {
  const match = key.matchPattern.exec(extractedText);
  if (!match) return { itemId: key.itemId, kind: 'MCQ', status: 'NO_MATCH' };
  const selectedOption = match[1].toUpperCase();
  return { itemId: key.itemId, kind: 'MCQ', status: 'MATCHED', selectedOption, correct: selectedOption === key.correctOption };
}
