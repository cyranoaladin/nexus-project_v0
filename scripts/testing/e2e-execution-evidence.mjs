#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const INVOCATIONS = {
  public: { root: 'e2e', owner: 'public', prefixes: ['e2e/public/', 'e2e/real/pages/'], projects: ['chromium'] },
  'auth-chromium': { root: 'e2e/auth', owner: 'auth', prefixes: ['e2e/auth/'], projects: ['chromium'] },
  'auth-cross-browser': { root: 'e2e/auth', owner: 'auth', prefixes: ['e2e/auth/'], projects: ['firefox-smoke', 'webkit-smoke', 'mobile-smoke'] },
  ...Object.fromEntries(['desktop', 'mobile', 'a11y', 'smoke'].map(name => [`aria-${name}`, {
    root: 'e2e/aria', owner: 'aria', prefixes: ['e2e/aria/'], projects: [`aria-${name}`],
  }])),
};
const hashReport = report => createHash('sha256').update(JSON.stringify(report)).digest('hex');

export function sealReport(lane, report, identity) {
  if (!Object.hasOwn(INVOCATIONS, lane)) throw new Error('UNKNOWN_INVOCATION');
  return { schemaVersion: 1, ...identity, lane, reportSha256: hashReport(report), report };
}

function* specs(suites, ancestors = []) {
  for (const suite of suites ?? []) {
    const titlePath = typeof suite.title === 'string' ? [...ancestors, suite.title] : ancestors;
    for (const spec of suite.specs ?? []) yield { spec, titlePath: [...titlePath, spec.title] };
    yield* specs(suite.suites, titlePath);
  }
}

/** Count actual Playwright records, not directory membership or console totals. */
export function auditExecutionEvidence(tracked, evidence, identity) {
  const problems = [];
  const collected = new Set();
  const executed = new Set();
  const trackedSet = new Set(tracked);
  const lanes = new Set();
  const records = new Set();
  const authRecords = [];
  let testRecords = 0;
  for (const entry of evidence) {
    const { lane, report } = entry;
    const invocation = INVOCATIONS[lane];
    if (!Object.hasOwn(INVOCATIONS, lane)) { problems.push(`UNKNOWN_INVOCATION:${lane}`); continue; }
    if (lanes.has(lane)) problems.push(`DUPLICATE_INVOCATION:${lane}`);
    lanes.add(lane);
    if (entry.schemaVersion !== 1 || ['sourceSha', 'runId', 'runAttempt'].some(key => entry[key] !== identity[key])) {
      problems.push(`IDENTITY_MISMATCH:${lane}`);
    }
    if (entry.reportSha256 !== hashReport(report)) problems.push(`REPORT_HASH_MISMATCH:${lane}`);
    if (!report || !Array.isArray(report.suites) || !Array.isArray(report.errors)) {
      problems.push(`INVALID_REPORT:${lane}`); continue;
    }
    if (report.errors.length) problems.push(`REPORT_ERRORS:${lane}`);
    const absoluteRoot = report.config?.rootDir;
    if (typeof absoluteRoot !== 'string' || !absoluteRoot.endsWith(`/${invocation.root}`)) {
      problems.push(`INVALID_ROOT:${lane}`); continue;
    }
    const projects = new Set();
    const invocationFiles = new Set();
    for (const { spec, titlePath } of specs(report.suites)) {
      if (typeof spec.file !== 'string') { problems.push(`INVALID_PATH:${lane}`); continue; }
      const relative = path.posix.isAbsolute(spec.file) ? path.posix.relative(absoluteRoot, spec.file) : spec.file;
      const file = path.posix.normalize(`${invocation.root}/${relative}`);
      if (relative.split('/').includes('..') || relative.includes('\\') || !file.endsWith('.spec.ts')
        || !invocation.prefixes.some(prefix => file.startsWith(prefix))) {
        problems.push(`INVALID_PATH:${lane}`); continue;
      }
      if (!trackedSet.has(file)) problems.push(`UNTRACKED_SPEC:${file}`);
      collected.add(file);
      invocationFiles.add(file);
      if (!Array.isArray(spec.tests) || !spec.tests.length) problems.push(`NO_TEST_RECORDS:${file}`);
      for (const test of spec.tests ?? []) {
        testRecords += 1;
        projects.add(test.projectName);
        // Parameterized describe blocks share source coordinates and leaf titles.
        // Include their full path, preserving boundaries rather than joining text.
        const signature = JSON.stringify([file, spec.line, spec.column, titlePath]);
        const key = JSON.stringify([invocation.owner, test.projectName, signature]);
        if (invocation.owner === 'auth') authRecords.push({ lane, project: test.projectName, file, signature });
        if (records.has(key)) problems.push(`DUPLICATE_TEST:${key}`);
        records.add(key);
        if (!invocation.projects.includes(test.projectName)) problems.push(`UNEXPECTED_PROJECT:${lane}:${test.projectName}`);
        const results = test.results ?? [];
        if (results.some(result => ['passed', 'failed', 'timedOut', 'interrupted'].includes(result.status))) executed.add(file);
        if (test.expectedStatus !== 'passed' || test.status !== 'expected'
          || (test.annotations ?? []).some(annotation => ['skip', 'fixme', 'fail'].includes(annotation.type))
          || results.length !== 1 || results[0]?.status !== 'passed' || results[0]?.retry !== 0) {
          problems.push(`NON_PASSING_TEST:${key}`);
        }
      }
    }
    for (const project of invocation.projects) if (!projects.has(project)) problems.push(`MISSING_PROJECT:${lane}:${project}`);
    // Smoke execution supplements the complete Chromium lane; it cannot
    // supply a file silently omitted from that primary invocation.
    if (lane === 'public' || lane === 'auth-chromium') {
      for (const file of tracked) {
        if (invocation.prefixes.some(prefix => file.startsWith(prefix)) && !invocationFiles.has(file)) {
          problems.push(`MISSING_PRIMARY_SPEC:${lane}:${file}`);
        }
      }
    }
  }
  // The cross-browser config selects literal spec filenames. Reconcile every
  // selected spec's test identities against the complete Chromium invocation;
  // merely seeing one result from WebKit cannot stand in for its golden flow.
  const crossReport = evidence.find(entry => entry.lane === 'auth-cross-browser')?.report;
  for (const project of INVOCATIONS['auth-cross-browser'].projects) {
    const selection = crossReport?.config?.projects?.find(item => item.name === project);
    if (!Array.isArray(selection?.testMatch) || !selection.testMatch.length
      || selection.testMatch.some(pattern => typeof pattern !== 'string' || !/^[a-zA-Z0-9._/-]+\.spec\.ts$/.test(pattern) || pattern.split('/').includes('..'))
      || !Array.isArray(selection.testIgnore) || selection.testIgnore.length) {
      problems.push(`INVALID_CROSS_BROWSER_SELECTION:${project}`);
      continue;
    }
    const actual = new Set(authRecords.filter(record => record.lane === 'auth-cross-browser' && record.project === project).map(record => record.signature));
    for (const pattern of selection.testMatch) {
      const files = tracked.filter(file => file.startsWith('e2e/auth/') && file.endsWith(`/${pattern}`));
      if (!files.length) problems.push(`UNTRACKED_CROSS_BROWSER_SELECTION:${project}:${pattern}`);
      for (const expected of authRecords.filter(record => record.lane === 'auth-chromium' && files.includes(record.file))) {
        if (!actual.has(expected.signature)) problems.push(`MISSING_CROSS_BROWSER_TEST:${project}:${expected.signature}`);
      }
    }
  }
  for (const lane of Object.keys(INVOCATIONS)) if (!lanes.has(lane)) problems.push(`MISSING_INVOCATION:${lane}`);
  const orphans = tracked.filter(file => !collected.has(file));
  const unexecuted = tracked.filter(file => !executed.has(file));
  if (orphans.length) problems.push('ORPHAN_SPECS');
  if (unexecuted.length) problems.push('UNEXECUTED_SPECS');
  if (!tracked.length || trackedSet.size !== tracked.length) problems.push('INVALID_TRACKED_INVENTORY');
  return { ...identity, tracked: tracked.length, collected: collected.size, executed: executed.size, testRecords, orphans, unexecuted, problems };
}

function readIdentity() {
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const { GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: runAttempt } = process.env;
  if (!/^[a-f0-9]{40}$/.test(sourceSha) || !/^\d+$/.test(runId ?? '') || !/^\d+$/.test(runAttempt ?? '')) {
    throw new Error('EXACT_CI_IDENTITY_REQUIRED');
  }
  return { sourceSha, runId, runAttempt };
}
function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value)}\n`);
}
function evidenceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? evidenceFiles(file) : entry.isFile() && entry.name.endsWith('.evidence.json') ? [file] : [];
  });
}

/**
 * Read every sealed evidence file under `directory`, or refuse clearly.
 *
 * Observed live on 2026-09-19 (run 35469048701): a `gh run rerun --failed`
 * reruns only the failed jobs, which bumps the whole run to a new
 * `GITHUB_RUN_ATTEMPT`. The producer jobs that had already succeeded are
 * NOT rerun, so their `actions/upload-artifact` names stay tagged with the
 * previous attempt. The aggregator job's `download-artifact` step filters
 * by a pattern naming *its own* (new) attempt, matches nothing, and
 * `actions/download-artifact` then never creates `directory` at all —
 * `readdirSync` throws a bare `ENOENT: ... scandir '.artifacts/e2e-execution'`,
 * which explains nothing to whoever reads the log.
 *
 * This is a provenance question, not a filesystem one: partial reruns are
 * legitimate for diagnosis, but a *qualification* aggregation is only valid
 * when every producer and the aggregator share one attempt. So this refuses
 * loudly and says what to do, rather than let a stale-attempt mismatch
 * surface as an unexplained I/O error — and it never falls back to scanning
 * a different attempt's evidence, which would silently launder exactly the
 * mismatch it exists to catch.
 */
export function readEvidenceDirectoryOrThrow(directory) {
  let files;
  try {
    files = evidenceFiles(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        `EVIDENCE_DIRECTORY_MISSING: no artifacts were downloaded into '${directory}'. ` +
        'This happens when a partial rerun ("rerun failed jobs") leaves producer ' +
        "jobs on a previous GITHUB_RUN_ATTEMPT while this aggregator runs on a new " +
        'one, so no evidence artifact matches this attempt. A partial rerun is fine ' +
        'for diagnosing a single job, but a final qualification needs one complete, ' +
        'coherent attempt: rerun the WHOLE workflow (`gh run rerun <runId>`, without ' +
        '`--failed`), not just the failed jobs.',
        { cause: error },
      );
    }
    throw error;
  }
  if (!files.length) {
    throw new Error(
      `EVIDENCE_DIRECTORY_EMPTY: '${directory}' exists but contains no ` +
      '*.evidence.json files. Same cause and remedy as EVIDENCE_DIRECTORY_MISSING: ' +
      'rerun the whole workflow, not just the failed jobs.',
    );
  }
  return files.map(file => JSON.parse(readFileSync(file, 'utf8')));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, first, second, third] = process.argv.slice(2);
    const identity = readIdentity();
    if (mode === 'seal') {
      writeJson(third, sealReport(first, JSON.parse(readFileSync(second, 'utf8')), identity));
    } else if (mode === 'aggregate') {
      const tracked = execFileSync('git', ['ls-files', 'e2e'], { encoding: 'utf8' }).split('\n').filter(file => file.endsWith('.spec.ts')).sort();
      const evidence = readEvidenceDirectoryOrThrow(first);
      const result = auditExecutionEvidence(tracked, evidence, identity);
      writeJson(second, result);
      console.log(JSON.stringify(result, null, 2));
      if (result.problems.length) process.exitCode = 1;
    } else throw new Error('EXPECTED_SEAL_OR_AGGREGATE');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'E2E_EVIDENCE_FAILED');
    process.exitCode = 1;
  }
}
