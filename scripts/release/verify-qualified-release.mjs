#!/usr/bin/env node

import { basename, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  assertSourceState,
  assertEmbeddedQualificationManifest,
  canonicalBuildId,
  canonicalJson,
  canonicalSourceSha,
  parseStrictArgs,
  readJson,
  sha256File,
  validateAttestation,
  validateBuildBinding,
  verifyPackagedArtifactMatchesPayload,
  verifyPayloadAgainstManifest,
} from './qualified-release-core.mjs';
import { queryRemoteGovernance } from './release-governance-core.mjs';

function fail(code) { throw new Error(code); }
try {
  const args = parseStrictArgs(process.argv.slice(2), [
    'source-root', 'payload', 'build-receipt', 'manifest', 'artifact', 'attestation', 'attestation-sha256', 'remote',
  ]);
  for (const key of ['source-root', 'payload', 'build-receipt', 'manifest', 'artifact', 'attestation', 'attestation-sha256', 'remote']) {
    if (!args[key]) fail('ARGUMENT_REQUIRED');
  }
  const sourceSha = canonicalSourceSha(process.env.FINAL_SOURCE_SHA);
  assertSourceState(resolve(args['source-root']), sourceSha);
  const payload = resolve(args.payload);
  const manifestPath = assertEmbeddedQualificationManifest(payload, args.manifest);
  const manifest = readJson(manifestPath, 'QUALIFICATION_MANIFEST_JSON_INVALID');
  const buildId = canonicalBuildId(manifest.finalBuildId);
  const buildBinding = validateBuildBinding(args['source-root'], payload, args['build-receipt'], sourceSha, buildId);
  if (
    manifest.buildReceiptSha256 !== buildBinding.receiptSha256
    || manifest.buildProvenanceSha256 !== buildBinding.provenanceSha256
  ) fail('MANIFEST_BUILD_BINDING_MISMATCH');
  verifyPayloadAgainstManifest(payload, manifest, sourceSha, buildId);
  const attestation = validateAttestation(readJson(args.attestation, 'QUALIFICATION_ATTESTATION_JSON_INVALID'), sourceSha, buildId);
  if (attestation.payloadDigest !== manifest.payload.digest) fail('ATTESTATION_PAYLOAD_DIGEST_MISMATCH');
  if (
    attestation.buildReceiptSha256 !== buildBinding.receiptSha256
    || attestation.buildProvenanceSha256 !== buildBinding.provenanceSha256
  ) fail('ATTESTATION_BUILD_BINDING_MISMATCH');
  for (const field of ['build', 'versions', 'migrations']) {
    if (canonicalJson(attestation[field]) !== canonicalJson(manifest[field])) fail('MANIFEST_ATTESTATION_EVIDENCE_MISMATCH');
  }
  if (attestation.manifestSha256 !== sha256File(manifestPath)) fail('MANIFEST_DIGEST_MISMATCH');
  const artifactVerification = verifyPackagedArtifactMatchesPayload(args.artifact, payload);
  if (attestation.artifact.fileName !== basename(args.artifact) || attestation.artifact.sha256 !== artifactVerification.sha256) {
    fail('ARTIFACT_DIGEST_MISMATCH');
  }
  const freshGovernance = queryRemoteGovernance({
    sourceRoot: resolve(args['source-root']), remoteName: args.remote,
    branch: attestation.governance.branch, tag: attestation.governance.tag, sourceSha,
  });
  if (canonicalJson(attestation.governance) !== canonicalJson(freshGovernance)) fail('GOVERNANCE_EVIDENCE_STALE');
  const expectedSidecar = `${sha256File(args.attestation)}  ${basename(args.attestation)}\n`;
  if (readFileSync(args['attestation-sha256'], 'utf8') !== expectedSidecar) fail('ATTESTATION_SIDECAR_MISMATCH');
  assertSourceState(resolve(args['source-root']), sourceSha);
  console.log('QUALIFIED_RELEASE_VERIFIED');
} catch (error) {
  console.error(`QUALIFIED_RELEASE_INVALID:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  process.exit(1);
}
