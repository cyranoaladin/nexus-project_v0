#!/usr/bin/env node

/**
 * audit-production-artifact.js — Validates standalone artifact content.
 *
 * Critical (blocking): forbidden packages, forbidden directories,
 * forbidden file patterns, .env files, secret keys, symlinks,
 * filesystem errors, size limits.
 *
 * Report includes:
 * - top-level directories with file counts and sizes
 * - source maps, test/mock/compose/config file tracking
 * - absolute local paths in text files
 * - gitignored files detected in artifact
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] ?? '.next/standalone');

const forbiddenPackagePattern = /(^|\/)node_modules\/(?:@emnapi\/runtime|@img\/sharp-wasm32)(\/|$)/;

// Directories forbidden in standalone artifact (BLOCKING).
const forbiddenDirs = new Set([
  '.worktrees', '.git', 'e2e', '__tests__', '__mocks__',
  'playwright-report', 'test-results', 'coverage',
]);

// File patterns forbidden in standalone artifact (BLOCKING).
const forbiddenFilePatterns = [
  /^docker-compose.*\.ya?ml$/i,
  /^Dockerfile/i,
  /\.patch$/,
  /\.log$/,
  /^canonical-bilans-pack\.json$/,
];

// .env files: refuse all except explicitly safe suffixes (BLOCKING).
const envSafeSuffixes = ['.example', '.sample', '.template'];
function isEnvForbidden(name) {
  if (!/^\.env/i.test(name)) return false;
  return !envSafeSuffixes.some((s) => name.endsWith(s));
}

// Secret key files (BLOCKING).
const secretKeyPattern = /\.(pem|key|p12|pfx)$/i;

// Source maps in app code (advisory).
const sourceMapPattern = /\.js\.map$/;

// Absolute local paths pattern (informational).
const absolutePathPattern = /(?:\/home\/[a-z][a-z0-9_-]*\/|\/Users\/[a-z][a-z0-9_-]*\/|C:\\Users\\)/i;

const findings = [];       // Blocking findings
const topLevelDirs = [];
const topLevelStats = {};
const sourceMaps = [];
const testFiles = [];
const mockFiles = [];
const composeFiles = [];
const configFiles = [];
const absolutePathFiles = [];
const gitIgnoredFiles = [];
let fileCount = 0;
let totalSize = 0;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

// Common gitignored patterns (for detection in artifact).
const gitIgnoredPatterns = [
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
  /^\.eslintcache$/,
  /^\.tsbuildinfo$/,
  /\.swp$/,
  /~$/,
  /^npm-debug\.log/,
  /^yarn-debug\.log/,
  /^yarn-error\.log/,
  /^\.npm$/,
  /^\.yarn$/,
];

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

    const inNodeModules = relativePath.startsWith('node_modules/');

    // BLOCKING: directories forbidden in standalone artifact
    if (entry.isDirectory() && forbiddenDirs.has(entry.name) && !inNodeModules) {
      findings.push({ path: relativePath, reason: `forbidden directory in artifact: ${entry.name}` });
      continue;
    }

    // BLOCKING: symlink / lstat check
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

    // BLOCKING: forbidden packages
    if (forbiddenPackagePattern.test(relativePath)) {
      findings.push({ path: relativePath, reason: 'forbidden package in artifact' });
      continue;
    }

    // BLOCKING: .env files (only outside node_modules)
    if (!inNodeModules && isEnvForbidden(entry.name)) {
      findings.push({ path: relativePath, reason: `forbidden .env file: ${entry.name}` });
      continue;
    }

    // BLOCKING: secret key files
    if (secretKeyPattern.test(entry.name)) {
      findings.push({ path: relativePath, reason: 'secret key file in artifact' });
      continue;
    }

    // BLOCKING: forbidden file patterns (only outside node_modules)
    if (!inNodeModules) {
      const matchedPattern = forbiddenFilePatterns.find((p) => p.test(entry.name));
      if (matchedPattern) {
        findings.push({ path: relativePath, reason: `forbidden file in artifact: ${entry.name}` });
        continue;
      }
    }

    // Track source maps in app code (informational)
    if (sourceMapPattern.test(entry.name) && !inNodeModules) {
      sourceMaps.push(relativePath);
    }

    // Track gitignored files in artifact (informational)
    if (!inNodeModules && gitIgnoredPatterns.some((p) => p.test(entry.name))) {
      gitIgnoredFiles.push(relativePath);
    }

    // Track informational categories
    if (!inNodeModules) {
      if (/(^|\/)__tests__(\/|$)/.test(relativePath)) testFiles.push(relativePath);
      if (/(^|\/)__mocks__(\/|$)/.test(relativePath)) mockFiles.push(relativePath);
      if (/^docker-compose/i.test(entry.name)) composeFiles.push(relativePath);
      if (/\.(config|rc)\.(js|ts|json|yml|yaml)$/i.test(entry.name)) configFiles.push(relativePath);
    }

    if (entry.isFile()) {
      fileCount++;
      totalSize += lstats.size;

      if (topLevelStats[topLevel]) {
        topLevelStats[topLevel].fileCount++;
        topLevelStats[topLevel].totalSize += lstats.size;
      }

      // Informational: absolute local paths in text files
      const inNextBuild = relativePath.startsWith('.next/');
      if (!inNodeModules && !inNextBuild && isTextFile(entry.name) && lstats.size < 512 * 1024) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (absolutePathPattern.test(content)) {
            absolutePathFiles.push(relativePath);
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
  gitIgnoredFiles,
  findings: findings.sort((a, b) => a.path.localeCompare(b.path)),
  passed: findings.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
