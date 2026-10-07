#!/usr/bin/env node
// Threshold-aware, fail-closed OSV gate (OSV_THRESHOLD_AWARE_FAIL_CLOSED).
//
// The OSV scanner returns a non-zero exit code for ANY finding, regardless of
// severity. The canonical gate everywhere else in CI is --audit-level=high.
// This gate reconciles the two with three explicit states:
//
//   CLEAN                     scanner exit 0 + a valid report with zero findings
//   BOUNDED_BELOW_THRESHOLD   every finding is exactly declared in the temporary
//                             below-threshold baseline: dev-only, LOW/MODERATE,
//                             no published fix, not expired, lockfile + paths pinned
//   BLOCKED                   anything else — and "anything else" is the default
//
// Fail-closed rules (see security/osv-below-threshold-baseline.json):
//   - HIGH or CRITICAL anywhere            -> BLOCKED (no exception, ever)
//   - production MODERATE/HIGH/CRITICAL    -> BLOCKED
//   - production LOW                       -> BLOCKED unless declared with no fix
//   - dev LOW/MODERATE                     -> BOUNDED only if declared exactly
//   - missing/unknown/contradictory sev    -> BLOCKED
//   - undeterminable dev/prod scope        -> BLOCKED
//   - any finding not in the baseline      -> BLOCKED (new finding fails until triage)
//   - any baseline entry with a published fix -> BLOCKED (fix available invalidates it)
//   - a baseline entry with no matching finding -> BLOCKED (stale baseline)
//   - expired baseline                     -> BLOCKED
//   - absent/empty-yet-exit-1/truncated/invalid report -> BLOCKED
//   - scanner exit code other than 0 or 1  -> BLOCKED (scanner failure)
//   - severity is the MAX across the finding's database_specific severity and
//     every CVSS vector it carries.

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

export const RANK = { NONE: 0, LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };
const BLOCKING_RANK = RANK.HIGH; // HIGH and above block everywhere, unconditionally.

function readJsonSafe(path, onError) {
  try {
    if (!path || !existsSync(path)) return { error: `${onError}:ABSENT` };
    const raw = readFileSync(path, 'utf8');
    if (!raw.trim()) return { error: `${onError}:EMPTY` };
    return { value: JSON.parse(raw) };
  } catch (e) {
    return { error: `${onError}:INVALID` };
  }
}

export function sha256OfFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// Qualitative severity (rank) from a CVSS v3.x vector string. Returns NONE rank
// when the vector cannot be parsed into a base score.
export function cvss3Rank(vector) {
  if (typeof vector !== 'string' || !/^CVSS:3\.[01]\//.test(vector)) return RANK.NONE;
  const m = Object.fromEntries(vector.split('/').slice(1).map((p) => p.split(':')));
  const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[m.AV];
  const AC = { L: 0.77, H: 0.44 }[m.AC];
  const UI = { N: 0.85, R: 0.62 }[m.UI];
  const PRraw = { N: 0.85, L: 0.62, H: 0.27 }[m.PR];
  const PRchanged = { N: 0.85, L: 0.68, H: 0.5 }[m.PR];
  const imp = { N: 0, L: 0.22, H: 0.56 };
  if (AV === undefined || AC === undefined || UI === undefined || PRraw === undefined ||
      imp[m.C] === undefined || imp[m.I] === undefined || imp[m.A] === undefined || !m.S) return RANK.NONE;
  const scopeChanged = m.S === 'C';
  const PR = scopeChanged ? PRchanged : PRraw;
  const iscBase = 1 - (1 - imp[m.C]) * (1 - imp[m.I]) * (1 - imp[m.A]);
  const impact = scopeChanged
    ? 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15)
    : 6.42 * iscBase;
  const exploit = 8.22 * AV * AC * PR * UI;
  let score;
  if (impact <= 0) score = 0;
  else {
    const raw = scopeChanged ? 1.08 * (impact + exploit) : impact + exploit;
    score = Math.ceil(Math.min(raw, 10) * 10) / 10;
  }
  if (score === 0) return RANK.NONE;
  if (score < 4.0) return RANK.LOW;
  if (score < 7.0) return RANK.MODERATE;
  if (score < 9.0) return RANK.HIGH;
  return RANK.CRITICAL;
}

function wordRank(word) {
  if (typeof word !== 'string') return undefined;
  const w = word.toUpperCase();
  if (w === 'MEDIUM') return RANK.MODERATE;
  return RANK[w];
}

// Max severity rank across database_specific.severity and every CVSS vector.
// Returns null when NO severity signal is present (unknown -> caller blocks).
export function findingMaxRank(vuln) {
  const ranks = [];
  const dbSev = wordRank(vuln?.database_specific?.severity);
  if (dbSev !== undefined) ranks.push(dbSev);
  for (const s of vuln?.severity ?? []) {
    if (s && typeof s.score === 'string') {
      const r = cvss3Rank(s.score);
      if (r !== RANK.NONE) ranks.push(r);
    }
  }
  // Ecosystem-specific qualitative labels sometimes travel on the severity array too.
  for (const s of vuln?.severity ?? []) {
    const r = wordRank(s?.type) ?? wordRank(s?.level);
    if (r !== undefined) ranks.push(r);
  }
  if (ranks.length === 0) return null;
  return Math.max(...ranks);
}

export function rankName(rank) {
  return Object.entries(RANK).find(([, v]) => v === rank)?.[0] ?? 'UNKNOWN';
}

// Flatten an OSV report into normalized findings. Returns { findings, problems }.
export function normalizeReport(report) {
  const problems = [];
  const findings = [];
  if (!report || typeof report !== 'object' || !Array.isArray(report.results) ||
      report.error || (Array.isArray(report.errors) && report.errors.length > 0)) {
    return { findings, problems: ['OSV_REPORT_INVALID'] };
  }
  for (const result of report.results) {
    if (!Array.isArray(result?.packages)) { problems.push('OSV_REPORT_INVALID'); continue; }
    for (const pkg of result.packages) {
      const name = pkg?.package?.name;
      const version = pkg?.package?.version;
      if (!Array.isArray(pkg?.vulnerabilities)) { problems.push('OSV_REPORT_INVALID'); continue; }
      for (const vuln of pkg.vulnerabilities) {
        const ids = [vuln?.id, ...(vuln?.aliases ?? [])].filter(Boolean);
        const rank = findingMaxRank(vuln);
        findings.push({ package: name, version, id: vuln?.id, ids, rank });
      }
    }
  }
  return { findings, problems };
}

// Production scope: does the package appear anywhere in `npm ls --omit=dev` tree?
function inProductionTree(tree, packageName) {
  const stack = [tree];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    const deps = node.dependencies;
    if (deps && typeof deps === 'object') {
      if (Object.prototype.hasOwnProperty.call(deps, packageName)) return true;
      stack.push(...Object.values(deps));
    }
  }
  return false;
}

export function classify({ scannerExitCode, report, baseline, lockfilePath, productionTree, now }) {
  const problems = [];
  const block = (msg) => { problems.push(msg); };

  // Scanner contract: only 0 and 1 are meaningful; anything else is a failure.
  if (scannerExitCode !== 0 && scannerExitCode !== 1) {
    return { state: 'BLOCKED', problems: [`SCANNER_EXIT_${scannerExitCode}`], findings: [] };
  }

  const { findings, problems: reportProblems } = normalizeReport(report);
  if (reportProblems.length) {
    return { state: 'BLOCKED', problems: reportProblems, findings };
  }

  // Exit 0 must mean a truly empty, valid report (never an absent/parsed-as-empty file).
  if (scannerExitCode === 0) {
    if (findings.length !== 0) return { state: 'BLOCKED', problems: ['SCANNER_CLEAN_BUT_FINDINGS_PRESENT'], findings };
    return { state: 'CLEAN', problems: [], findings };
  }

  // scannerExitCode === 1: there is at least one finding; a zero-finding exit-1
  // report is contradictory and blocks.
  if (findings.length === 0) {
    return { state: 'BLOCKED', problems: ['SCANNER_FINDINGS_EXIT_WITHOUT_FINDINGS'], findings };
  }

  // Baseline must be present, well-formed and unexpired to tolerate anything.
  const entries = baseline?.findings;
  if (!baseline || !Array.isArray(entries)) {
    return { state: 'BLOCKED', problems: ['BASELINE_ABSENT_OR_INVALID'], findings };
  }
  if (!now || Number.isNaN(Date.parse(now))) return { state: 'BLOCKED', problems: ['NOW_INVALID'], findings };
  if (!baseline.expiresAt || Number.isNaN(Date.parse(baseline.expiresAt)) ||
      Date.parse(baseline.expiresAt) <= Date.parse(now)) {
    return { state: 'BLOCKED', problems: ['BASELINE_EXPIRED'], findings };
  }
  // Lockfile pin: the baseline is only valid for the exact lockfile it was cut against.
  if (!lockfilePath || !existsSync(lockfilePath)) return { state: 'BLOCKED', problems: ['LOCKFILE_ABSENT'], findings };
  if (sha256OfFile(lockfilePath) !== baseline.lockfileSha256) {
    return { state: 'BLOCKED', problems: ['LOCKFILE_DIGEST_CHANGED'], findings };
  }

  const matchedEntries = new Set();
  for (const f of findings) {
    // Unknown/absent severity blocks.
    if (f.rank === null) { block(`UNKNOWN_SEVERITY:${f.package}@${f.version}:${f.id}`); continue; }
    // HIGH/CRITICAL block unconditionally.
    if (f.rank >= BLOCKING_RANK) { block(`BLOCKING_SEVERITY:${rankName(f.rank)}:${f.package}@${f.version}:${f.id}`); continue; }

    // Must be declared exactly in the baseline.
    const entry = entries.find((e) => e.package === f.package && e.id === f.id);
    if (!entry) { block(`UNDECLARED_FINDING:${f.package}@${f.version}:${f.id}`); continue; }

    // Scope: production MODERATE+ blocks; production LOW only if declared with no fix.
    const prodScope = inProductionTree(productionTree, f.package);
    const declaredScope = entry.scope;
    if (declaredScope !== 'dev' && declaredScope !== 'prod') { block(`SCOPE_UNKNOWN:${f.package}`); continue; }
    if (prodScope && declaredScope !== 'prod') { block(`SCOPE_DEV_TO_PROD:${f.package}`); continue; }
    if (prodScope) {
      if (f.rank >= RANK.MODERATE) { block(`PROD_BLOCKING:${rankName(f.rank)}:${f.package}`); continue; }
      // prod LOW tolerated only with no fix (handled by the fix check below).
    }

    // Any published fix invalidates the baseline entry.
    if (entry.fixedVersion !== null && entry.fixedVersion !== undefined) {
      block(`FIX_AVAILABLE:${f.package}:${entry.fixedVersion}`); continue;
    }
    // Pinned identity: version and declared severity must match the finding.
    if (entry.version !== f.version) { block(`VERSION_MISMATCH:${f.package}:${entry.version}!=${f.version}`); continue; }
    const declaredRank = wordRank(entry.maxSeverity);
    if (declaredRank === undefined || declaredRank !== f.rank) { block(`SEVERITY_MISMATCH:${f.package}:${entry.maxSeverity}`); continue; }
    if (declaredRank >= BLOCKING_RANK) { block(`DECLARED_BLOCKING:${f.package}`); continue; }

    matchedEntries.add(`${entry.package}::${entry.id}`);
  }

  // Stale baseline: a declared entry with no matching finding (drift gone) blocks.
  for (const e of entries) {
    if (!matchedEntries.has(`${e.package}::${e.id}`)) {
      block(`STALE_BASELINE_ENTRY:${e.package}:${e.id}`);
    }
  }

  if (problems.length) return { state: 'BLOCKED', problems, findings };
  return { state: 'BOUNDED_BELOW_THRESHOLD', problems: [], findings };
}

// CLI: --report <osv.json> --baseline <baseline.json> --lockfile <lock> \
//      --production-tree <npm-ls-omit-dev.json> --now <iso> --scanner-exit <code>
function main(argv) {
  const get = (flag) => { const i = argv.indexOf(flag); return i === -1 ? undefined : argv[i + 1]; };
  const reportR = readJsonSafe(get('--report'), 'OSV_REPORT');
  const baselineArg = get('--baseline');
  const baselineR = baselineArg ? readJsonSafe(baselineArg, 'BASELINE') : { value: undefined };
  const treeR = readJsonSafe(get('--production-tree'), 'PRODUCTION_TREE');
  const scannerExit = Number(get('--scanner-exit'));
  const now = get('--now');

  if (reportR.error) { console.error(`OSV_GATE=BLOCKED ${reportR.error}`); process.exit(1); }
  if (treeR.error) { console.error(`OSV_GATE=BLOCKED ${treeR.error}`); process.exit(1); }
  if (baselineArg && baselineR.error) { console.error(`OSV_GATE=BLOCKED ${baselineR.error}`); process.exit(1); }

  const result = classify({
    scannerExitCode: scannerExit,
    report: reportR.value,
    baseline: baselineR.value,
    lockfilePath: get('--lockfile'),
    productionTree: treeR.value,
    now,
  });
  if (result.state === 'BLOCKED') {
    console.error(`OSV_GATE=BLOCKED`);
    for (const p of result.problems) console.error(' - ' + p);
    process.exit(1);
  }
  const summary = result.findings.map((f) => `${f.package}@${f.version}:${f.id}[${rankName(f.rank)}]`).join(', ');
  console.log(`OSV_GATE=${result.state}${summary ? ' findings=' + summary : ''}`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
