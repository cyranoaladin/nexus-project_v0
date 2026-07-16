#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] ?? '.next');
const manifests = [];
const malformed = [];
const missing = [];
const forbidden = [];
// Forbidden paths in trace references. Note: Next.js may include __tests__ and
// .env.example paths in .nft.json manifests but does NOT copy them to standalone.
// The real gate is audit-production-artifact.js which checks actual standalone output.
// Only flag actual secret files (not .example templates).
const forbiddenPath = /\.(pem|key|p12|pfx)$/i;

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

let references = 0;
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
    references += 1;
    const resolved = path.resolve(path.dirname(manifestPath), reference);
    const normalized = resolved.split(path.sep).join('/');
    if (!fs.existsSync(resolved)) {
      missing.push({ manifest: relativeManifest, reference });
    }
    if (forbiddenPath.test(normalized)) {
      forbidden.push({ manifest: relativeManifest, reference });
    }
  }
}

const report = {
  root,
  manifests: manifests.length,
  references,
  malformed,
  missing,
  forbidden,
  passed:
    manifests.length > 0 &&
    malformed.length === 0 &&
    missing.length === 0 &&
    forbidden.length === 0,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exit(1);
