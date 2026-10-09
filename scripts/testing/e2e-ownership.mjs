#!/usr/bin/env node

/**
 * E2E spec-ownership governance.
 *
 * Every Playwright spec under e2e/** must have one directory-based owner.
 * This is a static ownership check, NOT proof of collection or execution.
 * e2e-execution-evidence.mjs reconciles actual CI reports separately. A spec's
 * CI lane is derived from which directory it lives in, not from a manual
 * per-file allowlist:
 *
 *   e2e/real/pages/**   -> `e2e` job (playwright.ci.config.ts)
 *   e2e/public/**       -> `e2e` job (playwright.ci.config.ts)
 *   e2e/auth/**         -> `e2e-auth` job (playwright.auth.config.ts),
 *                          including subdirectories (e.g. e2e/auth/npc/)
 *   e2e/aria/**         -> ARIA's own matrix (playwright.aria.config.ts),
 *                          ARIA-owned (execution verified from its reports)
 *
 * playwright.config.ts and playwright.config.e2e.ts exist for local/manual
 * use only -- no CI workflow invokes them -- so specs reachable only
 * through those are NOT considered covered.
 *
 * Documented exclusions are exact files, never prefixes, so a new spec added
 * next to them is still an orphan until someone decides its lane. They are
 * excluded from BOTH this check and e2e-execution-evidence.mjs (single list).
 * Current entries: the Espace pédagogique production smokes (e2e/prod/**,
 * operator credentials kept outside the repository, never runnable on a
 * hosted runner) and the offline fallback-package drill (downloads Pyodide
 * at build time). Both run only through the dispatch-only
 * `.github/workflows/manual-rehearsals.yml` (playwright.prod-smoke.config.ts,
 * playwright.fallback.config.ts). Owner, frequency and required evidence of
 * each entry: docs/qa/manual-e2e-registry.md. (A previous entry,
 * e2e/auth/entitlements-chat-gate-blocked.spec.ts, was removed once
 * re-verification against a real disposable stack showed the underlying
 * "422 instead of 403" belief was a false positive from an incomplete
 * local reproduction environment, not a real app defect -- see that
 * spec's own header comment.)
 */

import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

export const DOCUMENTED_EXCLUSIONS = new Set([
  'e2e/bilan-validation/auth-hydration.spec.ts',
  'e2e/bilan-validation/enrichment.spec.ts',
  'e2e/bilan-validation/espace-bilan.spec.ts',
  'e2e/bilan-validation/mobile-account.spec.ts',
  'e2e/bilan-validation/student.spec.ts',
  'e2e/bilan-validation/teacher.spec.ts',
  'e2e/bilan-validation/terminale.spec.ts',
  'e2e/fallback/fallback-offline.spec.ts',
  'e2e/prod/espace-prod-credentials.spec.ts',
  'e2e/prod/espace-prod-recursivite.spec.ts',
  'e2e/prod/espace-prod-smoke.spec.ts',
  'e2e/prod/espace-prod-teacher.spec.ts',
]);

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
 *   owned: string[],
 *   orphans: string[],
 *   documentedExclusions: string[],
 *   unknownExclusions: string[],
 * }}
 */
export function auditE2eOwnership() {
  const tracked = listAllSpecs();
  const owned = [];
  const orphans = [];

  for (const spec of tracked) {
    if (DOCUMENTED_EXCLUSIONS.has(spec)) continue; // accounted for separately
    const covered = COVERED_PREFIXES.some((prefix) => spec.startsWith(prefix));
    if (covered) owned.push(spec);
    else orphans.push(spec);
  }

  const documentedExclusions = tracked.filter((spec) => DOCUMENTED_EXCLUSIONS.has(spec));
  const unknownExclusions = [...DOCUMENTED_EXCLUSIONS].filter((spec) => !tracked.includes(spec));

  return { tracked, owned, orphans, documentedExclusions, unknownExclusions };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { tracked, owned, orphans, documentedExclusions, unknownExclusions } = auditE2eOwnership();
  console.log(
    `e2e-ownership: TRACKED_E2E_SPECS=${tracked.length} OWNED_E2E_SPECS=${owned.length} ORPHANS=${orphans.length} DOCUMENTED_EXCLUSIONS=${documentedExclusions.length}`,
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
