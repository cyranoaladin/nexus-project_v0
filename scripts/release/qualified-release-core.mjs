import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const QUALIFICATION_MANIFEST_NAME = 'release-qualification-manifest.json';
export const BUILD_PROVENANCE_NAME = 'release-build-provenance.json';
export const BUILD_METADATA_SCHEMA = 'nexus-release-build-metadata/v1';
export const BUILD_PROVENANCE_SCHEMA = 'nexus-release-build-provenance/v1';
export const BUILD_RECEIPT_SCHEMA = 'nexus-release-build-receipt/v1';
export const BUILD_INPUT_SCHEMA = 'nexus-release-build-input/v1';
export const QUALIFICATION_INPUT_SCHEMA = 'nexus-release-qualification-input/v1';
export const QUALIFICATION_MANIFEST_SCHEMA = 'nexus-qualified-release-manifest/v1';
export const QUALIFICATION_ATTESTATION_SCHEMA = 'nexus-release-qualification-attestation/v1';
export const GOVERNANCE_SCHEMA = 'nexus-release-governance/v1';
export const REQUIRED_MIGRATION_COUNT = 88;
export const REQUIRED_CI_CONTEXTS = Object.freeze([
  'CI Success',
  'Hermetic DB Order Matrix',
]);

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const BUILD_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]{1,500}$/;
const SAFE_RELEASE_PATH = /^\/var\/www\/nexus-releases\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_MEMBER_BYTES = 1024 * 1024 * 1024;
const MAX_ARCHIVE_UNPACKED_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_MEMBERS = 50_000;
const MAX_PAX_BYTES = 1024 * 1024;
const REQUIRED_GATES = [
  'productionBuild',
  'artifactAudit',
  'forbiddenArtifactScan',
  'dbOneFresh',
  'candidateBundledChromium',
  'candidateGoogleChrome152',
];

function fail(code) {
  throw new Error(code);
}

function object(value, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}

function exactKeys(value, expected, code) {
  const actual = Object.keys(object(value, code)).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
}

function safeText(value, code) {
  if (typeof value !== 'string' || !SAFE_TEXT.test(value)) fail(code);
  return value;
}

export function parseStrictArgs(tokens, allowedKeys) {
  if (tokens.length % 2 !== 0) fail('ARGUMENT_INVALID');
  const allowed = new Set(allowedKeys);
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const token = tokens[index];
    if (typeof token !== 'string' || !token.startsWith('--') || token === '--') fail('ARGUMENT_INVALID');
    const key = token.slice(2);
    if (!allowed.has(key) || values[key] !== undefined || tokens[index + 1] === undefined) fail('ARGUMENT_INVALID');
    values[key] = tokens[index + 1];
  }
  return values;
}

export function canonicalSourceSha(value, code = 'FINAL_SOURCE_SHA_INVALID') {
  if (typeof value !== 'string' || !SHA40.test(value)) fail(code);
  return value;
}

export function canonicalBuildId(value, code = 'FINAL_BUILD_ID_INVALID') {
  if (typeof value !== 'string' || !BUILD_ID.test(value)) fail(code);
  return value;
}

function canonicalOldRelease(value) {
  if (typeof value !== 'string' || !SAFE_RELEASE_PATH.test(value)) fail('OLD_RELEASE_INVALID');
  const releaseName = path.posix.basename(value);
  if (releaseName === 'current' || releaseName === '.' || releaseName === '..' || path.posix.normalize(value) !== value) {
    fail('OLD_RELEASE_INVALID');
  }
  return value;
}

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(file) {
  return sha256Bytes(readFileSync(file));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeRelative(relativePath) {
  return relativePath.split(path.sep).join('/');
}

export function computePayloadInventory(root, { exclude = [QUALIFICATION_MANIFEST_NAME] } = {}) {
  const absoluteRoot = path.resolve(root);
  const excluded = new Set(exclude);
  const entries = [];

  function visit(directory, relativeDirectory = '') {
    for (const name of readdirSync(directory).sort(stableCompare)) {
      const absolute = path.join(directory, name);
      const relative = normalizeRelative(path.join(relativeDirectory, name));
      if (excluded.has(relative)) continue;
      const metadata = lstatSync(absolute);
      const mode = metadata.mode & 0o777;
      if (metadata.isSymbolicLink()) {
        const target = readlinkSync(absolute);
        if (path.isAbsolute(target)) fail('PAYLOAD_SYMLINK_ABSOLUTE');
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), target));
        if (resolved === '..' || resolved.startsWith('../')) fail('PAYLOAD_SYMLINK_ESCAPE');
        entries.push({ path: relative, type: 'symlink', mode, target });
      } else if (metadata.isDirectory()) {
        entries.push({ path: relative, type: 'directory', mode });
        visit(absolute, relative);
      } else if (metadata.isFile()) {
        entries.push({
          path: relative,
          type: 'file',
          mode,
          size: metadata.size,
          sha256: sha256File(absolute),
        });
      } else {
        fail('PAYLOAD_ENTRY_TYPE_UNSUPPORTED');
      }
    }
  }

  visit(absoluteRoot);
  entries.sort((left, right) => stableCompare(left.path, right.path));
  return Object.freeze({
    algorithm: 'sha256',
    digest: sha256Bytes(canonicalJson(entries)),
    entryCount: entries.length,
    entries,
  });
}

export function readJson(file, code = 'JSON_INVALID') {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    fail(code);
  }
}

export function assertSourceState(sourceRoot, expectedSha) {
  canonicalSourceSha(expectedSha);
  let head;
  let status;
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
    status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], {
      cwd: sourceRoot,
      encoding: 'utf8',
    });
  } catch {
    fail('SOURCE_GIT_STATE_UNAVAILABLE');
  }
  if (head !== expectedSha) fail('SOURCE_HEAD_MISMATCH');
  if (status !== '') fail('SOURCE_WORKTREE_DIRTY');
  return Object.freeze({ headSha: head, clean: true });
}

export function assertEmbeddedQualificationManifest(payloadRoot, manifestPath) {
  const payload = path.resolve(payloadRoot);
  const expectedManifest = path.join(payload, QUALIFICATION_MANIFEST_NAME);
  if (path.resolve(manifestPath) !== expectedManifest) fail('QUALIFICATION_MANIFEST_NOT_EMBEDDED');
  let metadata;
  let realPayload;
  let realManifest;
  try {
    metadata = lstatSync(expectedManifest);
    realPayload = realpathSync(payload);
    realManifest = realpathSync(expectedManifest);
  } catch {
    fail('QUALIFICATION_MANIFEST_MISSING');
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail('QUALIFICATION_MANIFEST_NOT_REGULAR');
  if (realManifest !== path.join(realPayload, QUALIFICATION_MANIFEST_NAME)) fail('QUALIFICATION_MANIFEST_NOT_EMBEDDED');
  return expectedManifest;
}

function regularFileAtExactPath(root, name, missingCode, invalidCode) {
  const expected = path.join(path.resolve(root), name);
  let metadata;
  try { metadata = lstatSync(expected); } catch { fail(missingCode); }
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail(invalidCode);
  return expected;
}

export function validateBuildMetadata(value) {
  const metadata = object(value, 'BUILD_METADATA_INVALID');
  exactKeys(metadata, ['schemaVersion', 'versions', 'migrations'], 'BUILD_METADATA_KEYS_INVALID');
  if (metadata.schemaVersion !== BUILD_METADATA_SCHEMA) fail('BUILD_METADATA_SCHEMA_INVALID');
  const sampleSha = 'a'.repeat(40);
  const sampleBuildId = 'build-metadata-validation';
  validateBuildEvidence({
    schemaVersion: BUILD_INPUT_SCHEMA,
    finalSourceSha: sampleSha,
    finalBuildId: sampleBuildId,
    build: { count: 1, command: 'npm run build', nexusReleaseSourceSha: sampleSha, status: 'PASS' },
    versions: metadata.versions,
    migrations: metadata.migrations,
  }, sampleSha);
  return metadata;
}

export function validateBuildBinding(sourceRoot, payloadRoot, receiptPath, expectedSha, expectedBuildId, evidencePath = null) {
  const source = realpathSync(path.resolve(sourceRoot));
  const standalone = realpathSync(path.join(source, '.next', 'standalone'));
  const payload = realpathSync(path.resolve(payloadRoot));
  const receiptFile = path.resolve(receiptPath);
  let receiptMetadata;
  try { receiptMetadata = lstatSync(receiptFile); } catch { fail('BUILD_RECEIPT_MISSING'); }
  if (!receiptMetadata.isFile() || receiptMetadata.isSymbolicLink()) fail('BUILD_RECEIPT_INVALID');
  const receipt = readJson(receiptFile, 'BUILD_RECEIPT_JSON_INVALID');
  exactKeys(receipt, [
    'schemaVersion', 'finalSourceSha', 'finalBuildId', 'buildCount', 'sourceRoot', 'standaloneRoot',
    'payloadRoot', 'standaloneDigest', 'payloadDigest', 'provenanceSha256', 'buildEvidenceSha256',
  ], 'BUILD_RECEIPT_KEYS_INVALID');
  if (receipt.schemaVersion !== BUILD_RECEIPT_SCHEMA) fail('BUILD_RECEIPT_SCHEMA_INVALID');
  if (canonicalSourceSha(receipt.finalSourceSha) !== expectedSha) fail('BUILD_RECEIPT_SOURCE_SHA_MISMATCH');
  if (canonicalBuildId(receipt.finalBuildId) !== expectedBuildId || receipt.buildCount !== 1) fail('BUILD_RECEIPT_BUILD_INVALID');
  if (receipt.sourceRoot !== source || receipt.standaloneRoot !== standalone || receipt.payloadRoot !== payload) {
    fail('BUILD_RECEIPT_REALPATH_MISMATCH');
  }
  for (const digest of ['standaloneDigest', 'payloadDigest', 'provenanceSha256', 'buildEvidenceSha256']) {
    if (!SHA256.test(receipt[digest])) fail('BUILD_RECEIPT_DIGEST_INVALID');
  }
  const provenancePath = regularFileAtExactPath(payload, BUILD_PROVENANCE_NAME, 'BUILD_PROVENANCE_MISSING', 'BUILD_PROVENANCE_INVALID');
  const provenance = readJson(provenancePath, 'BUILD_PROVENANCE_JSON_INVALID');
  exactKeys(provenance, [
    'schemaVersion', 'finalSourceSha', 'finalBuildId', 'buildCount', 'standaloneDigest',
  ], 'BUILD_PROVENANCE_KEYS_INVALID');
  if (
    provenance.schemaVersion !== BUILD_PROVENANCE_SCHEMA
    || canonicalSourceSha(provenance.finalSourceSha) !== expectedSha
    || canonicalBuildId(provenance.finalBuildId) !== expectedBuildId
    || provenance.buildCount !== 1
    || provenance.standaloneDigest !== receipt.standaloneDigest
  ) fail('BUILD_PROVENANCE_MISMATCH');
  if (sha256File(provenancePath) !== receipt.provenanceSha256) fail('BUILD_PROVENANCE_DIGEST_MISMATCH');
  if (computePayloadInventory(standalone, { exclude: [] }).digest !== receipt.standaloneDigest) fail('BUILD_STANDALONE_TREE_MISMATCH');
  if (computePayloadInventory(payload).digest !== receipt.payloadDigest) fail('BUILD_PAYLOAD_TREE_MISMATCH');
  if (evidencePath !== null && sha256File(evidencePath) !== receipt.buildEvidenceSha256) fail('BUILD_EVIDENCE_DIGEST_MISMATCH');
  const embeddedBuildId = readFileSync(path.join(payload, '.next', 'BUILD_ID'), 'utf8').trim();
  if (embeddedBuildId !== expectedBuildId) fail('BUILD_PAYLOAD_ID_MISMATCH');
  return Object.freeze({ receipt, receiptSha256: sha256File(receiptFile), provenanceSha256: receipt.provenanceSha256 });
}

export function validateQualificationEvidence(value, expectedSha) {
  const evidence = object(value, 'QUALIFICATION_INPUT_INVALID');
  exactKeys(evidence, [
    'schemaVersion', 'finalSourceSha', 'finalBuildId', 'build', 'versions',
    'migrations', 'commands', 'requiredGates', 'OLD_RELEASE', 'PIPELINE_STATE',
    'ACTIVE_PUBLIC', 'P1_A', 'ROLLBACK_READY',
  ], 'QUALIFICATION_INPUT_KEYS_INVALID');
  if (evidence.schemaVersion !== QUALIFICATION_INPUT_SCHEMA) fail('QUALIFICATION_INPUT_SCHEMA_INVALID');
  const sourceSha = canonicalSourceSha(evidence.finalSourceSha);
  if (sourceSha !== expectedSha) fail('QUALIFICATION_SOURCE_SHA_MISMATCH');
  const buildId = canonicalBuildId(evidence.finalBuildId);
  canonicalOldRelease(evidence.OLD_RELEASE);
  if (evidence.PIPELINE_STATE !== 'ACTIVE_INTERNAL') fail('PIPELINE_STATE_INVALID');
  if (evidence.ACTIVE_PUBLIC !== 'NO') fail('ACTIVE_PUBLIC_INVALID');
  if (!['PROVEN_AND_FIXED', 'CLIENT_ENVIRONMENT_PROVEN'].includes(evidence.P1_A)) fail('P1_A_INVALID');
  if (evidence.ROLLBACK_READY !== 'YES') fail('ROLLBACK_READY_INVALID');

  exactKeys(evidence.build, ['count', 'command', 'nexusReleaseSourceSha', 'status'], 'BUILD_EVIDENCE_KEYS_INVALID');
  if (evidence.build.count !== 1 || evidence.build.status !== 'PASS') fail('BUILD_COUNT_OR_STATUS_INVALID');
  if (safeText(evidence.build.command, 'BUILD_COMMAND_INVALID') !== 'npm run build') fail('BUILD_COMMAND_INVALID');
  if (canonicalSourceSha(evidence.build.nexusReleaseSourceSha) !== sourceSha) fail('BUILD_SOURCE_SHA_MISMATCH');

  exactKeys(evidence.versions, ['node', 'npm', 'next', 'prisma', 'postgres', 'browsers'], 'VERSION_EVIDENCE_KEYS_INVALID');
  for (const key of ['node', 'npm', 'next', 'prisma', 'postgres']) safeText(evidence.versions[key], 'VERSION_EVIDENCE_INVALID');
  exactKeys(evidence.versions.browsers, ['bundledChromium', 'googleChrome'], 'BROWSER_VERSION_KEYS_INVALID');
  safeText(evidence.versions.browsers.bundledChromium, 'BROWSER_VERSION_INVALID');
  safeText(evidence.versions.browsers.googleChrome, 'BROWSER_VERSION_INVALID');

  exactKeys(evidence.migrations, ['before', 'applied', 'after'], 'MIGRATION_EVIDENCE_KEYS_INVALID');
  if (
    evidence.migrations.before !== REQUIRED_MIGRATION_COUNT
    || evidence.migrations.applied !== 0
    || evidence.migrations.after !== REQUIRED_MIGRATION_COUNT
  ) fail('MIGRATION_COUNT_INVALID');

  if (!Array.isArray(evidence.commands) || evidence.commands.length === 0) fail('COMMAND_EVIDENCE_MISSING');
  const names = new Set();
  for (const command of evidence.commands) {
    exactKeys(command, ['name', 'command', 'status', 'counts'], 'COMMAND_EVIDENCE_KEYS_INVALID');
    const name = safeText(command.name, 'COMMAND_NAME_INVALID');
    if (names.has(name)) fail('COMMAND_NAME_DUPLICATE');
    names.add(name);
    safeText(command.command, 'COMMAND_TEXT_INVALID');
    if (command.status !== 'PASS') fail('COMMAND_STATUS_INVALID');
    exactKeys(command.counts, ['passed', 'failed', 'total'], 'COMMAND_COUNTS_KEYS_INVALID');
    const { passed, failed, total } = command.counts;
    if (![passed, failed, total].every(Number.isSafeInteger) || passed < 0 || failed !== 0 || total <= 0 || passed + failed !== total) {
      fail('COMMAND_COUNTS_INVALID');
    }
  }

  exactKeys(evidence.requiredGates, REQUIRED_GATES, 'REQUIRED_GATES_INVALID');
  for (const gate of REQUIRED_GATES) if (evidence.requiredGates[gate] !== 'PASS') fail('REQUIRED_GATE_NOT_PASS');
  return Object.freeze({ ...evidence, finalSourceSha: sourceSha, finalBuildId: buildId });
}

export function validateBuildEvidence(value, expectedSha) {
  const evidence = object(value, 'BUILD_INPUT_INVALID');
  exactKeys(evidence, [
    'schemaVersion', 'finalSourceSha', 'finalBuildId', 'build', 'versions', 'migrations',
  ], 'BUILD_INPUT_KEYS_INVALID');
  if (evidence.schemaVersion !== BUILD_INPUT_SCHEMA) fail('BUILD_INPUT_SCHEMA_INVALID');
  const gates = Object.fromEntries(REQUIRED_GATES.map((gate) => [gate, 'PASS']));
  const validated = validateQualificationEvidence({
    ...evidence,
    schemaVersion: QUALIFICATION_INPUT_SCHEMA,
    commands: [{
      name: 'build-input-validation',
      command: 'npm run build',
      status: 'PASS',
      counts: { passed: 1, failed: 0, total: 1 },
    }],
    requiredGates: gates,
    OLD_RELEASE: '/var/www/nexus-releases/build-input-validation',
    PIPELINE_STATE: 'ACTIVE_INTERNAL',
    ACTIVE_PUBLIC: 'NO',
    P1_A: 'CLIENT_ENVIRONMENT_PROVEN',
    ROLLBACK_READY: 'YES',
  }, expectedSha);
  return Object.freeze({
    schemaVersion: BUILD_INPUT_SCHEMA,
    finalSourceSha: validated.finalSourceSha,
    finalBuildId: validated.finalBuildId,
    build: validated.build,
    versions: validated.versions,
    migrations: validated.migrations,
  });
}

export function validateGovernanceEvidence(value, expectedSha) {
  const governance = object(value, 'GOVERNANCE_INVALID');
  exactKeys(governance, [
    'schemaVersion', 'sourceSha', 'remote', 'branch', 'remoteBranchSha', 'tag', 'tagTargetSha',
    'annotated', 'branchProtection', 'tagRuleset', 'remoteStateVerified', 'ci',
  ], 'GOVERNANCE_KEYS_INVALID');
  if (governance.schemaVersion !== GOVERNANCE_SCHEMA) fail('GOVERNANCE_SCHEMA_INVALID');
  if (canonicalSourceSha(governance.sourceSha) !== expectedSha) fail('GOVERNANCE_SOURCE_SHA_MISMATCH');
  if (canonicalSourceSha(governance.remoteBranchSha) !== expectedSha) fail('REMOTE_BRANCH_SHA_MISMATCH');
  if (canonicalSourceSha(governance.tagTargetSha) !== expectedSha) fail('REMOTE_TAG_SHA_MISMATCH');
  if (governance.branch !== 'release/candidat-individuel-prod') fail('RELEASE_BRANCH_INVALID');
  if (governance.tag !== `candidat-individuel-v1-${expectedSha.slice(0, 12)}`) fail('RELEASE_TAG_INVALID');
  if (governance.annotated !== true) fail('RELEASE_TAG_NOT_ANNOTATED');
  if (governance.remoteStateVerified !== true) fail('REMOTE_STATE_UNVERIFIED');
  exactKeys(governance.remote, ['name', 'url', 'repository'], 'REMOTE_EVIDENCE_KEYS_INVALID');
  safeText(governance.remote.name, 'REMOTE_EVIDENCE_INVALID');
  safeText(governance.remote.url, 'REMOTE_EVIDENCE_INVALID');
  safeText(governance.remote.repository, 'REMOTE_EVIDENCE_INVALID');
  exactKeys(governance.branchProtection, ['enforceAdmins', 'allowForcePushes', 'allowDeletions'], 'BRANCH_PROTECTION_KEYS_INVALID');
  if (
    governance.branchProtection.enforceAdmins !== true
    || governance.branchProtection.allowForcePushes !== false
    || governance.branchProtection.allowDeletions !== false
  ) fail('BRANCH_PROTECTION_UNVERIFIED');
  exactKeys(governance.tagRuleset, [
    'id', 'name', 'enforcement', 'pattern', 'bypassActors', 'deletionProtected', 'nonFastForwardProtected',
  ], 'TAG_RULESET_KEYS_INVALID');
  if (
    !Number.isSafeInteger(governance.tagRuleset.id) || governance.tagRuleset.id <= 0
    || typeof governance.tagRuleset.name !== 'string' || governance.tagRuleset.name.length === 0
    || governance.tagRuleset.enforcement !== 'active'
    || governance.tagRuleset.pattern !== 'refs/tags/candidat-individuel-v1-*'
    || governance.tagRuleset.bypassActors !== 0
    || governance.tagRuleset.deletionProtected !== true
    || governance.tagRuleset.nonFastForwardProtected !== true
  ) fail('TAG_RULESET_UNVERIFIED');
  safeText(governance.tagRuleset.name, 'TAG_RULESET_INVALID');
  exactKeys(governance.ci, ['kind', 'workflow', 'runId', 'contexts'], 'CI_EVIDENCE_KEYS_INVALID');
  if (governance.ci.kind !== 'REMOTE_STATUS_CHECK') fail('CI_EVIDENCE_KIND_INVALID');
  if (governance.ci.workflow !== '.github/workflows/ci.yml' || !Number.isSafeInteger(governance.ci.runId) || governance.ci.runId <= 0) {
    fail('CI_WORKFLOW_EVIDENCE_INVALID');
  }
  if (!Array.isArray(governance.ci.contexts) || governance.ci.contexts.length !== REQUIRED_CI_CONTEXTS.length) {
    fail('CI_EVIDENCE_CONTEXTS_INVALID');
  }
  const contextsByName = new Map();
  for (const context of governance.ci.contexts) {
    exactKeys(context, ['name', 'status', 'sourceSha', 'checkRunId', 'detailsUrl', 'app'], 'CI_CONTEXT_KEYS_INVALID');
    const name = safeText(context.name, 'CI_EVIDENCE_NAME_INVALID');
    if (contextsByName.has(name)) fail('CI_EVIDENCE_CONTEXTS_INVALID');
    contextsByName.set(name, context);
    if (!Number.isSafeInteger(context.checkRunId) || context.checkRunId <= 0) fail('CI_EVIDENCE_NOT_PASS');
    exactKeys(context.app, ['slug', 'owner'], 'CI_APP_EVIDENCE_KEYS_INVALID');
    if (context.app.slug !== 'github-actions' || context.app.owner !== 'github') fail('CI_APP_UNTRUSTED');
    let details;
    try { details = new URL(context.detailsUrl); } catch { fail('CI_DETAILS_URL_INVALID'); }
    const expectedPrefix = `/${governance.remote.repository}/actions/runs/${governance.ci.runId}/job/`;
    if (
      details.protocol !== 'https:'
      || details.hostname !== 'github.com'
      || details.username !== ''
      || details.password !== ''
      || details.search !== ''
      || details.hash !== ''
      || !details.pathname.startsWith(expectedPrefix)
      || !/^[1-9][0-9]*$/.test(details.pathname.slice(expectedPrefix.length))
    ) fail('CI_DETAILS_URL_INVALID');
  }
  for (const name of REQUIRED_CI_CONTEXTS) {
    const context = contextsByName.get(name);
    if (!context || context.status !== 'PASS' || canonicalSourceSha(context.sourceSha) !== expectedSha) {
      fail('CI_EVIDENCE_NOT_PASS');
    }
  }
  return governance;
}

export function createQualificationManifest(evidence, inventory, buildBinding) {
  return {
    schemaVersion: QUALIFICATION_MANIFEST_SCHEMA,
    finalSourceSha: evidence.finalSourceSha,
    finalBuildId: evidence.finalBuildId,
    payload: inventory,
    build: evidence.build,
    versions: evidence.versions,
    migrations: evidence.migrations,
    buildReceiptSha256: buildBinding.receiptSha256,
    buildProvenanceSha256: buildBinding.provenanceSha256,
  };
}

export function validateManifest(value, expectedSha, expectedBuildId) {
  const manifest = object(value, 'QUALIFICATION_MANIFEST_INVALID');
  exactKeys(manifest, [
    'schemaVersion', 'finalSourceSha', 'finalBuildId', 'payload', 'build', 'versions', 'migrations',
    'buildReceiptSha256', 'buildProvenanceSha256',
  ], 'QUALIFICATION_MANIFEST_KEYS_INVALID');
  if (manifest.schemaVersion !== QUALIFICATION_MANIFEST_SCHEMA) fail('QUALIFICATION_MANIFEST_SCHEMA_INVALID');
  if (!SHA256.test(manifest.buildReceiptSha256) || !SHA256.test(manifest.buildProvenanceSha256)) fail('BUILD_BINDING_DIGEST_INVALID');
  const evidence = validateBuildEvidence({
    schemaVersion: BUILD_INPUT_SCHEMA,
    finalSourceSha: manifest.finalSourceSha,
    finalBuildId: manifest.finalBuildId,
    build: manifest.build,
    versions: manifest.versions,
    migrations: manifest.migrations,
  }, expectedSha);
  if (evidence.finalBuildId !== expectedBuildId) fail('MANIFEST_BUILD_ID_MISMATCH');
  exactKeys(manifest.payload, ['algorithm', 'digest', 'entryCount', 'entries'], 'PAYLOAD_INVENTORY_KEYS_INVALID');
  if (manifest.payload.algorithm !== 'sha256' || !SHA256.test(manifest.payload.digest)) fail('PAYLOAD_DIGEST_INVALID');
  if (!Number.isSafeInteger(manifest.payload.entryCount) || manifest.payload.entryCount < 1) fail('PAYLOAD_ENTRY_COUNT_INVALID');
  if (!Array.isArray(manifest.payload.entries) || manifest.payload.entries.length !== manifest.payload.entryCount) fail('PAYLOAD_ENTRIES_INVALID');
  if (sha256Bytes(canonicalJson(manifest.payload.entries)) !== manifest.payload.digest) fail('PAYLOAD_INVENTORY_DIGEST_MISMATCH');
  return manifest;
}

export function verifyPayloadAgainstManifest(payloadRoot, manifest, expectedSha, expectedBuildId) {
  validateManifest(manifest, expectedSha, expectedBuildId);
  const current = computePayloadInventory(payloadRoot);
  if (canonicalJson(current) !== canonicalJson(manifest.payload)) fail('PAYLOAD_TREE_MISMATCH');
  const embeddedBuildId = readFileSync(path.join(payloadRoot, '.next', 'BUILD_ID'), 'utf8').trim();
  if (embeddedBuildId !== expectedBuildId) fail('PAYLOAD_BUILD_ID_MISMATCH');
  return current;
}

function parseTarNumber(buffer, code) {
  if ((buffer[0] & 0x80) !== 0) fail(code);
  const text = buffer.toString('ascii').replace(/\0.*$/, '').trim();
  if (text === '') return 0;
  if (!/^[0-7]+$/.test(text)) fail(code);
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

function tarText(buffer, code) {
  const value = buffer.toString('utf8').replace(/\0.*$/, '');
  if (value.includes('\ufffd') || /[\u0000-\u001f\u007f]/.test(value)) fail(code);
  return value;
}

function safeArchivePath(value) {
  const stripped = value.replace(/^\.\//, '').replace(/\/$/, '');
  if (stripped === '' || stripped === '.') return '.';
  if (path.posix.isAbsolute(value) || value.includes('\\')) fail('ARTIFACT_ARCHIVE_PATH_INVALID');
  const normalized = path.posix.normalize(stripped);
  if (normalized === '..' || normalized.startsWith('../') || normalized !== stripped) fail('ARTIFACT_ARCHIVE_PATH_INVALID');
  return normalized;
}

function safeArchiveLink(memberPath, target, hardLink) {
  if (target === '' || path.posix.isAbsolute(target) || target.includes('\\')) fail('ARTIFACT_ARCHIVE_LINK_TARGET_INVALID');
  const resolved = path.posix.normalize(hardLink ? target : path.posix.join(path.posix.dirname(memberPath), target));
  if (resolved === '..' || resolved.startsWith('../')) fail('ARTIFACT_ARCHIVE_LINK_TARGET_INVALID');
}

function parsePax(buffer) {
  const values = {};
  let offset = 0;
  while (offset < buffer.length) {
    const space = buffer.indexOf(0x20, offset);
    if (space < 0) fail('ARTIFACT_ARCHIVE_PAX_INVALID');
    const lengthText = buffer.subarray(offset, space).toString('ascii');
    if (!/^[1-9][0-9]*$/.test(lengthText)) fail('ARTIFACT_ARCHIVE_PAX_INVALID');
    const length = Number(lengthText);
    if (!Number.isSafeInteger(length) || length <= 0 || offset + length > buffer.length) fail('ARTIFACT_ARCHIVE_PAX_INVALID');
    const record = buffer.subarray(space + 1, offset + length);
    if (record.at(-1) !== 0x0a) fail('ARTIFACT_ARCHIVE_PAX_INVALID');
    const equals = record.indexOf(0x3d);
    if (equals <= 0) fail('ARTIFACT_ARCHIVE_PAX_INVALID');
    const key = record.subarray(0, equals).toString('ascii');
    const value = record.subarray(equals + 1, -1).toString('utf8');
    if (!['path', 'linkpath', 'size', 'mtime'].includes(key) || value.includes('\ufffd')) fail('ARTIFACT_ARCHIVE_PAX_INVALID');
    values[key] = value;
    offset += length;
  }
  return values;
}

function inspectTarHeaders(file, fileSize) {
  const fd = openSync(file, constants.O_RDONLY);
  const header = Buffer.alloc(512);
  const names = new Set();
  let offset = 0;
  let zeroBlocks = 0;
  let memberCount = 0;
  let unpackedBytes = 0;
  let pax = null;
  let previousPath = null;
  try {
    while (offset + 512 <= fileSize) {
      if (readSync(fd, header, 0, 512, offset) !== 512) fail('ARTIFACT_ARCHIVE_INVALID');
      offset += 512;
      if (header.every((byte) => byte === 0)) {
        zeroBlocks += 1;
        if (zeroBlocks === 2) return Object.freeze({ memberCount, unpackedBytes });
        continue;
      }
      zeroBlocks = 0;
      const storedChecksum = parseTarNumber(header.subarray(148, 156), 'ARTIFACT_ARCHIVE_HEADER_INVALID');
      let checksum = 0;
      for (let index = 0; index < 512; index += 1) checksum += index >= 148 && index < 156 ? 0x20 : header[index];
      if (checksum !== storedChecksum) fail('ARTIFACT_ARCHIVE_HEADER_INVALID');
      const headerSize = parseTarNumber(header.subarray(124, 136), 'ARTIFACT_ARCHIVE_HEADER_INVALID');
      const mode = parseTarNumber(header.subarray(100, 108), 'ARTIFACT_ARCHIVE_HEADER_INVALID');
      const uid = parseTarNumber(header.subarray(108, 116), 'ARTIFACT_ARCHIVE_HEADER_INVALID');
      const gid = parseTarNumber(header.subarray(116, 124), 'ARTIFACT_ARCHIVE_HEADER_INVALID');
      const mtime = parseTarNumber(header.subarray(136, 148), 'ARTIFACT_ARCHIVE_HEADER_INVALID');
      const type = String.fromCharCode(header[156] || 0x30);
      const namePart = tarText(header.subarray(0, 100), 'ARTIFACT_ARCHIVE_PATH_INVALID');
      const prefix = tarText(header.subarray(345, 500), 'ARTIFACT_ARCHIVE_PATH_INVALID');
      const headerName = prefix ? `${prefix}/${namePart}` : namePart;
      if (type === 'x') {
        if (headerSize > MAX_PAX_BYTES || offset + headerSize > fileSize) fail('ARTIFACT_ARCHIVE_PAX_INVALID');
        const data = Buffer.alloc(headerSize);
        if (readSync(fd, data, 0, headerSize, offset) !== headerSize) fail('ARTIFACT_ARCHIVE_PAX_INVALID');
        pax = parsePax(data);
        offset += Math.ceil(headerSize / 512) * 512;
        continue;
      }
      if (!['0', '5', '2', '1'].includes(type)) fail('ARTIFACT_ARCHIVE_ENTRY_TYPE_INVALID');
      const declaredSize = pax?.size === undefined ? headerSize : Number(pax.size);
      if (!Number.isSafeInteger(declaredSize) || declaredSize !== headerSize) fail('ARTIFACT_ARCHIVE_HEADER_INVALID');
      if (pax?.mtime !== undefined && Number(pax.mtime) !== 0) fail('ARTIFACT_ARCHIVE_METADATA_INVALID');
      if (declaredSize > MAX_ARCHIVE_MEMBER_BYTES) fail('ARTIFACT_ARCHIVE_SIZE_LIMIT');
      memberCount += 1;
      unpackedBytes += declaredSize;
      if (memberCount > MAX_ARCHIVE_MEMBERS) fail('ARTIFACT_ARCHIVE_MEMBER_LIMIT');
      if (unpackedBytes > MAX_ARCHIVE_UNPACKED_BYTES) fail('ARTIFACT_ARCHIVE_SIZE_LIMIT');
      const memberPath = safeArchivePath(pax?.path ?? headerName);
      if (previousPath !== null && memberPath < previousPath) fail('ARTIFACT_ARCHIVE_ORDER_INVALID');
      previousPath = memberPath;
      if (memberPath !== '.') {
        if (names.has(memberPath)) fail('ARTIFACT_ARCHIVE_DUPLICATE_PATH');
        names.add(memberPath);
      }
      if (type === '2' || type === '1') {
        const target = pax?.linkpath ?? tarText(header.subarray(157, 257), 'ARTIFACT_ARCHIVE_LINK_TARGET_INVALID');
        safeArchiveLink(memberPath, target, type === '1');
      }
      if (uid !== 0 || gid !== 0 || mtime !== 0) fail('ARTIFACT_ARCHIVE_METADATA_INVALID');
      if (
        (type === '5' && mode !== 0o755)
        || (type === '2' && ![0o755, 0o777].includes(mode))
        || ((type === '0' || type === '1') && ![0o644, 0o755].includes(mode))
      ) fail('ARTIFACT_ARCHIVE_METADATA_INVALID');
      pax = null;
      if (offset + declaredSize > fileSize) fail('ARTIFACT_ARCHIVE_INVALID');
      offset += Math.ceil(declaredSize / 512) * 512;
    }
    fail('ARTIFACT_ARCHIVE_INVALID');
  } finally {
    closeSync(fd);
  }
}

function privateArchiveCopy(artifact, directory) {
  const destination = path.join(directory, 'artifact.tar');
  let input;
  let output;
  try {
    input = openSync(artifact, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const metadata = fstatSync(input);
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_ARCHIVE_BYTES) fail('ARTIFACT_ARCHIVE_SIZE_LIMIT');
    output = openSync(destination, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    const chunk = Buffer.alloc(1024 * 1024);
    let position = 0;
    while (position < metadata.size) {
      const read = readSync(input, chunk, 0, Math.min(chunk.length, metadata.size - position), position);
      if (read <= 0) fail('ARTIFACT_ARCHIVE_COPY_FAILED');
      let written = 0;
      while (written < read) written += writeSync(output, chunk, written, read - written);
      position += read;
    }
    fchmodSync(output, 0o400);
    return { destination, size: metadata.size };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('ARTIFACT_')) throw error;
    fail('ARTIFACT_ARCHIVE_COPY_FAILED');
  } finally {
    if (input !== undefined) closeSync(input);
    if (output !== undefined) closeSync(output);
  }
}

export function verifyPackagedArtifactMatchesPayload(artifact, payloadRoot) {
  const extractionRoot = mkdtempSync(path.join(os.tmpdir(), 'nexus-qualified-artifact-'));
  try {
    const privateCopy = privateArchiveCopy(artifact, extractionRoot);
    inspectTarHeaders(privateCopy.destination, privateCopy.size);
    const unpacked = path.join(extractionRoot, 'unpacked');
    try {
      execFileSync('mkdir', ['-m', '700', unpacked]);
      execFileSync('tar', ['-xf', privateCopy.destination, '--no-same-owner', '--delay-directory-restore', '-C', unpacked], { timeout: 30_000 });
    } catch {
      fail('ARTIFACT_ARCHIVE_EXTRACTION_FAILED');
    }
    const packaged = computePayloadInventory(unpacked, { exclude: [] });
    const retained = computePayloadInventory(payloadRoot, { exclude: [] });
    if (canonicalJson(packaged) !== canonicalJson(retained)) fail('ARTIFACT_PAYLOAD_MISMATCH');
    return Object.freeze({ sha256: sha256File(privateCopy.destination), size: privateCopy.size });
  } finally {
    rmSync(extractionRoot, { recursive: true, force: true });
  }
}

export function validateAttestation(value, expectedSha, expectedBuildId) {
  const attestation = object(value, 'QUALIFICATION_ATTESTATION_INVALID');
  exactKeys(attestation, [
    'schemaVersion', 'finalSourceSha', 'finalBuildId', 'payloadDigest', 'manifestSha256',
    'artifact', 'source', 'artifactReconstructed', 'build', 'versions', 'migrations', 'commands',
    'requiredGates', 'governance', 'OLD_RELEASE', 'PIPELINE_STATE', 'ACTIVE_PUBLIC', 'P1_A',
    'ROLLBACK_READY', 'buildReceiptSha256', 'buildProvenanceSha256',
  ], 'QUALIFICATION_ATTESTATION_KEYS_INVALID');
  if (attestation.schemaVersion !== QUALIFICATION_ATTESTATION_SCHEMA) fail('QUALIFICATION_ATTESTATION_SCHEMA_INVALID');
  if (canonicalSourceSha(attestation.finalSourceSha) !== expectedSha) fail('ATTESTATION_SOURCE_SHA_MISMATCH');
  if (canonicalBuildId(attestation.finalBuildId) !== expectedBuildId) fail('ATTESTATION_BUILD_ID_MISMATCH');
  if (!SHA256.test(attestation.payloadDigest) || !SHA256.test(attestation.manifestSha256)) fail('ATTESTATION_DIGEST_INVALID');
  if (!SHA256.test(attestation.buildReceiptSha256) || !SHA256.test(attestation.buildProvenanceSha256)) fail('BUILD_BINDING_DIGEST_INVALID');
  exactKeys(attestation.artifact, ['fileName', 'sha256'], 'ARTIFACT_EVIDENCE_KEYS_INVALID');
  safeText(attestation.artifact.fileName, 'ARTIFACT_FILE_NAME_INVALID');
  if (!SHA256.test(attestation.artifact.sha256)) fail('ARTIFACT_DIGEST_INVALID');
  exactKeys(attestation.source, ['headSha', 'clean', 'postGateHeadSha'], 'SOURCE_ATTESTATION_KEYS_INVALID');
  if (
    canonicalSourceSha(attestation.source.headSha) !== expectedSha
    || canonicalSourceSha(attestation.source.postGateHeadSha) !== expectedSha
    || attestation.source.clean !== true
  ) fail('SOURCE_ATTESTATION_INVALID');
  if (attestation.artifactReconstructed !== false) fail('ARTIFACT_RECONSTRUCTED');
  validateQualificationEvidence({
    schemaVersion: QUALIFICATION_INPUT_SCHEMA,
    finalSourceSha: attestation.finalSourceSha,
    finalBuildId: attestation.finalBuildId,
    build: attestation.build,
    versions: attestation.versions,
    migrations: attestation.migrations,
    commands: attestation.commands,
    requiredGates: attestation.requiredGates,
    OLD_RELEASE: attestation.OLD_RELEASE,
    PIPELINE_STATE: attestation.PIPELINE_STATE,
    ACTIVE_PUBLIC: attestation.ACTIVE_PUBLIC,
    P1_A: attestation.P1_A,
    ROLLBACK_READY: attestation.ROLLBACK_READY,
  }, expectedSha);
  validateGovernanceEvidence(attestation.governance, expectedSha);
  return attestation;
}
