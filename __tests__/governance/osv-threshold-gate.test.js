// RED/GREEN governance coverage for the fail-closed, threshold-aware OSV gate
// (scripts/security/osv-threshold-gate.mjs, OSV_THRESHOLD_AWARE_FAIL_CLOSED).
// Every branch defaults to BLOCKED; only exact, dev-only, below-threshold,
// unfixed, unexpired, lockfile-pinned findings reach BOUNDED_BELOW_THRESHOLD.

const path = require('node:path');

const LOCKFILE = path.join(__dirname, '..', '..', 'package-lock.json');
const FUTURE = '2026-10-20T00:00:00Z'; // before the baseline's 2026-10-21 expiry
const NOW = '2026-10-07T12:00:00Z';

let mod;
let LOCK_SHA;
beforeAll(async () => {
  mod = await import('../../scripts/security/osv-threshold-gate.mjs');
  LOCK_SHA = mod.sha256OfFile(LOCKFILE);
});

const devTree = { name: 'nexus-reussite-app', dependencies: {} };
const prodTreeWithSprintf = { name: 'nexus-reussite-app', dependencies: { sprintf: { dependencies: { 'sprintf-js': {} } } } };

function osvReport(findings) {
  return { results: findings.length ? [{ packages: findings.map((f) => ({
    package: { name: f.package, version: f.version },
    vulnerabilities: [{ id: f.id, aliases: f.aliases ?? [],
      severity: f.cvss ? f.cvss.map((s) => ({ type: 'CVSS_V3', score: s })) : [],
      database_specific: f.dbSev ? { severity: f.dbSev } : {} }],
  })) }] : [] };
}

function baseline(overrides = {}) {
  return {
    schemaVersion: 1, lockfileSha256: LOCK_SHA, expiresAt: '2026-10-21',
    findings: [{ id: 'GHSA-hp3w-g68c-fv3c', package: 'sprintf-js', version: '1.0.3',
      scope: 'dev', maxSeverity: 'MODERATE', fixedVersion: null }],
    ...overrides,
  };
}
const sprintfFinding = { package: 'sprintf-js', version: '1.0.3', id: 'GHSA-hp3w-g68c-fv3c', dbSev: 'MODERATE' };

function run(args) {
  return mod.classify({ lockfilePath: LOCKFILE, productionTree: devTree, now: FUTURE, ...args });
}

describe('OSV threshold gate — fail closed', () => {
  test('1. zero findings + scanner exit 0 → CLEAN', () => {
    expect(run({ scannerExitCode: 0, report: osvReport([]), baseline: undefined }).state).toBe('CLEAN');
  });

  test('2. exact dev-only below-threshold baseline → BOUNDED_BELOW_THRESHOLD', () => {
    const r = run({ scannerExitCode: 1, report: osvReport([sprintfFinding]), baseline: baseline() });
    expect(r.problems).toEqual([]);
    expect(r.state).toBe('BOUNDED_BELOW_THRESHOLD');
  });

  test('3. new undeclared LOW → BLOCKED', () => {
    const r = run({ scannerExitCode: 1, report: osvReport([{ package: 'newlow', version: '1.0.0', id: 'GHSA-new-low', dbSev: 'LOW' }]), baseline: baseline() });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/UNDECLARED_FINDING:newlow/);
  });

  test('4. new undeclared MODERATE → BLOCKED', () => {
    const r = run({ scannerExitCode: 1, report: osvReport([{ package: 'newmod', version: '2.0.0', id: 'GHSA-new-mod', dbSev: 'MODERATE' }]), baseline: baseline() });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/UNDECLARED_FINDING:newmod|STALE_BASELINE/);
  });

  test('5. declared dev but present in production tree → BLOCKED', () => {
    const r = run({ scannerExitCode: 1, report: osvReport([sprintfFinding]), baseline: baseline(), productionTree: prodTreeWithSprintf });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/SCOPE_DEV_TO_PROD:sprintf-js/);
  });

  test('6. HIGH and CRITICAL → BLOCKED', () => {
    const high = run({ scannerExitCode: 1, report: osvReport([{ package: 'sprintf-js', version: '1.0.3', id: 'GHSA-hp3w-g68c-fv3c', dbSev: 'HIGH' }]), baseline: baseline() });
    expect(high.state).toBe('BLOCKED');
    expect(high.problems.join(' ')).toMatch(/BLOCKING_SEVERITY:HIGH/);
    const crit = run({ scannerExitCode: 1, report: osvReport([{ package: 'x', version: '1', id: 'GHSA-x', dbSev: 'CRITICAL' }]), baseline: baseline() });
    expect(crit.state).toBe('BLOCKED');
    expect(crit.problems.join(' ')).toMatch(/BLOCKING_SEVERITY:CRITICAL/);
  });

  test('7. missing/unknown severity → BLOCKED', () => {
    const r = run({ scannerExitCode: 1, report: osvReport([{ package: 'sprintf-js', version: '1.0.3', id: 'GHSA-hp3w-g68c-fv3c' }]), baseline: baseline() });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/UNKNOWN_SEVERITY/);
  });

  test('8. CVSS more severe than the database label → max wins → BLOCKED', () => {
    // db label MODERATE but a CVSS vector that computes HIGH (>=7.0) → max = HIGH → block.
    const r = run({ scannerExitCode: 1, report: osvReport([{ package: 'sprintf-js', version: '1.0.3', id: 'GHSA-hp3w-g68c-fv3c',
      dbSev: 'MODERATE', cvss: ['CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'] }]), baseline: baseline() });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/BLOCKING_SEVERITY:(HIGH|CRITICAL)/);
  });

  test('9a. version mutation → BLOCKED', () => {
    const r = run({ scannerExitCode: 1, report: osvReport([{ ...sprintfFinding, version: '1.0.2' }]), baseline: baseline() });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/VERSION_MISMATCH/);
  });
  test('9b. lockfile digest mutation → BLOCKED', () => {
    const r = run({ scannerExitCode: 1, report: osvReport([sprintfFinding]), baseline: baseline({ lockfileSha256: '0'.repeat(64) }) });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/LOCKFILE_DIGEST_CHANGED/);
  });

  test('10. upstream fix available → baseline invalid → BLOCKED', () => {
    const r = run({ scannerExitCode: 1, report: osvReport([sprintfFinding]), baseline: baseline({ findings: [{ id: 'GHSA-hp3w-g68c-fv3c', package: 'sprintf-js', version: '1.0.3', scope: 'dev', maxSeverity: 'MODERATE', fixedVersion: '1.1.4' }] }) });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/FIX_AVAILABLE:sprintf-js/);
  });

  test('11. finding gone but baseline entry remains → BLOCKED (stale)', () => {
    const r = run({ scannerExitCode: 1, report: osvReport([{ package: 'other', version: '1', id: 'GHSA-other', dbSev: 'LOW' }]), baseline: baseline() });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/STALE_BASELINE_ENTRY:sprintf-js/);
  });

  test('12. expired baseline → BLOCKED', () => {
    const r = mod.classify({ lockfilePath: LOCKFILE, productionTree: devTree, now: '2026-10-22T00:00:00Z',
      scannerExitCode: 1, report: osvReport([sprintfFinding]), baseline: baseline() });
    expect(r.state).toBe('BLOCKED');
    expect(r.problems.join(' ')).toMatch(/BASELINE_EXPIRED/);
  });

  test('13. absent/truncated/malformed report → BLOCKED (never CLEAN)', () => {
    expect(run({ scannerExitCode: 1, report: null, baseline: baseline() }).state).toBe('BLOCKED');
    expect(run({ scannerExitCode: 1, report: { results: 'not-an-array' }, baseline: baseline() }).state).toBe('BLOCKED');
    expect(run({ scannerExitCode: 0, report: { error: 'scanner failed' }, baseline: undefined }).state).toBe('BLOCKED');
  });

  test('14. scanner exit code other than 0/1 → BLOCKED', () => {
    expect(run({ scannerExitCode: 127, report: osvReport([]), baseline: baseline() }).problems.join(' ')).toMatch(/SCANNER_EXIT_127/);
    expect(run({ scannerExitCode: 2, report: osvReport([sprintfFinding]), baseline: baseline() }).state).toBe('BLOCKED');
  });

  test('15. reappearance of braces / http-cache-semantics → BLOCKED', () => {
    const braces = run({ scannerExitCode: 1, report: osvReport([{ package: 'braces', version: '3.0.2', id: 'GHSA-grv7-fg5c-xmjg', dbSev: 'HIGH' }]), baseline: baseline() });
    expect(braces.state).toBe('BLOCKED');
    const hcs = run({ scannerExitCode: 1, report: osvReport([{ package: 'http-cache-semantics', version: '4.0.0', id: 'GHSA-ch52-4w7c-c8xp', dbSev: 'HIGH' }]), baseline: baseline() });
    expect(hcs.state).toBe('BLOCKED');
  });

  test('16. a technical error cannot be laundered into CLEAN', () => {
    // exit 0 but findings present (scanner contradiction) → BLOCKED, not CLEAN.
    expect(run({ scannerExitCode: 0, report: osvReport([sprintfFinding]), baseline: baseline() }).state).toBe('BLOCKED');
    // exit 1 but zero findings (contradiction) → BLOCKED.
    expect(run({ scannerExitCode: 1, report: osvReport([]), baseline: baseline() }).state).toBe('BLOCKED');
  });
});
