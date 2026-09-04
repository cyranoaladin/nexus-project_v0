#!/usr/bin/env node

/**
 * validate-next-traces.js — Validates Next.js output file tracing manifests.
 *
 * For each .nft.json manifest, resolves each reference and classifies it:
 * - errors: secret key files, real .env files, .worktrees, .git,
 *           private keys, fixtures E2E, backup/dump, absolute local paths
 * - warnings: __tests__, __mocks__ (only if standalone audit proves they aren't copied)
 * - outsideRoot: references that resolve outside outputFileTracingRoot
 *
 * Report structure: { errors, warnings, references, outsideRoot }
 * Errors block the build. Warnings are informational.
 */

const fs = require('node:fs');
const path = require('node:path');
const { errorPatterns, absoluteLocalPattern, warningPatterns, classifyFile } = require('./next-traces-classifiers');

const root = path.resolve(process.argv[2] ?? '.next');

// Determine outputFileTracingRoot (defaults to project root, i.e. parent of .next)
const projectRoot = path.resolve(root, '..');

const manifests = [];
const malformed = [];
const missing = [];
const errors = [];
const warnings = [];
const outsideRoot = [];
const referenceDetails = [];

function walk(directory) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (err) {
    errors.push({ manifest: '(walk)', reference: directory, reason: `filesystem error: ${err.message}` });
    return;
  }
  for (const entry of entries) {
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

    // Check for absolute local paths in the raw reference (before resolution).
    // Resolved paths are always absolute (path.resolve), so only check the
    // original manifest reference string for hardcoded local paths.
    if (absoluteLocalPattern.test(reference)) {
      errors.push({ manifest: relativeManifest, reference, resolved, reason: 'absolute local path in manifest' });
      continue;
    }

    const exists = fs.existsSync(resolved);
    if (!exists) {
      missing.push({ manifest: relativeManifest, reference });
      continue;
    }

    // Check if reference is outside project root
    const relative = path.relative(projectRoot, resolved);
    const isOutside = relative.startsWith('..');
    if (isOutside) {
      outsideRoot.push({ manifest: relativeManifest, reference, resolved });
    }

    // Classify
    const category = classifyFile(resolved);

    // Record reference detail
    referenceDetails.push({
      manifest: relativeManifest,
      reference,
      resolved,
      insideRoot: !isOutside,
      exists: true,
      category,
    });

    // Check error patterns
    const errorMatch = errorPatterns.find(({ pattern, test: testFn }) =>
      testFn ? testFn(normalized) : pattern.test(normalized),
    );
    if (errorMatch) {
      errors.push({ manifest: relativeManifest, reference, resolved, reason: errorMatch.reason, category });
      continue;
    }

    // Check warning patterns
    const warnMatch = warningPatterns.find(({ pattern }) => pattern.test(normalized));
    if (warnMatch) {
      warnings.push({ manifest: relativeManifest, reference, resolved, reason: warnMatch.reason, category });
    }
  }
}

const report = {
  root,
  projectRoot,
  manifests: manifests.length,
  references: referenceCount,
  malformed,
  missing,
  errors,
  warnings,
  outsideRoot,
  passed:
    manifests.length > 0 &&
    malformed.length === 0 &&
    missing.length === 0 &&
    errors.length === 0,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exit(1);
