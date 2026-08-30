import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLAN = resolve(
  process.cwd(),
  'docs/superpowers/plans/2026-08-30-aria-b-conversation-foundation.md',
);
const EVIDENCE = resolve(process.cwd(), 'data/aria/testing/aria-b-evidence.v1.json');
const REQUIREMENT_ID = /^CR-(\d{3})$/;

interface EvidenceItem {
  readonly path: string;
  readonly marker: string;
}

interface RequirementEvidence {
  readonly requirementId: string;
  readonly expectedResult: string;
  readonly evidence: readonly EvidenceItem[];
}

interface EvidenceDocument {
  readonly schemaVersion: 1;
  readonly requirements: readonly RequirementEvidence[];
}

function fail(message: string): never {
  throw new Error(`ARIA_TEST_TRACEABILITY_INVALID:${message}`);
}

function parseRequirements(): readonly string[] {
  const rows = readFileSync(PLAN, 'utf8')
    .split('\n')
    .filter((line) => /^\| CR-\d{3} \|/.test(line));
  const ids: string[] = [];
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 12) fail(`COLUMN_COUNT:${cells[0] ?? 'UNKNOWN'}:${cells.length}`);
    const [
      id, requirement, risk, unit, api, integration, realDb, e2e, architecture, negative, smoke,
      expected,
    ] = cells;
    if (!REQUIREMENT_ID.test(id)) fail(`REQUIREMENT_ID:${id}`);
    if ([requirement, risk, unit, api, integration, realDb, e2e, architecture, negative, smoke, expected]
      .some((cell) => cell.length === 0)) fail(`EMPTY_CELL:${id}`);
    if ([integration, realDb, e2e].every((cell) => cell === 'N/A')) {
      fail(`UNJUSTIFIED_INTEGRATION_EVIDENCE:${id}`);
    }
    ids.push(id);
  }
  if (ids.length !== 64) fail(`REQUIREMENT_COUNT:${ids.length}`);
  if (new Set(ids).size !== ids.length) fail('DUPLICATE_REQUIREMENT_ID');
  ids.forEach((id, index) => {
    const expected = `CR-${String(index + 1).padStart(3, '0')}`;
    if (id !== expected) fail(`NON_CONTIGUOUS:${expected}:${id}`);
  });
  return ids;
}

function loadEvidence(): EvidenceDocument {
  if (!existsSync(EVIDENCE)) fail('EVIDENCE_FILE_MISSING');
  const parsed = JSON.parse(readFileSync(EVIDENCE, 'utf8')) as Partial<EvidenceDocument>;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.requirements)) fail('EVIDENCE_SCHEMA');
  return parsed as EvidenceDocument;
}

function main(): void {
  const requirementIds = parseRequirements();
  const document = loadEvidence();
  const evidenceById = new Map<string, RequirementEvidence>();
  for (const item of document.requirements) {
    if (evidenceById.has(item.requirementId)) fail(`DUPLICATE_EVIDENCE:${item.requirementId}`);
    evidenceById.set(item.requirementId, item);
  }

  const uncovered: string[] = [];
  for (const requirementId of requirementIds) {
    const item = evidenceById.get(requirementId);
    if (!item || !item.expectedResult || !Array.isArray(item.evidence) || item.evidence.length === 0) {
      uncovered.push(requirementId);
      continue;
    }
    for (const evidence of item.evidence) {
      const path = resolve(process.cwd(), evidence.path);
      if (!existsSync(path)) fail(`EVIDENCE_PATH_MISSING:${requirementId}:${evidence.path}`);
      if (!evidence.marker || !readFileSync(path, 'utf8').includes(evidence.marker)) {
        fail(`EVIDENCE_MARKER_MISSING:${requirementId}:${evidence.path}:${evidence.marker}`);
      }
    }
  }
  const unknown = [...evidenceById.keys()].filter((id) => !requirementIds.includes(id));
  if (unknown.length > 0) fail(`UNKNOWN_EVIDENCE:${unknown.join(',')}`);

  process.stdout.write(`CRITICAL_REQUIREMENTS=${requirementIds.length}\n`);
  process.stdout.write(`CRITICAL_REQUIREMENTS_WITHOUT_TEST_EVIDENCE=${uncovered.length}\n`);
  if (uncovered.length > 0) fail(`UNCOVERED:${uncovered.join(',')}`);
}

main();
