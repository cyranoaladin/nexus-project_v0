#!/usr/bin/env node

/**
 * validate-next-traces.js — Validates Next.js output file tracing manifests.
 *
 * For each .nft.json manifest, checks references for:
 * - errors: secret key files, real .env files, .worktrees, .git
 * - warnings: __tests__, __mocks__, e2e, fixtures (traced but not shipped)
 * - outsideRoot: references that resolve outside outputFileTracingRoot
 *
 * Errors block the build. Warnings are informational.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] ?? '.next');

// Determine outputFileTracingRoot (defaults to project root, i.e. parent of .next)
const projectRoot = path.resolve(root, '..');

const manifests = [];
const malformed = [];
const missing = [];
const errors = [];
const warnings = [];
const outsideRoot = [];

// Hard errors: actual secrets or unsafe content in traces.
const errorPatterns = [
  { pattern: /\.(pem|key|p12|pfx)$/i, reason: 'secret key file' },
  { pattern: /(^|\/)\.env(?!\.example|\.sample|\.template)(\.|$)/i, reason: 'real .env file' },
  { pattern: /(^|\/)\.worktrees(\/|$)/, reason: '.worktrees directory' },
  { pattern: /(^|\/)\.git(\/|$)/, reason: '.git directory' },
];

// Soft warnings: test/mock files that Next.js traces but doesn't ship.
const warningPatterns = [
  { pattern: /(^|\/)__tests__(\/|$)/, reason: 'test file reference' },
  { pattern: /(^|\/)__mocks__(\/|$)/, reason: 'mock file reference' },
  { pattern: /(^|\/)e2e(\/|$)/, reason: 'e2e file reference' },
  { pattern: /(^|\/)fixtures?(\/|$)/, reason: 'fixture reference' },
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith('.nft.json')) manifests.push(fullPath);
  }
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  process.stderr.write(`Next.js build directory does not exist: ${root}\n`);
  process.exit(1);
}
walk(root);

let referenceCount = 0;
for (const manifestPath of manifests) {
  const relativeManifest = path.relative(root, manifestPath).split(path.sep).join('/');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    malformed.push({ manifest: relativeManifest, error: error.message });
    continue;
  }
  if (!Array.isArray(manifest.files)) {
    malformed.push({ manifest: relativeManifest, error: 'files must be an array' });
    continue;
  }
  for (const reference of manifest.files) {
    referenceCount += 1;
    const resolved = path.resolve(path.dirname(manifestPath), reference);
    const normalized = resolved.split(path.sep).join('/');

    if (!fs.existsSync(resolved)) {
      missing.push({ manifest: relativeManifest, reference });
      continue;
    }

    // Check if reference is outside project root
    const relative = path.relative(projectRoot, resolved);
    if (relative.startsWith('..')) {
      outsideRoot.push({ manifest: relativeManifest, reference, resolved });
    }

    // Check error patterns
    const errorMatch = errorPatterns.find(({ pattern }) => pattern.test(normalized));
    if (errorMatch) {
      errors.push({ manifest: relativeManifest, reference, reason: errorMatch.reason });
      continue;
    }

    // Check warning patterns
    const warnMatch = warningPatterns.find(({ pattern }) => pattern.test(normalized));
    if (warnMatch) {
      warnings.push({ manifest: relativeManifest, reference, reason: warnMatch.reason });
    }
  }
}

const report = {
  root,
  manifests: manifests.length,
  references: referenceCount,
  malformed,
  missing,
  errors,
  warnings: warnings.length,
  outsideRoot: outsideRoot.length,
  passed:
    manifests.length > 0 &&
    malformed.length === 0 &&
    missing.length === 0 &&
    errors.length === 0,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exit(1);
