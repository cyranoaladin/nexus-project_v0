/**
 * Answer key for the DEMO_FIXTURE instrument's own item 1 — kept
 * deliberately separate from demo-content.ts's subject/answer HTML
 * (mission: "prépare séparément les critères/réponses attendues
 * nécessaires aux tests de C2"). Applies ONLY to this entirely synthetic
 * fixture; never derived from, or a stand-in for, the private bank's own
 * barème, which stays out of scope here entirely.
 */
export interface DiagnosticMcqAnswerKey {
  readonly itemId: string;
  readonly kind: 'MCQ';
  readonly correctOption: string; // a single letter, e.g. 'C'
  readonly matchPattern: RegExp;
}

/**
 * Matches the demo answer's own stated format ("Item 1 : C) Paris",
 * demo-content.ts's DEMO_ANSWER_HTML) — tolerant of the whitespace/
 * punctuation drift real PDF text extraction introduces, never so loose
 * that it would match an unrelated mention of the same letter elsewhere
 * in the answer.
 */
export const DEMO_FIXTURE_ANSWER_KEY: readonly DiagnosticMcqAnswerKey[] = [
  {
    itemId: 'item-1',
    kind: 'MCQ',
    correctOption: 'C',
    matchPattern: /item\s*1\b[^\n]{0,40}?\b([a-d])\s*\)/i,
  },
];
