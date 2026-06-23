#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const BLOCKED_ROOT_REPORT_RE = /^(AUDIT_|P0_|P1_|GO_LIVE_).+\.md$/;

function isDocsRootFile(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  if (!normalized.startsWith('docs/')) return false;
  const rest = normalized.slice('docs/'.length);
  return rest.length > 0 && !rest.includes('/');
}

function findMisplacedArchiveReports(filePaths) {
  return filePaths
    .map((filePath) => filePath.split(path.sep).join('/'))
    .filter((filePath) => isDocsRootFile(filePath))
    .filter((filePath) => BLOCKED_ROOT_REPORT_RE.test(path.posix.basename(filePath)));
}

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', 'docs'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const violations = findMisplacedArchiveReports(listTrackedFiles());

  if (violations.length > 0) {
    console.error('FAIL: historical audit/report files must not live at docs/ root.');
    console.error('Move them to docs/archive/ for historical proofs or docs/audits/ for active dated audits.');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log('OK: no historical audit/report files at docs/ root');
}

if (require.main === module) {
  main();
}

module.exports = {
  findMisplacedArchiveReports,
};
