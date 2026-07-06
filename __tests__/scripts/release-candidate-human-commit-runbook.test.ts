import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const RUNBOOK_PATH = join(ROOT, 'docs/go-live/_evidence/lot11-human-commit-runbook.md');
const DRY_RUN_PLAN_PATH = join(ROOT, 'docs/go-live/_evidence/lot10-git-add-dry-run-plan.md');
const MANIFEST_PATH = join(ROOT, 'docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md');
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

function parseCommitBlocks(markdown: string): CommitBlock[] {
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

    if (line.startsWith('## ') && current) {
      blocks.push(current);
      current = null;
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

describe('release candidate human commit runbook', () => {
  const manifestRows = parseManifest(readFileSync(MANIFEST_PATH, 'utf8'));
  const runbook = readFileSync(RUNBOOK_PATH, 'utf8');
  const dryRunPlan = readFileSync(DRY_RUN_PLAN_PATH, 'utf8');
  const commitBlocks = parseCommitBlocks(runbook);

  it('covers every Include RC file exactly once in standard commit blocks', () => {
    const fileToCommits = new Map<string, string[]>();
    for (const block of commitBlocks) {
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

  it('keeps excluded and human-review files out of standard commit staging commands', () => {
    const stagedFiles = new Set(commitBlocks.flatMap((block) => block.files));

    const excludedInRunbook = manifestRows
      .filter((row) => row.group === 'Exclude')
      .filter((row) => stagedFiles.has(row.path))
      .map((row) => row.path);

    const humanReviewInRunbook = manifestRows
      .filter((row) => row.group === 'Needs human review')
      .filter((row) => stagedFiles.has(row.path))
      .map((row) => row.path);

    const forbiddenFiles = [...stagedFiles].filter(
      (file) => /(^|\/)\.env($|\.)/.test(file) || file === 'rapport_audit_2_07_2026.md',
    );

    expect(excludedInRunbook).toEqual([]);
    expect(humanReviewInRunbook).toEqual([]);
    expect(forbiddenFiles).toEqual([]);
    expect(runbook).not.toContain('rapport_audit_2_07_2026.md');
    expect(runbook).not.toMatch(/(^|\/)\.env($|\.)/m);
  });

  it('uses human-only staging and commit commands without push or PR creation', () => {
    expect(commitBlocks).toHaveLength(9);
    expect(runbook).toContain('Codex ne les a pas executees');

    for (const block of commitBlocks) {
      expect(block.body).toContain('git add --');
      expect(block.body).not.toContain('git add --dry-run --');
      expect(block.body).toContain('git diff --cached --name-only');
      expect(block.body).toContain(`git commit -m "${block.title}"`);
      expect(block.files.every((file) => runbook.includes(`"${file}"`))).toBe(true);
    }

    expect(runbook).not.toMatch(/git push/);
    expect(runbook).not.toMatch(/gh pr create/);
  });

  it('keeps Lot 10 dry-run commit names as the source of truth', () => {
    for (const block of commitBlocks) {
      expect(dryRunPlan).toContain(`## Commit ${commitBlocks.indexOf(block) + 1} — ${block.title}`);
    }
  });

  it('keeps the six release-candidate P1 routes visible', () => {
    const p1Routes = parseP1Routes(readFileSync(API_MATRIX_PATH, 'utf8'));
    expect(p1Routes).toEqual(EXPECTED_P1_ROUTES);
  });
});
