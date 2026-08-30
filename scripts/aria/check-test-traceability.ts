import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
  extractQualificationCasesFromPlaywright,
  expectedAriaQualificationIds,
  qualificationIdsInReference,
  validateAriaQualificationEvidence,
  type AriaQualificationCase,
  type AriaQualificationEvidence,
} from './qualification-evidence';

const REQUIREMENT_ID = /^CR-(\d{3})$/;

interface RequirementTrace {
  readonly id: string;
  readonly qualificationIds: readonly string[];
}

export interface AriaTestTraceabilityReport {
  readonly criticalRequirements: number;
  readonly criticalRequirementsWithoutTestEvidence: 0;
  readonly requirementTestLinks: number;
  readonly qualificationCasesPassed: number;
  readonly headSha: string;
}

interface AriaTestTraceabilityOptions {
  readonly repositoryRoot?: string;
  readonly headSha?: string;
}

interface AriaTestTraceabilityRunnerOptions extends AriaTestTraceabilityOptions {
  readonly write?: (value: string) => void;
}

function fail(message: string): never {
  throw new Error(`ARIA_TEST_TRACEABILITY_INVALID:${message}`);
}

function relativePath(repositoryRoot: string, path: string): string {
  return relative(repositoryRoot, path);
}

function readJson(path: string, repositoryRoot: string): unknown {
  if (!existsSync(path)) {
    fail(`EXECUTION_EVIDENCE_MISSING:${relativePath(repositoryRoot, path)}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function currentHead(repositoryRoot: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
}

function parseRequirements(repositoryRoot: string): readonly RequirementTrace[] {
  const plan = resolve(
    repositoryRoot,
    'docs/superpowers/plans/2026-08-30-aria-b-conversation-foundation.md',
  );
  const rows = readFileSync(plan, 'utf8').split('\n')
    .filter((line) => /^\| CR-[^|]+ \|/.test(line));
  const requirements: RequirementTrace[] = [];
  const knownQualificationIds = new Set(expectedAriaQualificationIds());
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 12) fail(`COLUMN_COUNT:${cells[0]}:${cells.length}`);
    const [id, ...evidenceCells] = cells;
    if (!REQUIREMENT_ID.test(id)) fail(`REQUIREMENT_ID:${id}`);
    if (evidenceCells.some((cell) => cell.length === 0)) fail(`EMPTY_CELL:${id}`);
    const integrationEvidence = evidenceCells.slice(4, 7);
    if (integrationEvidence.every((cell) => cell === 'N/A')) {
      fail(`UNJUSTIFIED_INTEGRATION_EVIDENCE:${id}`);
    }
    const qualificationIds = evidenceCells.slice(2, 10)
      .flatMap((cell) => qualificationIdsInReference(cell));
    if (qualificationIds.length === 0) fail(`NO_EXECUTABLE_EVIDENCE:${id}`);
    const unknown = qualificationIds.find((qualificationId) => !knownQualificationIds.has(qualificationId));
    if (unknown) fail(`UNKNOWN_QUALIFICATION_REFERENCE:${id}:${unknown}`);
    requirements.push(Object.freeze({ id, qualificationIds: Object.freeze(qualificationIds) }));
  }
  if (requirements.length !== 64) fail(`REQUIREMENT_COUNT:${requirements.length}`);
  requirements.forEach(({ id }, index) => {
    const expected = `CR-${String(index + 1).padStart(3, '0')}`;
    if (id !== expected) fail(`NON_CONTIGUOUS:${expected}:${id}`);
  });
  return Object.freeze(requirements);
}

function validateRequirementRegistry(
  repositoryRoot: string,
  requirements: readonly RequirementTrace[],
): void {
  const registryPath = resolve(repositoryRoot, 'data/aria/testing/aria-b-evidence.v1.json');
  const registry = readJson(registryPath, repositoryRoot) as {
    readonly schemaVersion?: unknown;
    readonly requirements?: unknown;
  };
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.requirements)) {
    fail('REQUIREMENT_REGISTRY_SCHEMA');
  }
  const registered = registry.requirements.map((item) => {
    if (typeof item !== 'object' || item === null) fail('REQUIREMENT_REGISTRY_ITEM');
    const value = item as { readonly requirementId?: unknown; readonly expectedResult?: unknown };
    if (typeof value.requirementId !== 'string' || typeof value.expectedResult !== 'string'
      || value.expectedResult.length === 0) fail('REQUIREMENT_REGISTRY_ITEM');
    return value.requirementId;
  });
  if (JSON.stringify(registered) !== JSON.stringify(requirements.map(({ id }) => id))) {
    fail('REQUIREMENT_REGISTRY_IDS');
  }
}

function loadHeadBoundCases(
  path: string,
  expectedHeadSha: string,
  repositoryRoot: string,
): readonly AriaQualificationCase[] {
  const document = readJson(path, repositoryRoot) as Partial<AriaQualificationEvidence>;
  if (document.schemaVersion !== 1 || document.headSha !== expectedHeadSha || !Array.isArray(document.cases)) {
    fail(`STALE_OR_INVALID_EVIDENCE:${relativePath(repositoryRoot, path)}`);
  }
  return document.cases;
}

function loadPlaywrightCases(
  repositoryRoot: string,
  expectedHeadSha: string,
): readonly AriaQualificationCase[] {
  const artifactRoot = resolve(repositoryRoot, '.artifacts/aria');
  return [
    { project: 'aria-desktop', lane: 'e2e' },
    { project: 'aria-mobile', lane: 'e2e' },
    { project: 'aria-a11y', lane: 'e2e' },
    { project: 'aria-smoke', lane: 'smoke' },
  ].flatMap(({ project, lane }) => {
    const root = resolve(artifactRoot, 'playwright', project);
    const artifactHead = existsSync(resolve(root, 'head.sha'))
      ? readFileSync(resolve(root, 'head.sha'), 'utf8').trim()
      : '';
    if (artifactHead !== expectedHeadSha) fail(`STALE_E2E:${project}`);
    return extractQualificationCasesFromPlaywright(
      readJson(resolve(root, 'report.json'), repositoryRoot) as { suites?: unknown },
      lane as 'e2e' | 'smoke',
    );
  });
}

export function checkAriaTestTraceability(
  options: AriaTestTraceabilityOptions = {},
): AriaTestTraceabilityReport {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const artifactRoot = resolve(repositoryRoot, '.artifacts/aria');
  const requirements = parseRequirements(repositoryRoot);
  validateRequirementRegistry(repositoryRoot, requirements);
  const headSha = options.headSha ?? currentHead(repositoryRoot);
  const cases = [
    ...loadHeadBoundCases(
      resolve(artifactRoot, 'qualification/jest-evidence.json'),
      headSha,
      repositoryRoot,
    ),
    ...loadPlaywrightCases(repositoryRoot, headSha),
  ];
  const report = validateAriaQualificationEvidence({ schemaVersion: 1, headSha, cases }, headSha);
  return Object.freeze({
    criticalRequirements: requirements.length,
    criticalRequirementsWithoutTestEvidence: 0,
    requirementTestLinks: requirements.reduce(
      (total, requirement) => total + requirement.qualificationIds.length,
      0,
    ),
    qualificationCasesPassed: report.passed,
    headSha: report.headSha,
  });
}

export function runAriaTestTraceabilityCheck(
  options: AriaTestTraceabilityRunnerOptions = {},
): 0 {
  const report = checkAriaTestTraceability(options);
  const write = options.write ?? process.stdout.write.bind(process.stdout);
  write(`CRITICAL_REQUIREMENTS=${report.criticalRequirements}\n`);
  write(`CRITICAL_REQUIREMENTS_WITHOUT_TEST_EVIDENCE=${report.criticalRequirementsWithoutTestEvidence}\n`);
  write(`ARIA_REQUIREMENT_TEST_LINKS=${report.requirementTestLinks}\n`);
  write(`ARIA_QUALIFICATION_CASES_PASSED=${report.qualificationCasesPassed}\n`);
  write(`ARIA_QUALIFICATION_HEAD=${report.headSha}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = runAriaTestTraceabilityCheck();
}
