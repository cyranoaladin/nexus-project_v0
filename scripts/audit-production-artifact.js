#!/usr/bin/env node

/**
 * audit-production-artifact.js — Validates standalone artifact content.
 *
 * Checks: forbidden packages, symlinks, .env files (real, not examples),
 * secret key files, total size.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] ?? '.next/standalone');

// Forbidden packages that must never ship to production.
const forbiddenPackagePattern = /(^|\/)node_modules\/(?:@emnapi\/runtime|@img\/sharp-wasm32)(\/|$)/;

// Real .env files (not .example templates) and secret key files.
const secretFilePattern = /(?:^|\/)\.env(?:\.local|\.production\.local|\.development\.local)$|\.(pem|key|p12|pfx)$/i;

const findings = [];
let fileCount = 0;
let totalSize = 0;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500 MB

function walk(directory) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath).split(path.sep).join('/');

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

    // Forbidden packages
    if (forbiddenPackagePattern.test(relativePath)) {
      findings.push({ path: relativePath, reason: 'forbidden package in artifact' });
      continue;
    }

    // Real secret files (not .example templates)
    if (secretFilePattern.test(relativePath)) {
      findings.push({ path: relativePath, reason: 'secret file in artifact' });
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

walk(root);

if (totalSize > MAX_TOTAL_SIZE) {
  findings.push({ path: '(total)', reason: `total size ${(totalSize / 1024 / 1024).toFixed(1)}MB exceeds limit ${MAX_TOTAL_SIZE / 1024 / 1024}MB` });
}

const report = {
  root,
  fileCount,
  totalSizeMB: +(totalSize / 1024 / 1024).toFixed(1),
  findings: findings.sort((a, b) => a.path.localeCompare(b.path)),
  passed: findings.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
