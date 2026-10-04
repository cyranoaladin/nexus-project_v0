let qualifyAriaMobileRepeat;
let sanitizePlaywrightReport;
beforeAll(async () => {
  ({ qualifyAriaMobileRepeat } = await import('../../scripts/testing/check-aria-mobile-repeat.mjs'));
  ({ sanitizePlaywrightReport } = await import('../../scripts/testing/safe-playwright-report.mjs'));
});
function report() {
  return sanitizePlaywrightReport({
    config: { rootDir: '/synthetic/repo/e2e/aria' }, errors: [],
    stats: { expected: 20, skipped: 0, unexpected: 0, flaky: 0 },
    suites: [{ specs: Array.from({ length: 20 }, (_, repetition) => ({
      id: `e019-repeat-${repetition}`, file: 'visual-a11y.spec.ts',
      title: 'E019 ARIA_VISUAL_VIEWPORT_MATRIX @visual — 768x1024 eight-state qualification', ok: true,
      tests: [{ projectName: 'aria-mobile', expectedStatus: 'passed', status: 'expected', annotations: [],
        results: [{ status: 'passed', retry: 0, errors: [] }] }],
    })), suites: [] }],
  });
}
test('requires twenty distinct successful canonical E019 executions', () => {
  expect(qualifyAriaMobileRepeat(report())).toEqual({ project: 'aria-mobile', cases: 1, repetitionsPerCase: 20, passed: 20, skipped: 0, retries: 0 });
});
test.each([
  ['nineteen', r => r.suites[0].specs.pop()],
  ['duplicate', r => { r.suites[0].specs[1].executionId = r.suites[0].specs[0].executionId; }],
  ['wrong scenario', r => { r.suites[0].specs[0].title = 'case:' + 'a'.repeat(64); }],
  ['wrong project', r => { r.suites[0].specs[0].tests[0].projectName = 'aria-desktop'; }],
  ['skipped', r => { r.stats.skipped = 1; }],
  ['failed', r => { r.suites[0].specs[0].tests[0].results[0].status = 'failed'; }],
  ['retry', r => { r.suites[0].specs[0].tests[0].results[0].retry = 1; }],
  ['fixture failure', r => { r.errors.push({ message: 'synthetic' }); }],
])('rejects %s evidence', (_name, change) => {
  const value = report(); change(value);
  expect(() => qualifyAriaMobileRepeat(value)).toThrow('ARIA_MOBILE_REPEAT_EVIDENCE_INVALID');
});
