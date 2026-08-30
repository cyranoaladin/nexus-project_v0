import { inspectTestDebtSource } from '../../scripts/testing/check-zero-test-debt.mjs';

describe('H009 ARIA zero test debt gate', () => {
  it('detects disabled, focused and deferred tests through syntax', () => {
    const members = ['skip', 'todo', 'only', 'fixme'];
    for (const member of members) {
      const source = ['test', '.', member, "('probe', () => undefined)"].join('');
      expect(inspectTestDebtSource('probe.ts', source)).toHaveLength(1);
    }
    for (const callee of ['x' + 'it', 'x' + 'describe', 'f' + 'it', 'f' + 'describe']) {
      const source = [callee, "('probe', () => undefined)"].join('');
      expect(inspectTestDebtSource('probe.ts', source)).toHaveLength(1);
    }
  });

  it('detects nonzero or dynamic retry policies and qualification ignores', () => {
    expect(inspectTestDebtSource('playwright.config.ts', 'export default { retries: 1 }'))
      .toEqual([expect.stringContaining('retry-policy-must-be-zero')]);
    expect(inspectTestDebtSource('playwright.config.ts', 'export default { retries: process.env.CI ? 2 : 0 }'))
      .toEqual([expect.stringContaining('retry-policy-must-be-zero')]);
    expect(inspectTestDebtSource('playwright.config.ts', "export default { testIgnore: ['aria.runtime.spec.ts'] }"))
      .toEqual([expect.stringContaining('ignored-qualification-test')]);
  });

  it('accepts ordinary tests and a zero retry policy', () => {
    const source = "export default { retries: 0 }; test('probe', () => undefined)";
    expect(inspectTestDebtSource('probe.ts', source)).toEqual([]);
  });
});
