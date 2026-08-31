import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  checkAriaTestTraceability,
  runAriaTestTraceabilityCheck,
} from '@/scripts/aria/check-test-traceability';
import {
  expectedAriaQualificationIds,
  type AriaQualificationCase,
  type AriaQualificationLane,
} from '@/scripts/aria/qualification-evidence';

const HEAD_SHA = 'f'.repeat(40);
const PLAN_PATH = 'docs/superpowers/plans/2026-08-30-aria-b-conversation-foundation.md';

function write(root: string, path: string, value: unknown): void {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, typeof value === 'string' ? value : `${JSON.stringify(value)}\n`);
}

function laneFor(id: string): AriaQualificationLane {
  if (id.startsWith('A')) return 'api';
  if (id.startsWith('I')) return 'integration';
  if (id.startsWith('D')) return 'database';
  if (id.startsWith('H')) return 'architecture';
  if (id.startsWith('E')) return 'e2e';
  if (id.startsWith('S')) return 'smoke';
  return 'unit';
}

function qualificationCase(id: string): AriaQualificationCase {
  return {
    id,
    lane: laneFor(id),
    status: 'PASSED',
    title: `${id} fixture proof`,
    path: `fixture/${id}.test.ts`,
  };
}

function playwrightReport(ids: readonly string[]): object {
  return {
    suites: ids.length === 0 ? [] : [{
      file: 'fixture/aria.spec.ts',
      specs: ids.map((id) => ({
        title: `${id} fixture proof`,
        tests: [{ results: [{ status: 'passed' }] }],
      })),
    }],
  };
}

function requirementRow(id: string): string {
  return [
    id,
    `Requirement ${id}`,
    'P0 fixture risk',
    'U001',
    'A001',
    'I001',
    'D001',
    'E001',
    'H001',
    'U002',
    'S001',
    'fixture expected result',
  ].join(' | ').replace(/^/, '| ').concat(' |');
}

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'aria-traceability-'));
  const requirements = Array.from({ length: 64 }, (_, index) =>
    `CR-${String(index + 1).padStart(3, '0')}`);
  write(
    root,
    PLAN_PATH,
    `${requirements.map(requirementRow).join('\n')}\n`,
  );
  write(root, 'data/aria/testing/aria-b-evidence.v1.json', {
    schemaVersion: 1,
    requirements: requirements.map((requirementId) => ({
      requirementId,
      expectedResult: `${requirementId} passes`,
    })),
  });

  const ids = expectedAriaQualificationIds();
  const e2eIds = ids.filter((id) => id.startsWith('E'));
  const smokeIds = ids.filter((id) => id.startsWith('S'));
  const jestCases = ids
    .filter((id) => !id.startsWith('E') && !id.startsWith('S'))
    .map(qualificationCase);
  write(root, '.artifacts/aria/qualification/jest-evidence.json', {
    schemaVersion: 1,
    headSha: HEAD_SHA,
    cases: jestCases,
  });
  for (const [project, projectIds] of [
    ['aria-desktop', e2eIds],
    ['aria-mobile', []],
    ['aria-a11y', []],
    ['aria-smoke', smokeIds],
  ] as const) {
    write(root, `.artifacts/aria/playwright/${project}/head.sha`, `${HEAD_SHA}\n`);
    write(root, `.artifacts/aria/playwright/${project}/report.json`, playwrightReport(projectIds));
  }
  return root;
}

describe('ARIA requirement-to-test traceability checker', () => {
  it('accepts exactly 64 critical requirements backed by all 295 exact-head cases', () => {
    const report = checkAriaTestTraceability({
      repositoryRoot: fixtureRoot(),
      headSha: HEAD_SHA,
    });

    expect(report).toEqual({
      criticalRequirements: 64,
      criticalRequirementsWithoutTestEvidence: 0,
      requirementTestLinks: 512,
      qualificationCasesPassed: 295,
      headSha: HEAD_SHA,
    });
  });

  it('renders the reproducible gate metrics through the CLI runner', () => {
    const output: string[] = [];
    expect(runAriaTestTraceabilityCheck({
      repositoryRoot: fixtureRoot(),
      headSha: HEAD_SHA,
      write: (value) => output.push(value),
    })).toBe(0);
    expect(output.join('')).toBe([
      'CRITICAL_REQUIREMENTS=64',
      'CRITICAL_REQUIREMENTS_WITHOUT_TEST_EVIDENCE=0',
      'ARIA_REQUIREMENT_TEST_LINKS=512',
      'ARIA_QUALIFICATION_CASES_PASSED=295',
      `ARIA_QUALIFICATION_HEAD=${HEAD_SHA}`,
      '',
    ].join('\n'));
  });

  it('fails closed when the plan matrix is malformed, empty or non-contiguous', () => {
    const malformed = fixtureRoot();
    write(malformed, PLAN_PATH,
      `${requirementRow('CR-001').replace(' | S001 |', ' |  |')}\n`);
    expect(() => checkAriaTestTraceability({ repositoryRoot: malformed, headSha: HEAD_SHA }))
      .toThrow('EMPTY_CELL:CR-001');

    const noRows = fixtureRoot();
    write(noRows, PLAN_PATH, '# none\n');
    expect(() => checkAriaTestTraceability({ repositoryRoot: noRows, headSha: HEAD_SHA }))
      .toThrow('REQUIREMENT_COUNT:0');

    const nonContiguous = fixtureRoot();
    const rows = Array.from({ length: 64 }, (_, index) =>
      requirementRow(`CR-${String(index + 2).padStart(3, '0')}`));
    write(nonContiguous, PLAN_PATH, `${rows.join('\n')}\n`);
    expect(() => checkAriaTestTraceability({ repositoryRoot: nonContiguous, headSha: HEAD_SHA }))
      .toThrow('NON_CONTIGUOUS:CR-001:CR-002');
  });

  it('rejects missing integration evidence, unknown qualification IDs and column drift', () => {
    const integration = fixtureRoot();
    const valid = requirementRow('CR-001');
    const cells = valid.split('|').slice(1, -1).map((cell) => cell.trim());
    cells[5] = 'N/A';
    cells[6] = 'N/A';
    cells[7] = 'N/A';
    write(integration, PLAN_PATH,
      `| ${cells.join(' | ')} |\n`);
    expect(() => checkAriaTestTraceability({ repositoryRoot: integration, headSha: HEAD_SHA }))
      .toThrow('UNJUSTIFIED_INTEGRATION_EVIDENCE:CR-001');

    const unknown = fixtureRoot();
    write(unknown, PLAN_PATH,
      `${requirementRow('CR-001').replace('U001', 'U999')}\n`);
    expect(() => checkAriaTestTraceability({ repositoryRoot: unknown, headSha: HEAD_SHA }))
      .toThrow('UNKNOWN_QUALIFICATION_REFERENCE:CR-001:U999');

    const columns = fixtureRoot();
    write(columns, PLAN_PATH,
      '| CR-001 | too few | columns |\n');
    expect(() => checkAriaTestTraceability({ repositoryRoot: columns, headSha: HEAD_SHA }))
      .toThrow('COLUMN_COUNT:CR-001:3');

    const invalidId = fixtureRoot();
    write(invalidId, PLAN_PATH, `${requirementRow('CR-X01')}\n`);
    expect(() => checkAriaTestTraceability({ repositoryRoot: invalidId, headSha: HEAD_SHA }))
      .toThrow('REQUIREMENT_ID:CR-X01');

    const noExecutableEvidence = fixtureRoot();
    const noEvidenceCells = requirementRow('CR-001').split('|').slice(1, -1)
      .map((cell) => cell.trim());
    noEvidenceCells.splice(3, 8, 'N/A', 'N/A', 'documented integration check', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A');
    write(noExecutableEvidence, PLAN_PATH, `| ${noEvidenceCells.join(' | ')} |\n`);
    expect(() => checkAriaTestTraceability({
      repositoryRoot: noExecutableEvidence, headSha: HEAD_SHA,
    })).toThrow('NO_EXECUTABLE_EVIDENCE:CR-001');
  });

  it('rejects invalid requirement registries and missing execution artifacts', () => {
    const registry = fixtureRoot();
    write(registry, 'data/aria/testing/aria-b-evidence.v1.json', {
      schemaVersion: 1,
      requirements: [{ requirementId: 'CR-001', expectedResult: 'pass' }],
    });
    expect(() => checkAriaTestTraceability({ repositoryRoot: registry, headSha: HEAD_SHA }))
      .toThrow('REQUIREMENT_REGISTRY_IDS');

    const schema = fixtureRoot();
    write(schema, 'data/aria/testing/aria-b-evidence.v1.json', {
      schemaVersion: 2,
      requirements: [],
    });
    expect(() => checkAriaTestTraceability({ repositoryRoot: schema, headSha: HEAD_SHA }))
      .toThrow('REQUIREMENT_REGISTRY_SCHEMA');

    for (const invalidItem of [null, {}, { requirementId: 1, expectedResult: 'pass' }, {
      requirementId: 'CR-001', expectedResult: '',
    }]) {
      const invalid = fixtureRoot();
      write(invalid, 'data/aria/testing/aria-b-evidence.v1.json', {
        schemaVersion: 1,
        requirements: [invalidItem],
      });
      expect(() => checkAriaTestTraceability({ repositoryRoot: invalid, headSha: HEAD_SHA }))
        .toThrow('REQUIREMENT_REGISTRY_ITEM');
    }

    const missing = fixtureRoot();
    unlinkSync(join(missing, '.artifacts/aria/qualification/jest-evidence.json'));
    expect(() => checkAriaTestTraceability({ repositoryRoot: missing, headSha: HEAD_SHA }))
      .toThrow('EXECUTION_EVIDENCE_MISSING:.artifacts/aria/qualification/jest-evidence.json');
  });

  it('rejects stale Playwright evidence and non-passing requirement evidence', () => {
    const stale = fixtureRoot();
    write(stale, '.artifacts/aria/playwright/aria-mobile/head.sha', `${'0'.repeat(40)}\n`);
    expect(() => checkAriaTestTraceability({ repositoryRoot: stale, headSha: HEAD_SHA }))
      .toThrow('STALE_E2E:aria-mobile');

    const failed = fixtureRoot();
    const artifactPath = '.artifacts/aria/qualification/jest-evidence.json';
    const ids = expectedAriaQualificationIds()
      .filter((id) => !id.startsWith('E') && !id.startsWith('S'));
    write(failed, artifactPath, {
      schemaVersion: 1,
      headSha: HEAD_SHA,
      cases: ids.map((id) => ({
        ...qualificationCase(id),
        status: id === 'U001' ? 'FAILED' : 'PASSED',
      })),
    });
    expect(() => checkAriaTestTraceability({ repositoryRoot: failed, headSha: HEAD_SHA }))
      .toThrow('FAILED:U001');

    for (const invalidEvidence of [
      { schemaVersion: 2, headSha: HEAD_SHA, cases: [] },
      { schemaVersion: 1, headSha: '0'.repeat(40), cases: [] },
      { schemaVersion: 1, headSha: HEAD_SHA, cases: null },
    ]) {
      const invalid = fixtureRoot();
      write(invalid, '.artifacts/aria/qualification/jest-evidence.json', invalidEvidence);
      expect(() => checkAriaTestTraceability({ repositoryRoot: invalid, headSha: HEAD_SHA }))
        .toThrow('STALE_OR_INVALID_EVIDENCE:.artifacts/aria/qualification/jest-evidence.json');
    }

    const missingHead = fixtureRoot();
    unlinkSync(join(missingHead, '.artifacts/aria/playwright/aria-desktop/head.sha'));
    expect(() => checkAriaTestTraceability({ repositoryRoot: missingHead, headSha: HEAD_SHA }))
      .toThrow('STALE_E2E:aria-desktop');
  });

  it('can derive the current Git HEAD and use the default output writer', () => {
    const root = fixtureRoot();
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', [
      '-c', 'user.name=ARIA Test', '-c', 'user.email=aria@example.invalid',
      'commit', '--quiet', '-m', 'fixture',
    ], { cwd: root });
    const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const evidencePath = join(root, '.artifacts/aria/qualification/jest-evidence.json');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as Record<string, unknown>;
    write(root, '.artifacts/aria/qualification/jest-evidence.json', { ...evidence, headSha: gitHead });
    for (const project of ['aria-desktop', 'aria-mobile', 'aria-a11y', 'aria-smoke']) {
      write(root, `.artifacts/aria/playwright/${project}/head.sha`, `${gitHead}\n`);
    }
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    expect(runAriaTestTraceabilityCheck({ repositoryRoot: root })).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`ARIA_QUALIFICATION_HEAD=${gitHead}\n`);
    stdout.mockRestore();
  });
});
