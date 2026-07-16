#!/usr/bin/env node

/**
 * audit-production-artifact.js — Validates standalone artifact content.
 *
 * Checks: forbidden packages, symlinks, .env files, secrets, source maps,
 * file count, total size.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] ?? '.next/standalone');

// Top-level entries Next.js standalone produces via output file tracing.
// Each entry has a reason for being allowed.
const allowedTopLevel = new Set([
  '.next',          // Next.js build output (server pages, chunks)
  'node_modules',   // Runtime dependencies traced by Next.js
  'package.json',   // Package metadata
  'server.js',      // Standalone entry point
  'public',         // Static assets (copied by copy-public-assets.js)
  'data',           // Runtime data files traced by Next.js (pricing, programmes)
  'docs',           // Referenced docs traced by Next.js
  'lib',            // Server-side lib code traced by Next.js
  'programmes',     // Curriculum data traced by Next.js
  'src',            // Static page templates traced by Next.js
  'Nexus_Reussite_Accueil.html', // Landing page traced by Next.js
]);

const forbiddenPathPattern = /(^|\/)(e2e|__tests__|playwright-report|test-results|\.worktrees|storage)(\/|$)|(^|\/)\.env(?:\.|$)|\.(pem|key|p12|pfx|patch|log)$/i;
const forbiddenPackagePattern = /(^|\/)node_modules\/(?:@emnapi\/runtime|@img\/sharp-wasm32)(\/|$)/;
const sourceMapPattern = /\.js\.map$/;

const findings = [];
let fileCount = 0;
let totalSize = 0;
const MAX_FILE_COUNT = 50000;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500 MB

function walk(directory, isRoot = false) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath).split(path.sep).join('/');

    // Top-level allowlist
    if (isRoot && !allowedTopLevel.has(entry.name)) {
      findings.push({ path: relativePath, reason: `top-level path not in allowlist: ${entry.name}` });
      continue;
    }

    // Symlink check
    try {
      const lstats = fs.lstatSync(fullPath);
      if (lstats.isSymbolicLink()) {
        findings.push({ path: relativePath, reason: 'symlink found in artifact' });
        continue;
      }
    } catch {
      // ignore stat errors
    }

    // Forbidden path patterns
    if (forbiddenPathPattern.test(relativePath)) {
      findings.push({ path: relativePath, reason: 'forbidden path pattern (.env, secrets, tests)' });
      continue;
    }

    // Forbidden packages
    if (forbiddenPackagePattern.test(relativePath)) {
      findings.push({ path: relativePath, reason: 'forbidden package in artifact' });
      continue;
    }

    // Docker-compose, canonical-bilans-pack
    if (entry.name === 'canonical-bilans-pack.json' || /^docker-compose.*\.ya?ml$/i.test(entry.name)) {
      findings.push({ path: relativePath, reason: 'forbidden production content' });
      continue;
    }

    // Source maps in app code (not in node_modules)
    if (sourceMapPattern.test(entry.name) && !relativePath.startsWith('node_modules/')) {
      findings.push({ path: relativePath, reason: 'source map in non-dependency artifact' });
      continue;
    }

    if (entry.isFile()) {
      fileCount++;
      try {
        totalSize += fs.statSync(fullPath).size;
      } catch {
        // ignore
      }
    }

    if (entry.isDirectory()) walk(fullPath);
  }
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  process.stderr.write(`Standalone artifact directory does not exist: ${root}\n`);
  process.exit(1);
}

walk(root, true);

if (fileCount > MAX_FILE_COUNT) {
  findings.push({ path: '(total)', reason: `file count ${fileCount} exceeds limit ${MAX_FILE_COUNT}` });
}
if (totalSize > MAX_TOTAL_SIZE) {
  findings.push({ path: '(total)', reason: `total size ${(totalSize / 1024 / 1024).toFixed(1)}MB exceeds limit ${MAX_TOTAL_SIZE / 1024 / 1024}MB` });
}

const report = {
  root,
  allowedTopLevel: [...allowedTopLevel].sort(),
  fileCount,
  totalSizeMB: +(totalSize / 1024 / 1024).toFixed(1),
  findings: findings.sort((a, b) => a.path.localeCompare(b.path)),
  passed: findings.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
