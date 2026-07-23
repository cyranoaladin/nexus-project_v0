#!/usr/bin/env node

/**
 * verify-standalone-artifact.mjs — Release gate for Next.js standalone builds.
 *
 * Validates completeness and consistency of the standalone artifact.
 * Exits 1 on any failure. Generates release-manifest.json on success.
 *
 * Usage: node scripts/release/verify-standalone-artifact.mjs [buildDir]
 */

import { readdir, readFile, stat, realpath, rm, mkdir, cp } from 'fs/promises';
import { createHash } from 'crypto';
import { join, relative, resolve } from 'path';
import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';

const buildDir = resolve(process.argv[2] || process.cwd());
const errors = [];

function fail(msg) { errors.push(msg); console.error(`  FAIL: ${msg}`); }
function ok(msg) { console.log(`  OK: ${msg}`); }

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function walkFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await walkFiles(full));
    else if (entry.isFile()) results.push(full);
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
    entries.push({ rel, size: s.size, hash });
  }
  entries.sort((a, b) => a.rel.localeCompare(b.rel));
  const combined = entries.map(e => `${e.rel}\t${e.size}\t${e.hash}`).join('\n');
  return {
    fileCount: entries.length,
    digest: createHash('sha256').update(combined).digest('hex'),
    entries,
  };
}

function safeExec(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim(); } catch { return null; }
}

async function fileHash(path) {
  try {
    const content = await readFile(path);
    return createHash('sha256').update(content).digest('hex');
  } catch { return null; }
}

console.log(`\nverify-standalone-artifact\nbuildDir: ${buildDir}\n`);

// ── Refuse to run against active production release ──
const prodSymlink = process.env.NEXUS_ACTIVE_RELEASE_PATH;
try {
  const prodReal = prodSymlink ? await realpath(prodSymlink).catch(() => null) : null;
  const buildReal = await realpath(buildDir);
  if (prodReal && buildReal === prodReal) {
    fail('Refusing to run against the active production release');
    console.error(`\n1 ERROR — ARTIFACT INVALID (safety check)\n`);
    process.exit(1);
  }
} catch { /* not on production server — OK */ }

// ── 1. Critical files ──
const checks = [
  ['.next/standalone/server.js', 'Standalone server.js'],
  ['.next/BUILD_ID', 'Source BUILD_ID'],
  ['.next/standalone/.next/BUILD_ID', 'Standalone BUILD_ID'],
];
for (const [p, label] of checks) {
  if (await exists(join(buildDir, p))) ok(label);
  else fail(`${label} missing at ${p}`);
}

// ── 2. Static directories ──
const sourceStaticDir = join(buildDir, '.next/static');
const standaloneStaticDir = join(buildDir, '.next/standalone/.next/static');
const publicDir = join(buildDir, '.next/standalone/public');

if (!await exists(sourceStaticDir)) fail('.next/static missing');
if (!await exists(standaloneStaticDir)) fail('.next/standalone/.next/static missing');
if (!await exists(publicDir)) fail('.next/standalone/public missing');

// ── 3. Tree digests ──
let sourceTree = { fileCount: 0, digest: 'MISSING', entries: [] };
let standaloneTree = { fileCount: 0, digest: 'MISSING', entries: [] };

if (await exists(sourceStaticDir)) {
  sourceTree = await computeTreeDigest(sourceStaticDir);
  const jsCount = sourceTree.entries.filter(e => e.rel.startsWith('chunks/') && e.rel.endsWith('.js')).length;
  if (jsCount === 0) fail('No JS chunks in source .next/static/chunks/');
  else ok(`Source: ${jsCount} JS chunks, ${sourceTree.fileCount} total files`);
}

if (await exists(standaloneStaticDir)) {
  standaloneTree = await computeTreeDigest(standaloneStaticDir);
  const jsCount = standaloneTree.entries.filter(e => e.rel.startsWith('chunks/') && e.rel.endsWith('.js')).length;
  if (jsCount === 0) fail('No JS chunks in standalone static');
  else ok(`Standalone: ${standaloneTree.fileCount} files`);
}

// ── 4. Match counts and digests ──
if (sourceTree.fileCount !== standaloneTree.fileCount) {
  fail(`File count mismatch: source=${sourceTree.fileCount} standalone=${standaloneTree.fileCount}`);
} else {
  ok(`File counts match: ${sourceTree.fileCount}`);
}

if (sourceTree.digest !== standaloneTree.digest) {
  fail(`Tree digest mismatch`);
} else {
  ok(`Tree digests match`);
}

// ── 5. BUILD_ID ──
let buildId = '';
let buildIdMatch = false;
try {
  const srcId = (await readFile(join(buildDir, '.next/BUILD_ID'), 'utf8')).trim();
  const saId = (await readFile(join(buildDir, '.next/standalone/.next/BUILD_ID'), 'utf8')).trim();
  buildId = srcId;
  if (srcId === saId) { ok(`BUILD_ID match: ${srcId}`); buildIdMatch = true; }
  else fail(`BUILD_ID mismatch: source=${srcId} standalone=${saId}`);
} catch { fail('Cannot read BUILD_ID'); }

// ── 6. Manifests ──
for (const m of ['.next/build-manifest.json', '.next/app-build-manifest.json']) {
  if (await exists(join(buildDir, m))) ok(`Manifest: ${m}`);
  else fail(`Manifest missing: ${m}`);
}

// ── 7. Public file count ──
let publicFileCount = 0;
if (await exists(publicDir)) {
  publicFileCount = (await walkFiles(publicDir)).length;
  ok(`Public files: ${publicFileCount}`);
}

// ── 8. Resolve RELEASE_SHA ──
let releaseSha = process.env.RELEASE_SHA || null;
if (!releaseSha) {
  releaseSha = safeExec(`cd "${buildDir}" && git rev-parse HEAD`);
}
if (!releaseSha) {
  fail('RELEASE_SHA cannot be determined (set RELEASE_SHA env or ensure .git is present)');
}

// ── 9. Resolve versions ──
const nodeVersion = process.version;
const npmVersion = safeExec('npm --version') || 'unknown';
let nextVersion = 'unknown';
try {
  const pkg = JSON.parse(await readFile(join(buildDir, 'node_modules/next/package.json'), 'utf8'));
  nextVersion = pkg.version;
} catch { /* next not in node_modules */ }

const packageLockHash = await fileHash(join(buildDir, 'package-lock.json'));
const gateScriptHash = await fileHash(join(buildDir, 'scripts/release/verify-standalone-artifact.mjs'));

// ── Summary ──
console.log('\n--- SUMMARY ---');
console.log(`SOURCE_STATIC_FILE_COUNT=${sourceTree.fileCount}`);
console.log(`STANDALONE_STATIC_FILE_COUNT=${standaloneTree.fileCount}`);
console.log(`SOURCE_STATIC_TREE_SHA256=${sourceTree.digest}`);
console.log(`STANDALONE_STATIC_TREE_SHA256=${standaloneTree.digest}`);
console.log(`BUILD_ID_MATCH=${buildIdMatch}`);
console.log(`RELEASE_SHA=${releaseSha || 'UNKNOWN'}`);
console.log(`STANDALONE_ARTIFACT_VALID=${errors.length === 0}`);

// ── Write manifest ──
if (errors.length === 0) {
  const manifest = {
    RELEASE_SHA: releaseSha,
    BUILD_ID: buildId,
    NODE_VERSION: nodeVersion,
    NPM_VERSION: npmVersion,
    NEXT_VERSION: nextVersion,
    SOURCE_STATIC_FILE_COUNT: sourceTree.fileCount,
    STANDALONE_STATIC_FILE_COUNT: standaloneTree.fileCount,
    PUBLIC_FILE_COUNT: publicFileCount,
    SOURCE_STATIC_TREE_SHA256: sourceTree.digest,
    STANDALONE_STATIC_TREE_SHA256: standaloneTree.digest,
    PACKAGE_LOCK_SHA256: packageLockHash,
    GATE_SCRIPT_SHA256: gateScriptHash,
    BUILD_TIMESTAMP: new Date().toISOString(),
    BUILT_BY_UID: process.getuid?.() ?? -1,
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
