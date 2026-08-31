import { readFileSync } from 'node:fs';
import { inspectTestDebtSource } from '../../scripts/testing/check-zero-test-debt.mjs';

describe('H009 ARIA zero test debt gate', () => {
  it('H009_CI_RUNS_CANONICAL_ZERO_TEST_DEBT_GATE', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(workflow).toContain('run: npm run test:zero-debt');
  });

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
    expect(inspectTestDebtSource('jest.config.ts', "export default { testPathIgnorePatterns: ['aria.runtime.test.ts'] }"))
      .toEqual([expect.stringContaining('ignored-qualification-test')]);
  });

  it('detects Python skips, explicit quarantine markers and permissive ARIA E2E assertions', () => {
    const pythonSkip = ['pytest', '.', 'skip', "('dependency unavailable')"].join('');
    expect(inspectTestDebtSource('tests/probe.py', pythonSkip))
      .toEqual([expect.stringContaining('focused-or-disabled-test:skip')]);
    const quarantine = ['// @', 'quarantine', '\n', "test('probe', () => undefined)"].join('');
    expect(inspectTestDebtSource('e2e/aria/probe.ts', quarantine))
      .toEqual([expect.stringContaining('quarantined-test-marker')]);
    const permissive = ["expect(value).toEqual(expect.", 'anything', '())'].join('');
    expect(inspectTestDebtSource('e2e/aria/probe.ts', permissive))
      .toEqual([expect.stringContaining('permissive-qualification-assertion')]);
    const emptyLane = ['jest --', 'pass', 'With', 'No', 'Tests'].join('');
    expect(inspectTestDebtSource('package.json', emptyLane))
      .toEqual([expect.stringContaining('empty-test-lane-option')]);
  });

  it('accepts ordinary tests and a zero retry policy', () => {
    const source = "export default { retries: 0 }; test('probe', () => undefined)";
    expect(inspectTestDebtSource('probe.ts', source)).toEqual([]);
  });
});
