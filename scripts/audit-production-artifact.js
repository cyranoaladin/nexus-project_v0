#!/usr/bin/env node

/**
 * audit-production-artifact.js — Validates standalone artifact content.
 *
 * Checks: forbidden packages, forbidden directories, symlinks, .env files,
 * secret key files, source maps, filesystem errors, size limits.
 * All filesystem errors are fatal (no silent catch).
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] ?? '.next/standalone');

const forbiddenPackagePattern = /(^|\/)node_modules\/(?:@emnapi\/runtime|@img\/sharp-wasm32)(\/|$)/;

// Directories that must never appear anywhere in the artifact.
const forbiddenDirs = new Set([
  '.worktrees', '.git', 'e2e', '__tests__', '__mocks__',
  'playwright-report', 'test-results', 'coverage',
]);

// File names/patterns that must never appear.
const forbiddenFilePatterns = [
  /^docker-compose.*\.ya?ml$/i,
  /^Dockerfile/,
  /\.patch$/,
  /\.log$/,
  /^canonical-bilans-pack\.json$/,
];

// .env files: refuse all except explicitly safe suffixes.
const envSafeSuffixes = ['.example', '.sample', '.template'];
function isEnvForbidden(name) {
  if (!/^\.env/i.test(name)) return false;
  return !envSafeSuffixes.some((s) => name.endsWith(s));
}

// Secret key files.
const secretKeyPattern = /\.(pem|key|p12|pfx)$/i;

// Source maps in app code.
const sourceMapPattern = /\.js\.map$/;

const findings = [];
const topLevelDirs = [];
let fileCount = 0;
let totalSize = 0;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

function walk(directory, depth = 0) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath).split(path.sep).join('/');

    if (depth === 0 && entry.isDirectory()) {
      topLevelDirs.push(entry.name);
    }

    // Forbidden directories
    if (entry.isDirectory() && forbiddenDirs.has(entry.name)) {
      findings.push({ path: relativePath, reason: `forbidden directory: ${entry.name}` });
      continue;
    }

    // Symlink check
    const lstats = fs.lstatSync(fullPath);
    if (lstats.isSymbolicLink()) {
      findings.push({ path: relativePath, reason: 'symlink found in artifact' });
      continue;
    }

    // Forbidden packages
    if (forbiddenPackagePattern.test(relativePath)) {
      findings.push({ path: relativePath, reason: 'forbidden package in artifact' });
      continue;
    }

    // .env files
    if (isEnvForbidden(entry.name)) {
      findings.push({ path: relativePath, reason: `forbidden .env file: ${entry.name}` });
      continue;
    }

    // Secret key files
    if (secretKeyPattern.test(entry.name)) {
      findings.push({ path: relativePath, reason: 'secret key file in artifact' });
      continue;
    }

    // Forbidden file patterns
    const matchedPattern = forbiddenFilePatterns.find((p) => p.test(entry.name));
    if (matchedPattern) {
      findings.push({ path: relativePath, reason: `forbidden file pattern: ${entry.name}` });
      continue;
    }

    // Source maps in app code (allow in node_modules)
    if (sourceMapPattern.test(entry.name) && !relativePath.startsWith('node_modules/')) {
      findings.push({ path: relativePath, reason: 'source map in app artifact' });
      continue;
    }

    if (entry.isFile()) {
      fileCount++;
      totalSize += lstats.size;
    }

    if (entry.isDirectory()) walk(fullPath, depth + 1);
  }
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  process.stderr.write(`Standalone artifact directory does not exist: ${root}\n`);
  process.exit(1);
}

walk(root);

if (totalSize > MAX_TOTAL_SIZE) {
  findings.push({ path: '(total)', reason: `total size ${(totalSize / 1024 / 1024).toFixed(1)}MB exceeds limit ${MAX_TOTAL_SIZE / 1024 / 1024}MB` });
}

const report = {
  root,
  topLevelDirs: topLevelDirs.sort(),
  fileCount,
  totalSizeMB: +(totalSize / 1024 / 1024).toFixed(1),
  findings: findings.sort((a, b) => a.path.localeCompare(b.path)),
  passed: findings.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
