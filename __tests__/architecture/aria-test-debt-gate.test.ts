import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import {
  auditAriaQualificationCollection,
  inspectRepositoryTestDebt,
  inspectTestDebtSource,
} from '../../scripts/testing/check-zero-test-debt.mjs';
import { source, sourceFilesUnder } from './aria-boundary-helpers';

describe('ARIA zero test debt gate', () => {
  it('H009 owns every architecture qualification ID in exactly one concrete assertion', () => {
    const owners = new Map<string, string[]>();
    const suiteOwners: string[] = [];
    for (const file of sourceFilesUnder('__tests__/architecture')) {
      const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const callee = node.expression.getText(ast);
          const ids = node.arguments[0].text.match(/(?<![\p{L}\p{N}\p{M}_])H\d{3}(?![\p{L}\p{N}\p{M}_])/gu) ?? [];
          if (callee === 'describe') suiteOwners.push(...ids.map((id) => `${file}:${id}`));
          if (callee === 'it' || callee === 'test') {
            for (const id of ids) owners.set(id, [...(owners.get(id) ?? []), file]);
          }
        }
        node.forEachChild(visit);
      };
      visit(ast);
    }

    const expected = Array.from({ length: 12 }, (_, index) =>
      `H${String(index + 1).padStart(3, '0')}`);
    expect(suiteOwners).toEqual([]);
    expect([...owners.keys()].sort()).toEqual(expected);
    expect([...owners].filter(([, files]) => files.length !== 1)).toEqual([]);
  });

  it('CI runs the canonical zero test debt gate', () => {
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

  it('detects chained disabled and focused modifiers', () => {
    const chainedSkip = ['test', '.', 'skip', '.', 'each', '([[1]])', "('probe', () => undefined)"].join('');
    const chainedOnly = ['test', '.', 'only', '.', 'each', '([[1]])', "('probe', () => undefined)"].join('');
    const destructuredSkip = ['const { ', 'skip', ' } = test; ', 'skip', "('probe', () => undefined)"].join('');
    const optionSkip = ['test', "('probe', { ", 'skip', ': true }, () => undefined)'].join('');
    for (const source of [chainedSkip, chainedOnly, destructuredSkip, optionSkip]) {
      expect(inspectTestDebtSource('probe.test.ts', source))
        .toEqual([expect.stringContaining('focused-or-disabled-test')]);
    }
  });

  it('detects expected failure markers', () => {
    const source = ['test', '.', 'failing', "('probe', () => undefined)"].join('');
    expect(inspectTestDebtSource('probe.test.ts', source))
      .toEqual([expect.stringContaining('expected-failure-test')]);
  });

  it('detects pytest decorator skips and expected failures', () => {
    for (const marker of ['skip', 'xfail']) {
      const source = ['@pytest.mark.', marker, '\ndef test_probe():\n    pass\n'].join('');
      expect(inspectTestDebtSource('tests/probe.py', source))
        .toEqual([expect.stringContaining(`pytest-disabled-test:${marker}`)]);
    }
  });

  it('detects repository-wide quarantine markers', () => {
    const source = ['// @', 'quarantine', '\nexport const probe = true;'].join('');
    expect(inspectTestDebtSource('components/probe.ts', source))
      .toEqual([expect.stringContaining('quarantined-test-marker')]);
  });

  it('scans shell test runners for empty-lane options', () => {
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

  it('collects every tracked ARIA qualification test exactly once', () => {
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
