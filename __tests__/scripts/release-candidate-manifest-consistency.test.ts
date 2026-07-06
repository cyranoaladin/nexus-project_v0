import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MANIFEST_PATH = join(
  ROOT,
  'docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md',
);
const COMMIT_PLAN_PATH = join(
  ROOT,
  'docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md',
);
const API_MATRIX_PATH = join(ROOT, 'docs/go-live/api-security-matrix.full.md');

type ManifestRow = {
  path: string;
  gitState: string;
  group: string;
  includeRc: boolean;
  proposedCommit: string;
};

type CommitCoverage = {
  commits: Map<string, string[]>;
  fileToCommits: Map<string, string[]>;
};

const EXPECTED_P1_ROUTES = [
  '/api/payments/clictopay/webhook',
  '/api/assessments/submit',
  '/api/bilan-gratuit',
  '/api/lamis/teacher-report',
  '/api/stages/[stageSlug]/inscrire',
  '/api/student/activate',
] as const;

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
        gitState: cleanCell(cells[1]),
        group: cleanCell(cells[2]),
        includeRc: cells[3] === 'Oui',
        proposedCommit: cleanCell(cells[4]),
      };
    });
}

function parseCommitPlan(markdown: string): CommitCoverage {
  const commits = new Map<string, string[]>();
  const fileToCommits = new Map<string, string[]>();
  let currentCommit: string | null = null;

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^## \d+\. (.+)$/);
    if (heading) {
      currentCommit = heading[1].trim();
      commits.set(currentCommit, []);
      continue;
    }

    if (line.startsWith('## ')) {
      currentCommit = null;
      continue;
    }

    if (!currentCommit || !line.startsWith('| `')) continue;

    const [fileCell] = parseTableCells(line);
    const filePath = cleanCell(fileCell);
    commits.get(currentCommit)?.push(filePath);

    const owners = fileToCommits.get(filePath) ?? [];
    owners.push(currentCommit);
    fileToCommits.set(filePath, owners);
  }

  return { commits, fileToCommits };
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

function rowsWithPrefix(rows: ManifestRow[], prefix: string) {
  return rows.filter((row) => row.path.startsWith(prefix));
}

describe('release candidate manifest and commit plan consistency', () => {
  const manifestRows = parseManifest(readFileSync(MANIFEST_PATH, 'utf8'));
  const commitCoverage = parseCommitPlan(readFileSync(COMMIT_PLAN_PATH, 'utf8'));
  const expectedP1Routes = new Set(EXPECTED_P1_ROUTES);

  it('covers each Include RC file in exactly one proposed commit', () => {
    const uncovered = manifestRows
      .filter((row) => row.includeRc)
      .filter((row) => (commitCoverage.fileToCommits.get(row.path) ?? []).length === 0)
      .map((row) => row.path);

    const coveredMultipleTimes = manifestRows
      .filter((row) => row.includeRc)
      .filter((row) => (commitCoverage.fileToCommits.get(row.path) ?? []).length > 1)
      .map((row) => `${row.path} -> ${(commitCoverage.fileToCommits.get(row.path) ?? []).join(', ')}`);

    expect(uncovered).toEqual([]);
    expect(coveredMultipleTimes).toEqual([]);
  });

  it('keeps excluded and human-review files out of proposed commits', () => {
    const excludedInCommits = manifestRows
      .filter((row) => !row.includeRc && row.group === 'Exclude')
      .filter((row) => commitCoverage.fileToCommits.has(row.path))
      .map((row) => row.path);

    const humanReviewInCommits = manifestRows
      .filter((row) => row.group === 'Needs human review')
      .filter((row) => commitCoverage.fileToCommits.has(row.path))
      .map((row) => row.path);

    expect(excludedInCommits).toEqual([]);
    expect(humanReviewInCommits).toEqual([]);
  });

  it('keeps classification rules stable for tests, scripts and maintenance files', () => {
    expect(rowsWithPrefix(manifestRows, '__tests__/').every((row) => row.group === 'Tests unitaires')).toBe(true);
    expect(rowsWithPrefix(manifestRows, 'e2e/').every((row) => row.group === 'Tests E2E')).toBe(true);
    expect(rowsWithPrefix(manifestRows, 'scripts/security/').every((row) => row.group === 'Scripts audit')).toBe(true);
    expect(rowsWithPrefix(manifestRows, 'scripts/go-live/').every((row) => row.group === 'Scripts go-live')).toBe(true);
    expect(rowsWithPrefix(manifestRows, 'scripts/maintenance/').every((row) => row.group === 'Scripts maintenance')).toBe(true);
  });

  it('keeps forbidden release-candidate files excluded', () => {
    const auditReport = manifestRows.find((row) => row.path === 'rapport_audit_2_07_2026.md');
    expect(auditReport?.group).toBe('Exclude');
    expect(auditReport?.includeRc).toBe(false);

    const envFiles = manifestRows.filter((row) => /(^|\/)\.env($|\.)/.test(row.path));
    expect(envFiles).toEqual([]);

    const generatedArtifactsIncluded = manifestRows
      .filter((row) => row.includeRc)
      .filter((row) =>
        ['test-results/', 'playwright-report/', '.next/', 'node_modules/'].some((prefix) =>
          row.path.startsWith(prefix),
        ),
      )
      .map((row) => row.path);

    expect(generatedArtifactsIncluded).toEqual([]);
  });

  it('keeps the six release-candidate P1 routes visible in the generated matrix', () => {
    const p1Routes = parseP1Routes(readFileSync(API_MATRIX_PATH, 'utf8'));

    expect(p1Routes).toEqual(expectedP1Routes);
  });
});
