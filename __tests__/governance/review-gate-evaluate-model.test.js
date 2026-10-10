let classifyModelCase;
beforeAll(async () => {
  ({ classifyModelCase } = await import('../../scripts/github/review-gate/qualification/evaluate.mjs'));
});

const file = 'app/page.tsx';
const clean = JSON.stringify({ review_complete: true, blocking_findings: [], warnings: [] });
const blocker = JSON.stringify({ review_complete: true,
  blocking_findings: [{ file, reason: 'The new branch bypasses authorization', confidence: 0.9 }],
  warnings: [] });

describe('candidate benchmark outcome is strict and label-blind', () => {
  test('three valid passes with a concrete blocker => BLOCK', () => {
    expect(classifyModelCase({ file, outputs: { correctness: clean, security: blocker, runtime: clean } }))
      .toBe('BLOCK');
    expect(classifyModelCase({ file, outputs: { correctness: clean, security: clean, runtime: clean } }))
      .toBe('CLEAN');
  });

  test('missing/malformed output cannot become CLEAN', () => {
    expect(classifyModelCase({ file, outputs: { correctness: clean, security: 'not json', runtime: clean } }))
      .toBe('MALFORMED');
    expect(classifyModelCase({ file, outputs: { correctness: clean, runtime: clean } }))
      .toBe('MALFORMED');
  });
});
