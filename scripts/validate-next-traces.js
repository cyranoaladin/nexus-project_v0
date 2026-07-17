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

// Hard errors: actual secrets or unsafe content in traces.
const errorPatterns = [
  { pattern: /\.(pem|key|p12|pfx)$/i, reason: 'secret key file' },
  { pattern: /(^|\/)\.env(?!\.example|\.sample|\.template)(\.|$)/i, reason: 'real .env file' },
  { pattern: /(^|\/)\.worktrees(\/|$)/, reason: '.worktrees directory' },
  { pattern: /(^|\/)\.git(\/|$)/, reason: '.git directory' },
  { pattern: /(^|\/)e2e\/fixtures?(\/|$)/, reason: 'E2E fixture' },
  { pattern: /\.(bak|dump|sql\.gz)$/i, reason: 'backup or dump file' },
];

// Absolute local path patterns (never valid in traced references)
const absoluteLocalPattern = /^\/home\/|^\/Users\/|^C:\\Users\\/;

// Soft warnings: test/mock files that Next.js traces but doesn't ship.
const warningPatterns = [
  { pattern: /(^|\/)__tests__(\/|$)/, reason: 'test file reference' },
  { pattern: /(^|\/)__mocks__(\/|$)/, reason: 'mock file reference' },
  { pattern: /(^|\/)e2e(\/|$)/, reason: 'e2e file reference' },
  { pattern: /(^|\/)fixtures?(\/|$)/, reason: 'fixture reference' },
];

function classifyFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.js', '.mjs', '.cjs'].includes(ext)) return 'javascript';
  if (['.ts', '.tsx'].includes(ext)) return 'typescript';
  if (['.json'].includes(ext)) return 'json';
  if (['.node'].includes(ext)) return 'native-addon';
  if (['.css', '.scss', '.sass'].includes(ext)) return 'style';
  if (['.wasm'].includes(ext)) return 'wasm';
  return 'other';
}

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
    const errorMatch = errorPatterns.find(({ pattern }) => pattern.test(normalized));
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
