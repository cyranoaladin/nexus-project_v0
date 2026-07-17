#!/usr/bin/env node

/**
 * audit-production-artifact.js — Validates standalone artifact content.
 *
 * Checks: forbidden packages, forbidden directories, symlinks, .env files,
 * secret key files, source maps, filesystem errors, size limits.
 * All filesystem errors are fatal (no silent catch).
 *
 * Enhanced report includes:
 * - top-level directories with file counts and sizes
 * - source maps listing
 * - git-ignored files
 * - test/mock files
 * - compose/config files
 * - absolute local paths in text files
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
  /^Dockerfile/i,
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

// Absolute local paths pattern (common dev paths in text files).
const absolutePathPattern = /(?:\/home\/[a-z][a-z0-9_-]*\/|\/Users\/[a-z][a-z0-9_-]*\/|C:\\Users\\)/i;

const findings = [];
const topLevelDirs = [];
const topLevelStats = {};
const sourceMaps = [];
const testFiles = [];
const mockFiles = [];
const composeFiles = [];
const configFiles = [];
const absolutePathFiles = [];
let fileCount = 0;
let totalSize = 0;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

function isTextFile(name) {
  return /\.(js|ts|tsx|jsx|json|yml|yaml|md|txt|css|html|env|mjs|cjs|toml|cfg|ini|sh)$/i.test(name);
}

function walk(directory, depth = 0) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (err) {
    findings.push({ path: path.relative(root, directory), reason: `filesystem error (readdir): ${err.message}` });
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath).split(path.sep).join('/');
    const topLevel = relativePath.split('/')[0];

    if (depth === 0 && entry.isDirectory()) {
      topLevelDirs.push(entry.name);
      topLevelStats[entry.name] = { fileCount: 0, totalSize: 0 };
    }

    // Forbidden directories (skip checks inside node_modules — packages may contain .git metadata)
    const inNodeModules = relativePath.startsWith('node_modules/');
    if (entry.isDirectory() && forbiddenDirs.has(entry.name) && !inNodeModules) {
      findings.push({ path: relativePath, reason: `forbidden directory: ${entry.name}` });
      continue;
    }

    // Symlink / lstat check
    let lstats;
    try {
      lstats = fs.lstatSync(fullPath);
    } catch (err) {
      findings.push({ path: relativePath, reason: `filesystem error (lstat): ${err.message}` });
      continue;
    }

    if (lstats.isSymbolicLink()) {
      findings.push({ path: relativePath, reason: 'symlink found in artifact' });
      continue;
    }

    // Forbidden packages
    if (forbiddenPackagePattern.test(relativePath)) {
      findings.push({ path: relativePath, reason: 'forbidden package in artifact' });
      continue;
    }

    // .env files (only outside node_modules — packages may ship .env examples)
    if (!inNodeModules && isEnvForbidden(entry.name)) {
      findings.push({ path: relativePath, reason: `forbidden .env file: ${entry.name}` });
      continue;
    }

    // Secret key files (check everywhere)
    if (secretKeyPattern.test(entry.name)) {
      findings.push({ path: relativePath, reason: 'secret key file in artifact' });
      continue;
    }

    // Forbidden file patterns (only outside node_modules)
    if (!inNodeModules) {
      const matchedPattern = forbiddenFilePatterns.find((p) => p.test(entry.name));
      if (matchedPattern) {
        findings.push({ path: relativePath, reason: `forbidden file pattern: ${entry.name}` });
        continue;
      }
    }

    // Source maps in app code (allow in node_modules)
    if (sourceMapPattern.test(entry.name) && !inNodeModules) {
      findings.push({ path: relativePath, reason: 'source map in app artifact' });
      sourceMaps.push(relativePath);
      continue;
    }

    // Track informational categories (not blocking)
    if (!inNodeModules) {
      if (/(^|\/)__tests__(\/|$)/.test(relativePath)) testFiles.push(relativePath);
      if (/(^|\/)__mocks__(\/|$)/.test(relativePath)) mockFiles.push(relativePath);
      if (/^docker-compose/i.test(entry.name)) composeFiles.push(relativePath);
      if (/\.(config|rc)\.(js|ts|json|yml|yaml)$/i.test(entry.name)) configFiles.push(relativePath);
    }

    if (entry.isFile()) {
      fileCount++;
      totalSize += lstats.size;

      // Track per top-level dir
      if (topLevelStats[topLevel]) {
        topLevelStats[topLevel].fileCount++;
        topLevelStats[topLevel].totalSize += lstats.size;
      }

      // Check text files for absolute local paths (only outside node_modules, small files)
      if (!inNodeModules && isTextFile(entry.name) && lstats.size < 512 * 1024) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (absolutePathPattern.test(content)) {
            absolutePathFiles.push(relativePath);
            findings.push({ path: relativePath, reason: 'absolute local path detected in text file' });
          }
        } catch (err) {
          findings.push({ path: relativePath, reason: `filesystem error (read): ${err.message}` });
        }
      }
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

// Build size-per-top-level report
const topLevelReport = {};
for (const [dir, stats] of Object.entries(topLevelStats)) {
  topLevelReport[dir] = {
    fileCount: stats.fileCount,
    sizeMB: +(stats.totalSize / 1024 / 1024).toFixed(1),
  };
}

const report = {
  root,
  topLevelDirs: topLevelDirs.sort(),
  topLevelReport,
  fileCount,
  totalSizeMB: +(totalSize / 1024 / 1024).toFixed(1),
  sourceMaps,
  testFiles,
  mockFiles,
  composeFiles,
  configFiles,
  absolutePathFiles,
  findings: findings.sort((a, b) => a.path.localeCompare(b.path)),
  passed: findings.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
