import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  checkAriaTestTraceability,
  checkAriaRequirementMapping,
  runAriaTestTraceabilityCheck,
} from '@/scripts/aria/check-test-traceability';
import {
  expectedAriaQualificationIds,
  type AriaQualificationCase,
  type AriaQualificationLane,
  validateAriaQualificationEvidence,
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

// These fixtures exercise requirement mapping only; native provenance is tested
// with actual Jest/Playwright producers in test-lane-contract.test.mjs.
function mapping(root: string, cases = expectedAriaQualificationIds().map(qualificationCase)) {
  return checkAriaRequirementMapping({ repositoryRoot: root, headSha: HEAD_SHA, cases });
}

describe('ARIA requirement mapping and native-evidence boundary', () => {
  it('rejects forged head-only documents without verified native producer evidence', () => {
    expect(() => checkAriaTestTraceability({ repositoryRoot: fixtureRoot(), headSha: HEAD_SHA }))
      .toThrow('ARIA_NATIVE_EVIDENCE_REFUSED');
  });

  it('maps exactly 64 critical requirements to all 295 qualification identifiers', () => {
    expect(mapping(fixtureRoot())).toEqual({
      criticalRequirements: 64, criticalRequirementsWithoutTestEvidence: 0,
      requirementTestLinks: 512, qualificationCasesPassed: 295, headSha: HEAD_SHA,
    });
  });

  it('refuses the CLI gate without native evidence and emits no successful metrics', () => {
    const output = jest.fn();
    expect(() => runAriaTestTraceabilityCheck({ repositoryRoot: fixtureRoot(), headSha: HEAD_SHA, write: output }))
      .toThrow('ARIA_NATIVE_EVIDENCE_REFUSED');
    expect(output).not.toHaveBeenCalled();
  });

  it('fails closed when the plan matrix is malformed, empty or non-contiguous', () => {
    const malformed = fixtureRoot();
    write(malformed, PLAN_PATH, `${requirementRow('CR-001').replace(' | S001 |', ' |  |')}\n`);
    expect(() => mapping(malformed)).toThrow('EMPTY_CELL:CR-001');
    const empty = fixtureRoot(); write(empty, PLAN_PATH, '# none\n');
    expect(() => mapping(empty)).toThrow('REQUIREMENT_COUNT:0');
    const nonContiguous = fixtureRoot();
    write(nonContiguous, PLAN_PATH, Array.from({ length: 64 }, (_, i) => requirementRow(`CR-${String(i + 2).padStart(3, '0')}`)).join('\n'));
    expect(() => mapping(nonContiguous)).toThrow('NON_CONTIGUOUS:CR-001:CR-002');
  });

  it('rejects missing integration evidence, unknown qualification IDs and column drift', () => {
    const integration = fixtureRoot();
    const cells = requirementRow('CR-001').split('|').slice(1, -1).map(cell => cell.trim());
    cells[5] = cells[6] = cells[7] = 'N/A';
    write(integration, PLAN_PATH, `| ${cells.join(' | ')} |\n`);
    expect(() => mapping(integration)).toThrow('UNJUSTIFIED_INTEGRATION_EVIDENCE:CR-001');
    const unknown = fixtureRoot(); write(unknown, PLAN_PATH, requirementRow('CR-001').replace('U001', 'U999'));
    expect(() => mapping(unknown)).toThrow('UNKNOWN_QUALIFICATION_REFERENCE:CR-001:U999');
    const columns = fixtureRoot(); write(columns, PLAN_PATH, '| CR-001 | too few | columns |\n');
    expect(() => mapping(columns)).toThrow('COLUMN_COUNT:CR-001:3');
    const invalidId = fixtureRoot(); write(invalidId, PLAN_PATH, requirementRow('CR-X01'));
    expect(() => mapping(invalidId)).toThrow('REQUIREMENT_ID:CR-X01');
    const noExecutable = fixtureRoot();
    const noEvidence = requirementRow('CR-001').split('|').slice(1, -1).map(cell => cell.trim());
    noEvidence.splice(3, 8, 'N/A', 'N/A', 'documented integration check', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A');
    write(noExecutable, PLAN_PATH, `| ${noEvidence.join(' | ')} |\n`);
    expect(() => mapping(noExecutable)).toThrow('NO_EXECUTABLE_EVIDENCE:CR-001');
  });

  it('rejects invalid requirement registries and missing native execution artifacts', () => {
    const registry = fixtureRoot();
    write(registry, 'data/aria/testing/aria-b-evidence.v1.json', { schemaVersion: 1,
      requirements: [{ requirementId: 'CR-001', expectedResult: 'pass' }] });
    expect(() => mapping(registry)).toThrow('REQUIREMENT_REGISTRY_IDS');
    const schema = fixtureRoot(); write(schema, 'data/aria/testing/aria-b-evidence.v1.json', { schemaVersion: 2, requirements: [] });
    expect(() => mapping(schema)).toThrow('REQUIREMENT_REGISTRY_SCHEMA');
    for (const invalidItem of [null, {}, { requirementId: 1, expectedResult: 'pass' }, { requirementId: 'CR-001', expectedResult: '' }]) {
      const root = fixtureRoot(); write(root, 'data/aria/testing/aria-b-evidence.v1.json', { schemaVersion: 1, requirements: [invalidItem] });
      expect(() => mapping(root)).toThrow('REQUIREMENT_REGISTRY_ITEM');
    }
    const missing = fixtureRoot(); unlinkSync(join(missing, '.artifacts/aria/qualification/jest-evidence.json'));
    expect(() => checkAriaTestTraceability({ repositoryRoot: missing, headSha: HEAD_SHA })).toThrow('ARIA_NATIVE_EVIDENCE_REFUSED');
  });

  it('rejects failed, missing, duplicate, unknown and wrongly scoped requirement cases', () => {
    const cases = expectedAriaQualificationIds().map(qualificationCase);
    expect(() => mapping(fixtureRoot(), cases.map(c => c.id === 'U001' ? { ...c, status: 'FAILED' } : c))).toThrow('FAILED:U001');
    expect(() => mapping(fixtureRoot(), cases.filter(c => c.id !== 'U001'))).toThrow('MISSING:U001');
    expect(() => mapping(fixtureRoot(), [...cases, qualificationCase('U001')])).toThrow('DUPLICATE:U001');
    expect(() => mapping(fixtureRoot(), [...cases, qualificationCase('U999')])).toThrow('UNKNOWN:U999');
    expect(() => mapping(fixtureRoot(), cases.map(c => c.id === 'U001' ? { ...c, lane: 'e2e' } : c))).toThrow('LANE:U001');
    expect(() => validateAriaQualificationEvidence({ schemaVersion: 2, headSha: HEAD_SHA, cases } as never, HEAD_SHA)).toThrow('SCHEMA_VERSION');
    expect(() => validateAriaQualificationEvidence({ schemaVersion: 1, headSha: '0'.repeat(40), cases }, HEAD_SHA)).toThrow('STALE_HEAD');
  });

  it('rejects a real Git HEAD without native evidence instead of printing success', () => {
    const root = fixtureRoot();
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['-c', 'user.name=ARIA Test', '-c', 'user.email=aria@example.invalid', 'commit', '--quiet', '-m', 'fixture'], { cwd: root });
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      expect(() => runAriaTestTraceabilityCheck({ repositoryRoot: root })).toThrow('ARIA_NATIVE_EVIDENCE_REFUSED');
      expect(stdout).not.toHaveBeenCalled();
    } finally { stdout.mockRestore(); }
  });
});
