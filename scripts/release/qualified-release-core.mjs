import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const QUALIFICATION_MANIFEST_NAME = 'release-qualification-manifest.json';
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
    'schemaVersion', 'sourceSha', 'branch', 'remoteBranchSha', 'tag', 'tagTargetSha',
    'annotated', 'forcePushProtection', 'remoteStateVerified', 'ci',
  ], 'GOVERNANCE_KEYS_INVALID');
  if (governance.schemaVersion !== GOVERNANCE_SCHEMA) fail('GOVERNANCE_SCHEMA_INVALID');
  if (canonicalSourceSha(governance.sourceSha) !== expectedSha) fail('GOVERNANCE_SOURCE_SHA_MISMATCH');
  if (canonicalSourceSha(governance.remoteBranchSha) !== expectedSha) fail('REMOTE_BRANCH_SHA_MISMATCH');
  if (canonicalSourceSha(governance.tagTargetSha) !== expectedSha) fail('REMOTE_TAG_SHA_MISMATCH');
  if (governance.branch !== 'release/candidat-individuel-prod') fail('RELEASE_BRANCH_INVALID');
  if (governance.tag !== `candidat-individuel-v1-${expectedSha.slice(0, 12)}`) fail('RELEASE_TAG_INVALID');
  if (governance.annotated !== true) fail('RELEASE_TAG_NOT_ANNOTATED');
  if (governance.forcePushProtection !== 'VERIFIED') fail('FORCE_PUSH_PROTECTION_UNVERIFIED');
  if (governance.remoteStateVerified !== true) fail('REMOTE_STATE_UNVERIFIED');
  exactKeys(governance.ci, ['kind', 'contexts'], 'CI_EVIDENCE_KEYS_INVALID');
  if (governance.ci.kind !== 'REMOTE_STATUS_CHECK') fail('CI_EVIDENCE_KIND_INVALID');
  if (!Array.isArray(governance.ci.contexts) || governance.ci.contexts.length !== REQUIRED_CI_CONTEXTS.length) {
    fail('CI_EVIDENCE_CONTEXTS_INVALID');
  }
  const contextsByName = new Map();
  for (const context of governance.ci.contexts) {
    exactKeys(context, ['name', 'status', 'sourceSha'], 'CI_CONTEXT_KEYS_INVALID');
    const name = safeText(context.name, 'CI_EVIDENCE_NAME_INVALID');
    if (contextsByName.has(name)) fail('CI_EVIDENCE_CONTEXTS_INVALID');
    contextsByName.set(name, context);
  }
  for (const name of REQUIRED_CI_CONTEXTS) {
    const context = contextsByName.get(name);
    if (!context || context.status !== 'PASS' || canonicalSourceSha(context.sourceSha) !== expectedSha) {
      fail('CI_EVIDENCE_NOT_PASS');
    }
  }
  return governance;
}

export function createQualificationManifest(evidence, inventory) {
  return {
    schemaVersion: QUALIFICATION_MANIFEST_SCHEMA,
    finalSourceSha: evidence.finalSourceSha,
    finalBuildId: evidence.finalBuildId,
    payload: inventory,
    build: evidence.build,
    versions: evidence.versions,
    migrations: evidence.migrations,
  };
}

export function validateManifest(value, expectedSha, expectedBuildId) {
  const manifest = object(value, 'QUALIFICATION_MANIFEST_INVALID');
  exactKeys(manifest, [
    'schemaVersion', 'finalSourceSha', 'finalBuildId', 'payload', 'build', 'versions', 'migrations',
  ], 'QUALIFICATION_MANIFEST_KEYS_INVALID');
  if (manifest.schemaVersion !== QUALIFICATION_MANIFEST_SCHEMA) fail('QUALIFICATION_MANIFEST_SCHEMA_INVALID');
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

export function verifyPackagedArtifactMatchesPayload(artifact, payloadRoot) {
  let listing;
  try {
    listing = execFileSync('tar', ['-tf', artifact], { encoding: 'utf8', timeout: 30_000 });
  } catch {
    fail('ARTIFACT_ARCHIVE_INVALID');
  }
  const names = new Set();
  for (const rawName of listing.split('\n').filter(Boolean)) {
    const withoutPrefix = rawName.replace(/^\.\//, '').replace(/\/$/, '');
    if (withoutPrefix === '' || withoutPrefix === '.') continue;
    const normalized = path.posix.normalize(withoutPrefix);
    if (path.posix.isAbsolute(rawName) || normalized === '..' || normalized.startsWith('../')) fail('ARTIFACT_ARCHIVE_PATH_INVALID');
    if (names.has(normalized)) fail('ARTIFACT_ARCHIVE_DUPLICATE_PATH');
    names.add(normalized);
  }
  const extractionRoot = mkdtempSync(path.join(os.tmpdir(), 'nexus-qualified-artifact-'));
  try {
    try {
      execFileSync('tar', ['-xf', artifact, '--no-same-owner', '-C', extractionRoot], { timeout: 30_000 });
    } catch {
      fail('ARTIFACT_ARCHIVE_EXTRACTION_FAILED');
    }
    const packaged = computePayloadInventory(extractionRoot, { exclude: [] });
    const retained = computePayloadInventory(payloadRoot, { exclude: [] });
    if (canonicalJson(packaged) !== canonicalJson(retained)) fail('ARTIFACT_PAYLOAD_MISMATCH');
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
    'ROLLBACK_READY',
  ], 'QUALIFICATION_ATTESTATION_KEYS_INVALID');
  if (attestation.schemaVersion !== QUALIFICATION_ATTESTATION_SCHEMA) fail('QUALIFICATION_ATTESTATION_SCHEMA_INVALID');
  if (canonicalSourceSha(attestation.finalSourceSha) !== expectedSha) fail('ATTESTATION_SOURCE_SHA_MISMATCH');
  if (canonicalBuildId(attestation.finalBuildId) !== expectedBuildId) fail('ATTESTATION_BUILD_ID_MISMATCH');
  if (!SHA256.test(attestation.payloadDigest) || !SHA256.test(attestation.manifestSha256)) fail('ATTESTATION_DIGEST_INVALID');
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
