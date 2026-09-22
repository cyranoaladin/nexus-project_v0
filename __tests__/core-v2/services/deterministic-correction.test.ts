/**
 * Deterministic correction (mission §7/§9): the first real, working
 * correction step — no AI, no budget, just an objectively verifiable
 * item scored against a stable key. Exercised against the REAL demo
 * answer (DEMO_ANSWER_HTML) rendered to a real PDF and genuinely
 * extracted — not a hand-typed string standing in for extraction.
 */
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { extractSubmissionTextBounded } from '@/lib/core-v2/diagnostics/text-extraction';
import { DEMO_ANSWER_HTML } from '@/lib/core-v2/diagnostics/demo-content';
import { DEMO_FIXTURE_ANSWER_KEY } from '@/lib/core-v2/diagnostics/demo-answer-key';
import { correctDeterministicMcqItem } from '@/lib/core-v2/diagnostics/deterministic-correction';

async function extractRealText(html: string): Promise<string> {
  const pdf = await renderHtmlToPdf(html);
  const result = await extractSubmissionTextBounded(pdf);
  if (result.status !== 'SUCCEEDED') throw new Error(`Unexpected extraction outcome: ${result.status}`);
  return result.text;
}

describe('correctDeterministicMcqItem — against the real demo answer', () => {
  test('the real, correct demo answer ("C) Paris") is matched and scored correct', async () => {
    const text = await extractRealText(DEMO_ANSWER_HTML);
    const [item1Key] = DEMO_FIXTURE_ANSWER_KEY;
    const result = correctDeterministicMcqItem(text, item1Key);
    expect(result).toEqual({ itemId: 'item-1', kind: 'MCQ', status: 'MATCHED', selectedOption: 'C', correct: true });
  });

  test('a real but wrong answer is matched and scored incorrect — never silently treated as correct', async () => {
    const wrongAnswerHtml = DEMO_ANSWER_HTML.replace('C) Paris', 'A) Lyon');
    const text = await extractRealText(wrongAnswerHtml);
    const [item1Key] = DEMO_FIXTURE_ANSWER_KEY;
    const result = correctDeterministicMcqItem(text, item1Key);
    expect(result).toEqual({ itemId: 'item-1', kind: 'MCQ', status: 'MATCHED', selectedOption: 'A', correct: false });
  });

  test('an answer with no recognizable option for the item is NO_MATCH — never a guessed score', async () => {
    const unrecognizableHtml = DEMO_ANSWER_HTML.replace('Item 1 :</span> C) Paris', 'Item 1 :</span> Je pense que c’est Paris');
    const text = await extractRealText(unrecognizableHtml);
    const [item1Key] = DEMO_FIXTURE_ANSWER_KEY;
    const result = correctDeterministicMcqItem(text, item1Key);
    expect(result).toEqual({ itemId: 'item-1', kind: 'MCQ', status: 'NO_MATCH' });
  });

  test('a mention of the correct letter elsewhere in the text (not as item 1’s own answer) does not falsely match', () => {
    const unrelatedText = 'Item 2 : Ma réponse mentionne C) comme exemple, mais item 1 reste sans réponse claire ici.';
    const [item1Key] = DEMO_FIXTURE_ANSWER_KEY;
    const result = correctDeterministicMcqItem(unrelatedText, item1Key);
    expect(result.status).toBe('NO_MATCH');
  });
});
