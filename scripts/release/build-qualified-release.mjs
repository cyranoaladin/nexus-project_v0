#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  BUILD_INPUT_SCHEMA,
  BUILD_PROVENANCE_NAME,
  BUILD_PROVENANCE_SCHEMA,
  BUILD_PAYLOAD_IDENTITY,
  BUILD_RECEIPT_SCHEMA,
  BUILD_SOURCE_IDENTITY,
  BUILD_STANDALONE_IDENTITY,
  assertSourceState,
  canonicalBuildId,
  canonicalJson,
  canonicalSourceSha,
  computePayloadInventory,
  parseStrictArgs,
  readJson,
  sha256File,
  validateBuildMetadata,
  validateBuildOriginBinding,
} from './qualified-release-core.mjs';

function fail(code) { throw new Error(code); }
function absent(file, code) {
  try { lstatSync(file); fail(code); } catch (error) {
    if (error instanceof Error && error.message === code) throw error;
    if (typeof error !== 'object' || error === null || error.code !== 'ENOENT') fail('BUILD_OUTPUT_PREFLIGHT_FAILED');
  }
}
function treeContains(root, label, sha) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && /\.(?:js|json|html)$/.test(entry.name)) {
        const text = readFileSync(full, 'utf8');
        if (text.includes(label) && text.includes(sha)) return true;
      }
    }
  }
  return false;
}
function canonicalModes(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) { chmodSync(full, 0o755); canonicalModes(full); }
    else if (entry.isFile()) chmodSync(full, (lstatSync(full).mode & 0o111) === 0 ? 0o644 : 0o755);
  }
  chmodSync(root, 0o755);
}

let createdPayload = false;
let payload;
let receipt;
let evidenceOutput;
try {
  const args = parseStrictArgs(process.argv.slice(2), ['source-root', 'payload', 'receipt', 'metadata', 'evidence-output']);
  for (const key of ['source-root', 'payload', 'receipt', 'metadata', 'evidence-output']) if (!args[key]) fail('ARGUMENT_REQUIRED');
  const sourceSha = canonicalSourceSha(process.env.FINAL_SOURCE_SHA);
  if (canonicalSourceSha(process.env.NEXUS_RELEASE_SOURCE_SHA, 'NEXUS_RELEASE_SOURCE_SHA_INVALID') !== sourceSha) {
    fail('BUILD_SOURCE_ENV_MISMATCH');
  }
  const sourceRoot = realpathSync(path.resolve(args['source-root']));
  payload = path.resolve(args.payload);
  receipt = path.resolve(args.receipt);
  evidenceOutput = path.resolve(args['evidence-output']);
  absent(payload, 'BUILD_PAYLOAD_ALREADY_EXISTS');
  absent(receipt, 'BUILD_RECEIPT_ALREADY_EXISTS');
  absent(evidenceOutput, 'BUILD_EVIDENCE_ALREADY_EXISTS');
  const metadata = validateBuildMetadata(readJson(args.metadata, 'BUILD_METADATA_JSON_INVALID'));
  assertSourceState(sourceRoot, sourceSha);
  execFileSync('npm', ['run', 'build'], {
    cwd: sourceRoot,
    env: { ...process.env, NEXUS_RELEASE_SOURCE_SHA: sourceSha },
    stdio: 'inherit',
    timeout: 30 * 60_000,
  });
  assertSourceState(sourceRoot, sourceSha);
  const buildId = canonicalBuildId(readFileSync(path.join(sourceRoot, '.next', 'BUILD_ID'), 'utf8').trim());
  const standaloneRoot = path.join(sourceRoot, '.next', 'standalone');
  if (readFileSync(path.join(standaloneRoot, '.next', 'BUILD_ID'), 'utf8').trim() !== buildId) fail('BUILD_ID_MISMATCH');
  if (!treeContains(standaloneRoot, 'SERVER_RELEASE_SHA', sourceSha)) fail('SERVER_BUILD_FINGERPRINT_MISSING');
  if (!treeContains(path.join(standaloneRoot, '.next', 'static'), 'CLIENT_RELEASE_SHA', sourceSha)) {
    fail('CLIENT_BUILD_FINGERPRINT_MISSING');
  }
  mkdirSync(path.dirname(payload), { recursive: true, mode: 0o700 });
  cpSync(standaloneRoot, payload, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
    errorOnExist: true,
  });
  createdPayload = true;
  canonicalModes(payload);
  const standaloneDigest = computePayloadInventory(standaloneRoot, { exclude: [], normalizeModes: true }).digest;
  const provenancePath = path.join(payload, BUILD_PROVENANCE_NAME);
  writeFileSync(provenancePath, `${canonicalJson({
    schemaVersion: BUILD_PROVENANCE_SCHEMA,
    finalSourceSha: sourceSha,
    finalBuildId: buildId,
    buildCount: 1,
    standaloneDigest,
  })}\n`, { flag: 'wx', mode: 0o644 });
  const evidence = {
    schemaVersion: BUILD_INPUT_SCHEMA,
    finalSourceSha: sourceSha,
    finalBuildId: buildId,
    build: { count: 1, command: 'npm run build', nexusReleaseSourceSha: sourceSha, status: 'PASS' },
    versions: metadata.versions,
    migrations: metadata.migrations,
  };
  mkdirSync(path.dirname(evidenceOutput), { recursive: true, mode: 0o700 });
  writeFileSync(evidenceOutput, `${canonicalJson(evidence)}\n`, { flag: 'wx', mode: 0o600 });
  const receiptValue = {
    schemaVersion: BUILD_RECEIPT_SCHEMA,
    finalSourceSha: sourceSha,
    finalBuildId: buildId,
    buildCount: 1,
    sourceIdentity: BUILD_SOURCE_IDENTITY,
    standaloneIdentity: BUILD_STANDALONE_IDENTITY,
    payloadIdentity: BUILD_PAYLOAD_IDENTITY,
    standaloneDigest,
    payloadDigest: computePayloadInventory(payload).digest,
    provenanceSha256: sha256File(provenancePath),
    buildEvidenceSha256: sha256File(evidenceOutput),
  };
  writeFileSync(receipt, `${canonicalJson(receiptValue)}\n`, { flag: 'wx', mode: 0o600 });
  validateBuildOriginBinding(sourceRoot, payload, receipt, sourceSha, buildId, evidenceOutput);
  assertSourceState(sourceRoot, sourceSha);
  console.log('QUALIFIED_BUILD_CREATED');
} catch (error) {
  if (createdPayload && payload) rmSync(payload, { recursive: true, force: true });
  if (receipt) rmSync(receipt, { force: true });
  if (evidenceOutput) rmSync(evidenceOutput, { force: true });
  console.error(`QUALIFIED_BUILD_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  process.exit(1);
}
