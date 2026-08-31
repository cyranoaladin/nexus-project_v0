import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditAriaQualificationCollection,
  inspectRepositoryTestDebt,
  inspectTestDebtSource,
} from '../../scripts/testing/check-zero-test-debt.mjs';

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

  it('H009_DETECTS_CHAINED_SKIP_AND_ONLY_MODIFIERS', () => {
    const chainedSkip = ['test', '.', 'skip', '.', 'each', '([[1]])', "('probe', () => undefined)"].join('');
    const chainedOnly = ['test', '.', 'only', '.', 'each', '([[1]])', "('probe', () => undefined)"].join('');
    const destructuredSkip = ['const { ', 'skip', ' } = test; ', 'skip', "('probe', () => undefined)"].join('');
    const optionSkip = ['test', "('probe', { ", 'skip', ': true }, () => undefined)'].join('');
    for (const source of [chainedSkip, chainedOnly, destructuredSkip, optionSkip]) {
      expect(inspectTestDebtSource('probe.test.ts', source))
        .toEqual([expect.stringContaining('focused-or-disabled-test')]);
    }
  });

  it('H009_DETECTS_EXPECTED_FAILURE_MARKERS', () => {
    const source = ['test', '.', 'failing', "('probe', () => undefined)"].join('');
    expect(inspectTestDebtSource('probe.test.ts', source))
      .toEqual([expect.stringContaining('expected-failure-test')]);
  });

  it('H009_DETECTS_PYTEST_DECORATOR_SKIP_AND_XFAIL', () => {
    for (const marker of ['skip', 'xfail']) {
      const source = ['@pytest.mark.', marker, '\ndef test_probe():\n    pass\n'].join('');
      expect(inspectTestDebtSource('tests/probe.py', source))
        .toEqual([expect.stringContaining(`pytest-disabled-test:${marker}`)]);
    }
  });

  it('H009_DETECTS_REPOSITORY_WIDE_QUARANTINE_MARKERS', () => {
    const source = ['// @', 'quarantine', '\nexport const probe = true;'].join('');
    expect(inspectTestDebtSource('components/probe.ts', source))
      .toEqual([expect.stringContaining('quarantined-test-marker')]);
  });

  it('H009_SCANS_SHELL_TEST_RUNNERS_FOR_EMPTY_LANE_OPTIONS', () => {
    const root = mkdtempSync(join(tmpdir(), 'aria-zero-debt-'));
    const path = join(root, 'probe.sh');
    writeFileSync(path, ['npm test --', 'pass', 'With', 'No', 'Tests', '\n'].join(''));
    try {
      expect(inspectRepositoryTestDebt([path]).findings)
        .toEqual([expect.stringContaining('empty-test-lane-option')]);
    } finally {
      rmSync(root, { recursive: true });
    }
  });

  it('H009_EVERY_TRACKED_ARIA_QUALIFICATION_TEST_IS_COLLECTED_EXACTLY_ONCE', () => {
    const tracked = [
      '__tests__/lib/aria/owned.test.ts',
      '__tests__/api/aria-owned.test.ts',
      'e2e/aria/owned.spec.ts',
    ];
    expect(auditAriaQualificationCollection(tracked, tracked)).toEqual({
      tracked: 3,
      ignored: [],
      duplicated: [],
    });
    expect(auditAriaQualificationCollection(tracked, [tracked[0]!, tracked[2]!])).toEqual({
      tracked: 3,
      ignored: ['__tests__/api/aria-owned.test.ts'],
      duplicated: [],
    });
    expect(auditAriaQualificationCollection(tracked, [...tracked, tracked[2]!])).toEqual({
      tracked: 3,
      ignored: [],
      duplicated: ['e2e/aria/owned.spec.ts'],
    });
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
