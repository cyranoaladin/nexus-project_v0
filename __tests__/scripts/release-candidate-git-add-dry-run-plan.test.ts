import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DRY_RUN_PLAN_PATH = join(ROOT, 'docs/go-live/_evidence/lot10-git-add-dry-run-plan.md');
const MANIFEST_PATH = join(ROOT, 'docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md');
const COMMIT_PLAN_PATH = join(ROOT, 'docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md');
const API_MATRIX_PATH = join(ROOT, 'docs/go-live/api-security-matrix.full.md');

type ManifestRow = {
  path: string;
  group: string;
  includeRc: boolean;
};

type CommitBlock = {
  title: string;
  body: string;
  files: string[];
};

const EXPECTED_P1_ROUTES = new Set([
  '/api/payments/clictopay/webhook',
  '/api/assessments/submit',
  '/api/bilan-gratuit',
  '/api/lamis/teacher-report',
  '/api/stages/[stageSlug]/inscrire',
  '/api/student/activate',
]);

function cleanCell(cell: string) {
  return cell.trim().replace(/^`|`$/g, '');
}

function parseTableCells(line: string) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parseManifest(markdown: string): ManifestRow[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const cells = parseTableCells(line);
      return {
        path: cleanCell(cells[0]),
        group: cleanCell(cells[2]),
        includeRc: cells[3] === 'Oui',
      };
    });
}

function parseDryRunBlocks(markdown: string): CommitBlock[] {
  const blocks: CommitBlock[] = [];
  const lines = markdown.split('\n');
  let current: CommitBlock | null = null;

  for (const line of lines) {
    const heading = line.match(/^## Commit \d+ — (.+)$/);
    if (heading) {
      if (current) blocks.push(current);
      current = { title: heading[1].trim(), body: '', files: [] };
      continue;
    }

    if (!current) continue;
    current.body += `${line}\n`;

    const quotedPath = line.match(/^\s*"([^"]+)"\s*\\?$/);
    if (quotedPath) {
      current.files.push(quotedPath[1]);
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

function parseP1Routes(markdown: string) {
  const routes = new Set<string>();
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| P1 |') || !line.includes('| `/api/')) continue;
    const cells = parseTableCells(line);
    routes.add(cleanCell(cells[1]));
  }
  return routes;
}

describe('release candidate git add dry-run plan', () => {
  const manifestRows = parseManifest(readFileSync(MANIFEST_PATH, 'utf8'));
  const dryRunPlan = readFileSync(DRY_RUN_PLAN_PATH, 'utf8');
  const dryRunBlocks = parseDryRunBlocks(dryRunPlan);

  it('covers every Include RC file exactly once', () => {
    const fileToCommits = new Map<string, string[]>();
    for (const block of dryRunBlocks) {
      for (const file of block.files) {
        const owners = fileToCommits.get(file) ?? [];
        owners.push(block.title);
        fileToCommits.set(file, owners);
      }
    }

    const uncovered = manifestRows
      .filter((row) => row.includeRc)
      .filter((row) => (fileToCommits.get(row.path) ?? []).length === 0)
      .map((row) => row.path);

    const coveredMultipleTimes = manifestRows
      .filter((row) => row.includeRc)
      .filter((row) => (fileToCommits.get(row.path) ?? []).length > 1)
      .map((row) => `${row.path} -> ${(fileToCommits.get(row.path) ?? []).join(', ')}`);

    expect(uncovered).toEqual([]);
    expect(coveredMultipleTimes).toEqual([]);
  });

  it('does not include Exclude, Needs human review, env or generated artifact files', () => {
    const plannedFiles = new Set(dryRunBlocks.flatMap((block) => block.files));

    const excludedInPlan = manifestRows
      .filter((row) => row.group === 'Exclude')
      .filter((row) => plannedFiles.has(row.path))
      .map((row) => row.path);

    const humanReviewInPlan = manifestRows
      .filter((row) => row.group === 'Needs human review')
      .filter((row) => plannedFiles.has(row.path))
      .map((row) => row.path);

    const forbiddenFiles = [...plannedFiles].filter(
      (file) =>
        /(^|\/)\.env($|\.)/.test(file) ||
        file === 'rapport_audit_2_07_2026.md' ||
        ['test-results/', 'playwright-report/', '.next/', 'node_modules/'].some((prefix) =>
          file.startsWith(prefix),
        ),
    );

    expect(excludedInPlan).toEqual([]);
    expect(humanReviewInPlan).toEqual([]);
    expect(forbiddenFiles).toEqual([]);
  });

  it('uses only safe dry-run git add commands and no commit/push/PR actions', () => {
    expect(dryRunBlocks).toHaveLength(9);
    for (const block of dryRunBlocks) {
      expect(block.body).toContain('git add --dry-run --');
      expect(block.files.every((file) => dryRunPlan.includes(`"${file}"`))).toBe(true);
    }

    expect(dryRunPlan).not.toMatch(/git add --\s/);
    expect(dryRunPlan).not.toMatch(/git push/);
    expect(dryRunPlan).not.toMatch(/gh pr create/);
    expect(dryRunPlan).toContain('Commande de commit proposée, NON EXÉCUTÉE');
  });

  it('keeps the Lot 8 commit plan as the source of commit names', () => {
    const commitPlan = readFileSync(COMMIT_PLAN_PATH, 'utf8');
    for (const block of dryRunBlocks) {
      expect(commitPlan).toContain(block.title);
    }
  });

  it('keeps the six release-candidate P1 routes visible', () => {
    const p1Routes = parseP1Routes(readFileSync(API_MATRIX_PATH, 'utf8'));
    expect(p1Routes).toEqual(EXPECTED_P1_ROUTES);
  });
});
