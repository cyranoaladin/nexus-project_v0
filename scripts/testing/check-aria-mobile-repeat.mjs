#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const expectedCases = new Map([
  ['visual-a11y.spec.ts', 'E019 ARIA_VISUAL_VIEWPORT_MATRIX @visual — 768x1024 eight-state qualification'],
].map(([file, title]) => [file, `E019 case:${createHash('sha256').update(title).digest('hex')}`]));
const invalid = () => { throw new Error('ARIA_MOBILE_REPEAT_EVIDENCE_INVALID'); };

export function qualifyAriaMobileRepeat(report) {
  if (!report || report.privacyFormat !== 'playwright-allowlist/1'
    || report.config?.rootDir !== '/workspace/e2e/aria' || !Array.isArray(report.suites) || !Array.isArray(report.errors)
    || report.errors.length !== 0 || report.stats?.expected !== 20
    || report.stats.skipped !== 0 || report.stats.unexpected !== 0 || report.stats.flaky !== 0) invalid();
  const specs = [];
  function walk(suites, depth = 0) {
    if (!Array.isArray(suites) || depth > 32) invalid();
    for (const suite of suites) {
      if (!suite || !Array.isArray(suite.specs) || !Array.isArray(suite.suites)) invalid();
      specs.push(...suite.specs);
      walk(suite.suites, depth + 1);
    }
  }
  walk(report.suites);
  if (specs.length !== 20) invalid();
  const seen = new Set();
  const counts = new Map([...expectedCases.keys()].map(file => [file, 0]));
  for (const spec of specs) {
    const file = typeof spec?.file === 'string' ? spec.file.replace(/^e2e\/aria\//, '') : '';
    if (!expectedCases.has(file) || spec.title !== expectedCases.get(file)
      || typeof spec.executionId !== 'string' || !/^execution:[a-f0-9]{64}$/.test(spec.executionId)
      || seen.has(spec.executionId) || spec.ok !== true
      || !Array.isArray(spec.tests) || spec.tests.length !== 1) invalid();
    seen.add(spec.executionId);
    counts.set(file, counts.get(file) + 1);
    for (const test of spec.tests) {
      if (test?.projectName !== 'aria-mobile' || test.expectedStatus !== 'passed'
        || test.status !== 'expected' || !Array.isArray(test.annotations)
        || test.annotations.some(a => ['skip', 'fixme', 'fail'].includes(a?.type))
        || !Array.isArray(test.results) || test.results.length !== 1) invalid();
      const result = test.results[0];
      if (result?.status !== 'passed' || result.retry !== 0 || result.error
        || !Array.isArray(result.errors) || result.errors.length !== 0) invalid();
    }
  }
  if ([...counts.values()].some(count => count !== 20)) invalid();
  return { project: 'aria-mobile', cases: 1, repetitionsPerCase: 20, passed: 20, skipped: 0, retries: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const reportPath = process.argv[2];
  if (!reportPath) invalid();
  const directory = path.dirname(path.resolve(reportPath));
  const head = readFileSync(path.join(directory, 'head.sha'), 'utf8').trim();
  const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(head) || head !== actualHead) invalid();
  const proof = qualifyAriaMobileRepeat(JSON.parse(readFileSync(reportPath, 'utf8')));
  writeFileSync(path.join(directory, 'qualification.json'), JSON.stringify({ head, ...proof }) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('ARIA_MOBILE_REPEAT20_VERIFIED');
}
