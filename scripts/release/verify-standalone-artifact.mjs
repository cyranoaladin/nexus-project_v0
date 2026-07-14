#!/usr/bin/env node

/**
 * verify-standalone-artifact.mjs
 *
 * Validates that a Next.js standalone build artifact is complete and consistent.
 * Fails with exit code 1 if any check fails — designed as a release gate.
 *
 * Usage:
 *   node scripts/release/verify-standalone-artifact.mjs [buildDir]
 *   buildDir defaults to current working directory.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { createHash } from 'crypto';
import { join, relative } from 'path';
import { writeFile } from 'fs/promises';

const buildDir = process.argv[2] || process.cwd();
const errors = [];

function fail(msg) {
  errors.push(msg);
  console.error(`  FAIL: ${msg}`);
}

function ok(msg) {
  console.log(`  OK: ${msg}`);
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function walkFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

async function computeTreeDigest(dir) {
  const files = await walkFiles(dir);
  const entries = [];
  for (const file of files) {
    const rel = relative(dir, file);
    const s = await stat(file);
    const content = await readFile(file);
    const hash = createHash('sha256').update(content).digest('hex');
    entries.push(`${rel}\t${s.size}\t${hash}`);
  }
  entries.sort();
  return {
    fileCount: entries.length,
    digest: createHash('sha256').update(entries.join('\n')).digest('hex').slice(0, 16),
    entries,
  };
}

console.log(`\nVerifying standalone artifact in: ${buildDir}\n`);

// 1. Check critical files
const checks = [
  ['.next/standalone/server.js', 'Standalone server.js'],
  ['.next/BUILD_ID', 'Source BUILD_ID'],
  ['.next/standalone/.next/BUILD_ID', 'Standalone BUILD_ID'],
];

for (const [path, label] of checks) {
  if (await exists(join(buildDir, path))) {
    ok(label);
  } else {
    fail(`${label} missing at ${path}`);
  }
}

// 2. Check static directories
const sourceStaticDir = join(buildDir, '.next/static');
const standaloneStaticDir = join(buildDir, '.next/standalone/.next/static');
const publicDir = join(buildDir, '.next/standalone/public');

if (!await exists(sourceStaticDir)) {
  fail('.next/static directory missing');
}
if (!await exists(standaloneStaticDir)) {
  fail('.next/standalone/.next/static directory missing');
}
if (!await exists(publicDir)) {
  fail('.next/standalone/public directory missing');
}

// 3. Count and verify JS/CSS chunks
let sourceTree = { fileCount: 0, digest: 'MISSING' };
let standaloneTree = { fileCount: 0, digest: 'MISSING' };

if (await exists(sourceStaticDir)) {
  sourceTree = await computeTreeDigest(sourceStaticDir);
  const jsCount = sourceTree.entries.filter(e => e.startsWith('chunks/') && e.includes('.js')).length;
  const cssCount = sourceTree.entries.filter(e => e.includes('.css')).length;
  if (jsCount === 0) fail('No JS chunks in source .next/static/chunks/');
  else ok(`Source: ${jsCount} JS chunks, ${cssCount} CSS files, ${sourceTree.fileCount} total`);
}

if (await exists(standaloneStaticDir)) {
  standaloneTree = await computeTreeDigest(standaloneStaticDir);
  const jsCount = standaloneTree.entries.filter(e => e.startsWith('chunks/') && e.includes('.js')).length;
  if (jsCount === 0) fail('No JS chunks in standalone .next/static/chunks/');
  else ok(`Standalone: ${standaloneTree.fileCount} files, digest ${standaloneTree.digest}`);
}

// 4. Compare file counts and digests
if (sourceTree.fileCount !== standaloneTree.fileCount) {
  fail(`File count mismatch: source=${sourceTree.fileCount} standalone=${standaloneTree.fileCount}`);
} else {
  ok(`File counts match: ${sourceTree.fileCount}`);
}

if (sourceTree.digest !== standaloneTree.digest) {
  fail(`Tree digest mismatch: source=${sourceTree.digest} standalone=${standaloneTree.digest}`);
} else {
  ok(`Tree digests match: ${sourceTree.digest}`);
}

// 5. Check BUILD_ID consistency
let buildIdMatch = false;
try {
  const srcId = (await readFile(join(buildDir, '.next/BUILD_ID'), 'utf8')).trim();
  const saId = (await readFile(join(buildDir, '.next/standalone/.next/BUILD_ID'), 'utf8')).trim();
  if (srcId === saId) {
    ok(`BUILD_ID match: ${srcId}`);
    buildIdMatch = true;
  } else {
    fail(`BUILD_ID mismatch: source=${srcId} standalone=${saId}`);
  }
} catch {
  fail('Cannot read BUILD_ID files');
}

// 6. Check manifests
const manifests = [
  '.next/build-manifest.json',
  '.next/app-build-manifest.json',
];
for (const m of manifests) {
  if (await exists(join(buildDir, m))) ok(`Manifest: ${m}`);
  else fail(`Manifest missing: ${m}`);
}

// Summary
console.log('\n--- SUMMARY ---');
console.log(`SOURCE_STATIC_FILE_COUNT=${sourceTree.fileCount}`);
console.log(`STANDALONE_STATIC_FILE_COUNT=${standaloneTree.fileCount}`);
console.log(`SOURCE_STATIC_TREE_DIGEST=${sourceTree.digest}`);
console.log(`STANDALONE_STATIC_TREE_DIGEST=${standaloneTree.digest}`);
console.log(`BUILD_ID_MATCH=${buildIdMatch}`);
console.log(`STANDALONE_ARTIFACT_VALID=${errors.length === 0}`);

// 7. Write release manifest
if (errors.length === 0) {
  const buildId = (await readFile(join(buildDir, '.next/BUILD_ID'), 'utf8')).trim();
  const manifest = {
    RELEASE_SHA: process.env.RELEASE_SHA || 'unknown',
    BUILD_ID: buildId,
    NODE_VERSION: process.version,
    NEXT_VERSION: '15.5.18',
    SOURCE_STATIC_FILE_COUNT: sourceTree.fileCount,
    STANDALONE_STATIC_FILE_COUNT: standaloneTree.fileCount,
    STATIC_TREE_DIGEST: sourceTree.digest,
    BUILD_TIMESTAMP: new Date().toISOString(),
    BUILT_BY_USER: process.env.USER || 'unknown',
    ARTIFACT_VERIFIED: true,
  };
  await writeFile(join(buildDir, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nrelease-manifest.json written');
}

if (errors.length > 0) {
  console.error(`\n${errors.length} ERROR(S) — ARTIFACT INVALID\n`);
  process.exit(1);
} else {
  console.log('\nARTIFACT VALID\n');
}
