#!/usr/bin/env node

/**
 * E2E spec-ownership governance.
 *
 * Every Playwright spec under e2e/** must be reachable by at least one CI
 * job's actual test-selection mechanism, or it silently never runs and
 * nobody notices ("orphan spec"). This script computes real CI coverage
 * from the config files CI actually invokes (not local-dev-only configs),
 * and diffs it against e2e-ownership-baseline.json — a checked-in,
 * explicit record of orphans that already existed when this guard was
 * introduced. New orphans (not in the baseline) fail the check; the
 * baseline itself is never silently allowed to grow.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Scripts and tests in this repo consistently invoke tooling with the repo
// root as cwd (see scripts/testing/check-zero-test-debt.mjs) — matching
// that convention instead of deriving __dirname from import.meta.url, which
// collides with this repo's Jest/babel CJS transform of .mjs files.
const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, 'scripts/testing/e2e-ownership-baseline.json');

/** All tracked Playwright spec files under e2e/**, repo-relative, sorted. */
function listAllSpecs() {
  return execFileSync('git', ['ls-files', 'e2e'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((file) => file.endsWith('.spec.ts'))
    .sort();
}

/**
 * Specs covered by CI jobs that actually run in .github/workflows/ci.yml
 * today:
 *   - `e2e` job: playwright.ci.config.ts, testDir e2e/real/pages, testMatch
 *     '**\/*.spec.ts' -> everything under e2e/real/pages/.
 *   - `e2e-auth` job: playwright.auth.config.ts, testDir e2e/auth,
 *     testMatch is an EXPLICIT array of filenames -> only those.
 *   - ARIA's own matrix (aria-browser job, scripts/aria/run-e2e-suite.sh):
 *     playwright.aria.config.ts, testDir e2e/aria -> everything under
 *     e2e/aria/. ARIA-owned; trusted as covered, not re-derived here.
 *
 * playwright.config.ts and playwright.config.e2e.ts exist for local/manual
 * use only — no CI workflow invokes them — so specs reachable only through
 * those are NOT considered covered.
 */
function computeCoveredSpecs(allSpecs) {
  const covered = new Set();

  for (const spec of allSpecs) {
    if (spec.startsWith('e2e/real/pages/')) covered.add(spec);
    if (spec.startsWith('e2e/aria/')) covered.add(spec);
  }

  const authConfig = readFileSync(path.join(repoRoot, 'playwright.auth.config.ts'), 'utf8');
  const testMatchBlock = authConfig.match(/testMatch:\s*\[([\s\S]*?)\],\n\s*fullyParallel/);
  if (!testMatchBlock) {
    throw new Error(
      'e2e-ownership: could not locate the top-level testMatch array in playwright.auth.config.ts ' +
        '(the parser expects a literal array of filenames followed by `fullyParallel`) — update this script if that config changed shape.',
    );
  }
  const allowlisted = [...testMatchBlock[1].matchAll(/'([^']+\.spec\.ts)'/g)].map((m) => m[1]);
  if (allowlisted.length === 0) {
    throw new Error('e2e-ownership: parsed zero filenames from playwright.auth.config.ts testMatch — parser is broken.');
  }
  for (const rel of allowlisted) {
    covered.add(`e2e/auth/${rel}`);
  }

  return covered;
}

function loadBaseline() {
  const raw = JSON.parse(readFileSync(baselinePath, 'utf8'));
  if (!Array.isArray(raw.knownOrphans)) {
    throw new Error(`e2e-ownership: ${baselinePath} must contain a "knownOrphans" array.`);
  }
  return new Set(raw.knownOrphans);
}

/**
 * @returns {{
 *   orphans: string[],
 *   newOrphans: string[],
 *   staleBaselineEntries: string[],
 * }}
 */
export function auditE2eOwnership() {
  const allSpecs = listAllSpecs();
  const covered = computeCoveredSpecs(allSpecs);
  const orphans = allSpecs.filter((spec) => !covered.has(spec));
  const baseline = loadBaseline();

  const orphanSet = new Set(orphans);
  const newOrphans = orphans.filter((spec) => !baseline.has(spec));
  const staleBaselineEntries = [...baseline].filter((spec) => !orphanSet.has(spec));

  return { orphans, newOrphans, staleBaselineEntries };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { orphans, newOrphans, staleBaselineEntries } = auditE2eOwnership();
  console.log(`e2e-ownership: ${orphans.length} orphan spec(s) found, ${newOrphans.length} new (not in baseline).`);
  if (newOrphans.length > 0) {
    console.error('New orphan specs (not wired into any CI job, not in the accepted baseline):');
    for (const spec of newOrphans) console.error(`  - ${spec}`);
    process.exitCode = 1;
  }
  if (staleBaselineEntries.length > 0) {
    console.error(
      'Baseline entries that are no longer orphaned (now covered by a CI job, or deleted) — remove them from e2e-ownership-baseline.json:',
    );
    for (const spec of staleBaselineEntries) console.error(`  - ${spec}`);
    process.exitCode = 1;
  }
  if (process.exitCode !== 1) {
    console.log('e2e-ownership: clean (no new orphans, baseline accurate).');
  }
}
