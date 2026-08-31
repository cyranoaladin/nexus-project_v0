#!/usr/bin/env node

import { basename, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  assertSourceState,
  canonicalBuildId,
  canonicalJson,
  canonicalSourceSha,
  readJson,
  sha256File,
  validateAttestation,
  verifyPackagedArtifactMatchesPayload,
  verifyPayloadAgainstManifest,
} from './qualified-release-core.mjs';

function fail(code) { throw new Error(code); }
function parse(tokens) {
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    if (!tokens[index]?.startsWith('--') || tokens[index + 1] === undefined) fail('ARGUMENT_INVALID');
    values[tokens[index].slice(2)] = tokens[index + 1];
  }
  return values;
}

try {
  const args = parse(process.argv.slice(2));
  for (const key of ['source-root', 'payload', 'manifest', 'artifact', 'attestation', 'attestation-sha256']) {
    if (!args[key]) fail('ARGUMENT_REQUIRED');
  }
  const sourceSha = canonicalSourceSha(process.env.FINAL_SOURCE_SHA);
  assertSourceState(resolve(args['source-root']), sourceSha);
  const manifest = readJson(args.manifest, 'QUALIFICATION_MANIFEST_JSON_INVALID');
  const buildId = canonicalBuildId(manifest.finalBuildId);
  verifyPayloadAgainstManifest(resolve(args.payload), manifest, sourceSha, buildId);
  const attestation = validateAttestation(readJson(args.attestation, 'QUALIFICATION_ATTESTATION_JSON_INVALID'), sourceSha, buildId);
  if (attestation.payloadDigest !== manifest.payload.digest) fail('ATTESTATION_PAYLOAD_DIGEST_MISMATCH');
  for (const field of ['versions', 'migrations', 'commands', 'requiredGates']) {
    if (canonicalJson(attestation[field]) !== canonicalJson(manifest[field])) fail('MANIFEST_ATTESTATION_EVIDENCE_MISMATCH');
  }
  if (attestation.manifestSha256 !== sha256File(args.manifest)) fail('MANIFEST_DIGEST_MISMATCH');
  if (attestation.artifact.fileName !== basename(args.artifact) || attestation.artifact.sha256 !== sha256File(args.artifact)) {
    fail('ARTIFACT_DIGEST_MISMATCH');
  }
  verifyPackagedArtifactMatchesPayload(args.artifact, resolve(args.payload));
  const expectedSidecar = `${sha256File(args.attestation)}  ${basename(args.attestation)}\n`;
  if (readFileSync(args['attestation-sha256'], 'utf8') !== expectedSidecar) fail('ATTESTATION_SIDECAR_MISMATCH');
  assertSourceState(resolve(args['source-root']), sourceSha);
  console.log('QUALIFIED_RELEASE_VERIFIED');
} catch (error) {
  console.error(`QUALIFIED_RELEASE_INVALID:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  process.exit(1);
}
