#!/usr/bin/env node

import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { closeSync, constants, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import {
  QUALIFICATION_ATTESTATION_SCHEMA,
  QUALIFICATION_MANIFEST_NAME,
  assertEmbeddedQualificationManifest,
  assertSourceState,
  canonicalJson,
  canonicalSourceSha,
  computePayloadInventory,
  createQualificationManifest,
  parseStrictArgs,
  readJson,
  sha256File,
  validateGovernanceEvidence,
  validateBuildEvidence,
  validateBuildBinding,
  validateQualificationEvidence,
  verifyPackagedArtifactMatchesPayload,
  verifyPayloadAgainstManifest,
} from './qualified-release-core.mjs';
import { queryRemoteGovernance } from './release-governance-core.mjs';

function fail(code) { throw new Error(code); }
function isInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
}
function writeEmbeddedManifestOnce(output, value) {
  let descriptor;
  try {
    descriptor = openSync(output, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o400);
    const content = Buffer.from(`${canonicalJson(value)}\n`);
    let offset = 0;
    while (offset < content.length) offset += writeSync(descriptor, content, offset, content.length - offset);
    fsyncSync(descriptor);
  } catch {
    fail('QUALIFICATION_MANIFEST_ALREADY_EXISTS');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
function parse(argv) {
  const [mode, ...tokens] = argv;
  if (!['manifest', 'attestation'].includes(mode)) fail('MODE_INVALID');
  const allowed = mode === 'manifest'
    ? ['source-root', 'payload', 'build-receipt', 'evidence', 'output']
    : ['source-root', 'payload', 'build-receipt', 'manifest', 'artifact', 'evidence', 'governance', 'remote', 'output'];
  return { mode, ...parseStrictArgs(tokens, allowed) };
}

try {
  const args = parse(process.argv.slice(2));
  const sourceSha = canonicalSourceSha(process.env.FINAL_SOURCE_SHA);
  const required = args.mode === 'manifest'
    ? ['source-root', 'payload', 'build-receipt', 'evidence', 'output']
    : ['source-root', 'payload', 'build-receipt', 'manifest', 'artifact', 'evidence', 'governance', 'remote', 'output'];
  for (const key of required) if (!args[key]) fail('ARGUMENT_REQUIRED');
  assertSourceState(resolve(args['source-root']), sourceSha);
  const evidence = args.mode === 'manifest'
    ? validateBuildEvidence(readJson(args.evidence, 'BUILD_INPUT_JSON_INVALID'), sourceSha)
    : validateQualificationEvidence(readJson(args.evidence, 'QUALIFICATION_INPUT_JSON_INVALID'), sourceSha);
  const payload = resolve(args.payload);

  if (args.mode === 'manifest') {
    const output = resolve(args.output);
    if (dirname(output) !== payload || basename(output) !== QUALIFICATION_MANIFEST_NAME) fail('MANIFEST_OUTPUT_LOCATION_INVALID');
    const buildIdPath = resolve(payload, '.next/BUILD_ID');
    if (readFileSync(buildIdPath, 'utf8').trim() !== evidence.finalBuildId) fail('PAYLOAD_BUILD_ID_MISMATCH');
    const buildBinding = validateBuildBinding(payload, args['build-receipt'], sourceSha, evidence.finalBuildId, args.evidence);
    const inventory = computePayloadInventory(payload);
    writeEmbeddedManifestOnce(output, createQualificationManifest(evidence, inventory, buildBinding));
    console.log('QUALIFICATION_MANIFEST_CREATED');
  } else {
    const manifestPath = assertEmbeddedQualificationManifest(payload, args.manifest);
    const manifest = readJson(manifestPath, 'QUALIFICATION_MANIFEST_JSON_INVALID');
    const buildBinding = validateBuildBinding(payload, args['build-receipt'], sourceSha, evidence.finalBuildId);
    if (
      manifest.buildReceiptSha256 !== buildBinding.receiptSha256
      || manifest.buildProvenanceSha256 !== buildBinding.provenanceSha256
    ) fail('MANIFEST_BUILD_BINDING_MISMATCH');
    verifyPayloadAgainstManifest(payload, manifest, sourceSha, evidence.finalBuildId);
    for (const field of ['build', 'versions', 'migrations']) {
      if (canonicalJson(manifest[field]) !== canonicalJson(evidence[field])) fail('BUILD_AND_QUALIFICATION_EVIDENCE_MISMATCH');
    }
    const governance = validateGovernanceEvidence(readJson(args.governance, 'GOVERNANCE_JSON_INVALID'), sourceSha);
    const freshGovernance = queryRemoteGovernance({
      sourceRoot: resolve(args['source-root']), remoteName: args.remote,
      branch: governance.branch, tag: governance.tag, sourceSha,
    });
    if (canonicalJson(governance) !== canonicalJson(freshGovernance)) fail('GOVERNANCE_EVIDENCE_STALE');
    const output = resolve(args.output);
    if (isInside(payload, resolve(args.artifact)) || isInside(payload, output)) fail('ARTIFACT_OR_SIDECAR_MUST_BE_EXTERNAL');
    const artifactVerification = verifyPackagedArtifactMatchesPayload(args.artifact, payload);
    const source = assertSourceState(resolve(args['source-root']), sourceSha);
    const attestation = {
      schemaVersion: QUALIFICATION_ATTESTATION_SCHEMA,
      finalSourceSha: sourceSha,
      finalBuildId: evidence.finalBuildId,
      payloadDigest: manifest.payload.digest,
      manifestSha256: sha256File(manifestPath),
      artifact: { fileName: basename(args.artifact), sha256: artifactVerification.sha256 },
      source: { headSha: source.headSha, clean: true, postGateHeadSha: source.headSha },
      artifactReconstructed: false,
      build: evidence.build,
      versions: evidence.versions,
      migrations: evidence.migrations,
      commands: evidence.commands,
      requiredGates: evidence.requiredGates,
      OLD_RELEASE: evidence.OLD_RELEASE,
      PIPELINE_STATE: evidence.PIPELINE_STATE,
      ACTIVE_PUBLIC: evidence.ACTIVE_PUBLIC,
      P1_A: evidence.P1_A,
      ROLLBACK_READY: evidence.ROLLBACK_READY,
      buildReceiptSha256: buildBinding.receiptSha256,
      buildProvenanceSha256: buildBinding.provenanceSha256,
      governance,
    };
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${canonicalJson(attestation)}\n`, { flag: 'wx', mode: 0o600 });
    const digest = sha256File(output);
    writeFileSync(`${output}.sha256`, `${digest}  ${basename(output)}\n`, { flag: 'wx', mode: 0o600 });
    console.log('QUALIFICATION_ATTESTATION_CREATED');
  }
} catch (error) {
  console.error(`QUALIFICATION_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  process.exit(1);
}
