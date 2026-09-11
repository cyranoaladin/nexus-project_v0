#!/usr/bin/env node

/**
 * E2E spec-ownership governance.
 *
 * Every Playwright spec under e2e/** must be reachable by exactly one
 * CI-invoked config's real test selection, or it silently never runs and
 * nobody notices ("orphan spec"). Ownership is directory-based -- a spec's
 * CI lane is derived from which directory it lives in, not from a manual
 * per-file allowlist:
 *
 *   e2e/real/pages/**   -> `e2e` job (playwright.ci.config.ts)
 *   e2e/public/**       -> `e2e` job (playwright.ci.config.ts)
 *   e2e/auth/**         -> `e2e-auth` job (playwright.auth.config.ts),
 *                          including subdirectories (e.g. e2e/auth/npc/)
 *   e2e/aria/**         -> ARIA's own matrix (playwright.aria.config.ts),
 *                          ARIA-owned, trusted as covered, not re-derived
 *                          here
 *
 * playwright.config.ts and playwright.config.e2e.ts exist for local/manual
 * use only -- no CI workflow invokes them -- so specs reachable only
 * through those are NOT considered covered.
 *
 * No documented exceptions currently apply. (The previous single entry,
 * e2e/auth/entitlements-chat-gate-blocked.spec.ts, was removed once
 * re-verification against a real disposable stack showed the underlying
 * "422 instead of 403" belief was a false positive from an incomplete
 * local reproduction environment, not a real app defect -- see that
 * spec's own header comment.)
 */

import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

const DOCUMENTED_EXCLUSIONS = new Set();

/** All tracked Playwright spec files under e2e/**, repo-relative, sorted. */
function listAllSpecs() {
  return execFileSync('git', ['ls-files', 'e2e'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((file) => file.endsWith('.spec.ts'))
    .sort();
}

const COVERED_PREFIXES = ['e2e/real/pages/', 'e2e/public/', 'e2e/auth/', 'e2e/aria/'];

/**
 * @returns {{
 *   tracked: string[],
 *   collected: string[],
 *   orphans: string[],
 *   documentedExclusions: string[],
 *   unknownExclusions: string[],
 * }}
 */
export function auditE2eOwnership() {
  const tracked = listAllSpecs();
  const collected = [];
  const orphans = [];

  for (const spec of tracked) {
    if (DOCUMENTED_EXCLUSIONS.has(spec)) continue; // accounted for separately
    const covered = COVERED_PREFIXES.some((prefix) => spec.startsWith(prefix));
    if (covered) collected.push(spec);
    else orphans.push(spec);
  }

  const documentedExclusions = tracked.filter((spec) => DOCUMENTED_EXCLUSIONS.has(spec));
  const unknownExclusions = [...DOCUMENTED_EXCLUSIONS].filter((spec) => !tracked.includes(spec));

  return { tracked, collected, orphans, documentedExclusions, unknownExclusions };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { tracked, collected, orphans, documentedExclusions, unknownExclusions } = auditE2eOwnership();
  console.log(
    `e2e-ownership: TRACKED_E2E_SPECS=${tracked.length} COLLECTED_E2E_SPECS=${collected.length} ORPHANS=${orphans.length} DOCUMENTED_EXCLUSIONS=${documentedExclusions.length}`,
  );
  if (orphans.length > 0) {
    console.error('Orphan specs (not wired into any CI job, not a documented exclusion):');
    for (const spec of orphans) console.error(`  - ${spec}`);
    process.exitCode = 1;
  }
  if (unknownExclusions.length > 0) {
    console.error(
      'Documented exclusions that no longer exist on disk (stale entry, remove it from DOCUMENTED_EXCLUSIONS):',
    );
    for (const spec of unknownExclusions) console.error(`  - ${spec}`);
    process.exitCode = 1;
  }
  if (process.exitCode !== 1) {
    console.log('e2e-ownership: clean (zero orphans, exclusions accurate).');
  }
}
