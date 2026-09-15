/**
 * `__tests__/helpers/real-db-fixture-cleanup.ts` disposes real database rows.
 * It exists to serve test fixtures and must never become reachable from the
 * product: a runtime path that could delete an account graph by traversing
 * foreign keys is exactly the capability #273 removed from the schema.
 *
 * This guard keeps that boundary mechanical rather than conventional.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HELPER = '__tests__/helpers/real-db-fixture-cleanup.ts';

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

/** Everything that ships or runs outside the test suites. */
function isProductionSurface(file: string): boolean {
  if (!/\.(ts|tsx|js|mjs)$/.test(file)) return false;
  if (file.startsWith('__tests__/') || file.startsWith('e2e/')) return false;
  if (/\.(test|spec)\.[jt]sx?$/.test(file)) return false;
  return (
    file.startsWith('app/')
    || file.startsWith('lib/')
    || file.startsWith('components/')
    || file.startsWith('workers/')
    || file.startsWith('scripts/')
    || file.startsWith('core-v2/')
  );
}

const IMPORTS_HELPER = /(?:from|require\()\s*['"][^'"]*real-db-fixture-cleanup['"]/;

describe('real-db fixture cleanup boundary', () => {
  const files = trackedFiles();

  it('is never imported by a production or script runtime path', () => {
    const offenders = files
      .filter(isProductionSurface)
      .filter((file) => IMPORTS_HELPER.test(readFileSync(path.join(REPO_ROOT, file), 'utf8')))
      .map((file) => `${file} imports the test fixture cleanup helper`);
    expect(offenders).toEqual([]);
  });

  it('scans a production surface, so the guard cannot pass vacuously', () => {
    expect(files.filter(isProductionSurface).length).toBeGreaterThan(100);
  });

  it('refuses to run without proving the database is disposable', () => {
    const source = readFileSync(path.join(REPO_ROOT, HELPER), 'utf8');
    // The guard must be called, not merely imported.
    expect(source).toMatch(/assertDisposablePostgresUrl\s*\(/);
    // And it must never grow its own weaker identity check.
    expect(source).not.toMatch(/NODE_ENV\s*===\s*['"]test['"]/);
  });

  it('reaches its disposable-database guard without a test runner', () => {
    // The helper is called from Playwright specs as well as jest suites. An
    // earlier guard asserted through jest's `expect`, which threw
    // `ReferenceError: expect is not defined` the first time an E2E spec
    // reached it — a guard that cannot run protects nothing.
    const guard = readFileSync(path.join(REPO_ROOT, '__tests__/helpers/disposable-postgres.ts'), 'utf8');
    expect(guard).not.toMatch(/\bexpect\s*\(/);
    expect(guard).toMatch(/throw new Error\(/);

    const helper = readFileSync(path.join(REPO_ROOT, HELPER), 'utf8');
    expect(helper).not.toMatch(/\bexpect\s*\(/);
  });

  it('never performs an unscoped delete', () => {
    const source = readFileSync(path.join(REPO_ROOT, HELPER), 'utf8');
    expect(source).not.toMatch(/TRUNCATE/i);
    expect(source).not.toMatch(/deleteMany\(\s*\)/);
    expect(source).not.toMatch(/session_replication_role/i);
    // Every DELETE it issues is bounded by the fixture scope table.
    const deletes = source.match(/DELETE FROM [^;]*/gi) ?? [];
    expect(deletes.length).toBeGreaterThan(0);
    for (const statement of deletes) {
      expect(statement).toMatch(/_fixture_scope/);
    }
  });
});
