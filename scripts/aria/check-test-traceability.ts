import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  extractQualificationCasesFromPlaywright,
  expectedAriaQualificationIds,
  qualificationIdsInReference,
  validateAriaQualificationEvidence,
  type AriaQualificationCase,
  type AriaQualificationEvidence,
} from './qualification-evidence';

const ROOT = process.cwd();
const PLAN = resolve(ROOT, 'docs/superpowers/plans/2026-08-30-aria-b-conversation-foundation.md');
const REQUIREMENT_REGISTRY = resolve(ROOT, 'data/aria/testing/aria-b-evidence.v1.json');
const ARTIFACT_ROOT = resolve(ROOT, '.artifacts/aria');
const REQUIREMENT_ID = /^CR-(\d{3})$/;

interface RequirementTrace {
  readonly id: string;
  readonly qualificationIds: readonly string[];
}

function fail(message: string): never {
  throw new Error(`ARIA_TEST_TRACEABILITY_INVALID:${message}`);
}

function readJson(path: string): unknown {
  if (!existsSync(path)) fail(`EXECUTION_EVIDENCE_MISSING:${path.replace(`${ROOT}/`, '')}`);
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function currentHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
}

function parseRequirements(): readonly RequirementTrace[] {
  const rows = readFileSync(PLAN, 'utf8').split('\n').filter((line) => /^\| CR-\d{3} \|/.test(line));
  const requirements: RequirementTrace[] = [];
  const knownQualificationIds = new Set(expectedAriaQualificationIds());
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 12) fail(`COLUMN_COUNT:${cells[0] ?? 'UNKNOWN'}:${cells.length}`);
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

function validateRequirementRegistry(requirements: readonly RequirementTrace[]): void {
  const registry = readJson(REQUIREMENT_REGISTRY) as {
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

function loadHeadBoundCases(path: string, expectedHeadSha: string): readonly AriaQualificationCase[] {
  const document = readJson(path) as Partial<AriaQualificationEvidence>;
  if (document.schemaVersion !== 1 || document.headSha !== expectedHeadSha || !Array.isArray(document.cases)) {
    fail(`STALE_OR_INVALID_EVIDENCE:${path.replace(`${ROOT}/`, '')}`);
  }
  return document.cases;
}

function loadPlaywrightCases(expectedHeadSha: string): readonly AriaQualificationCase[] {
  return [
    { project: 'aria-desktop', lane: 'e2e' },
    { project: 'aria-mobile', lane: 'e2e' },
    { project: 'aria-a11y', lane: 'e2e' },
    { project: 'aria-smoke', lane: 'smoke' },
  ].flatMap(({ project, lane }) => {
    const root = resolve(ARTIFACT_ROOT, 'playwright', project);
    const artifactHead = existsSync(resolve(root, 'head.sha'))
      ? readFileSync(resolve(root, 'head.sha'), 'utf8').trim()
      : '';
    if (artifactHead !== expectedHeadSha) fail(`STALE_E2E:${project}`);
    return extractQualificationCasesFromPlaywright(
      readJson(resolve(root, 'report.json')) as { suites?: unknown },
      lane as 'e2e' | 'smoke',
    );
  });
}

function main(): void {
  const requirements = parseRequirements();
  validateRequirementRegistry(requirements);
  const headSha = currentHead();
  const cases = [
    ...loadHeadBoundCases(resolve(ARTIFACT_ROOT, 'qualification/jest-evidence.json'), headSha),
    ...loadPlaywrightCases(headSha),
  ];
  const report = validateAriaQualificationEvidence({ schemaVersion: 1, headSha, cases }, headSha);
  const passedIds = new Set(cases.filter(({ status }) => status === 'PASSED').map(({ id }) => id));
  for (const requirement of requirements) {
    const missing = requirement.qualificationIds.filter((id) => !passedIds.has(id));
    if (missing.length > 0) fail(`REQUIREMENT_EVIDENCE_NOT_PASSED:${requirement.id}:${missing.join(',')}`);
  }
  process.stdout.write(`CRITICAL_REQUIREMENTS=${requirements.length}\n`);
  process.stdout.write('CRITICAL_REQUIREMENTS_WITHOUT_TEST_EVIDENCE=0\n');
  process.stdout.write(`ARIA_REQUIREMENT_TEST_LINKS=${requirements.reduce(
    (total, requirement) => total + requirement.qualificationIds.length,
    0,
  )}\n`);
  process.stdout.write(`ARIA_QUALIFICATION_CASES_PASSED=${report.passed}\n`);
  process.stdout.write(`ARIA_QUALIFICATION_HEAD=${report.headSha}\n`);
}

main();
