#!/usr/bin/env node

import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  QUALIFICATION_ATTESTATION_SCHEMA,
  QUALIFICATION_MANIFEST_NAME,
  assertSourceState,
  canonicalJson,
  canonicalSourceSha,
  computePayloadInventory,
  createQualificationManifest,
  readJson,
  sha256File,
  validateGovernanceEvidence,
  validateQualificationEvidence,
  verifyPackagedArtifactMatchesPayload,
  verifyPayloadAgainstManifest,
} from './qualified-release-core.mjs';

function fail(code) { throw new Error(code); }
function isInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
}
function parse(argv) {
  const [mode, ...tokens] = argv;
  if (!['manifest', 'attestation'].includes(mode)) fail('MODE_INVALID');
  const values = { mode };
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail('ARGUMENT_INVALID');
    values[key.slice(2)] = value;
  }
  return values;
}

try {
  const args = parse(process.argv.slice(2));
  const sourceSha = canonicalSourceSha(process.env.FINAL_SOURCE_SHA);
  const required = args.mode === 'manifest'
    ? ['source-root', 'payload', 'evidence', 'output']
    : ['source-root', 'payload', 'manifest', 'artifact', 'evidence', 'governance', 'output'];
  for (const key of required) if (!args[key]) fail('ARGUMENT_REQUIRED');
  assertSourceState(resolve(args['source-root']), sourceSha);
  const evidence = validateQualificationEvidence(readJson(args.evidence, 'QUALIFICATION_INPUT_JSON_INVALID'), sourceSha);
  const payload = resolve(args.payload);

  if (args.mode === 'manifest') {
    const output = resolve(args.output);
    if (dirname(output) !== payload || basename(output) !== QUALIFICATION_MANIFEST_NAME) fail('MANIFEST_OUTPUT_LOCATION_INVALID');
    const buildIdPath = resolve(payload, '.next/BUILD_ID');
    if (readFileSync(buildIdPath, 'utf8').trim() !== evidence.finalBuildId) fail('PAYLOAD_BUILD_ID_MISMATCH');
    const inventory = computePayloadInventory(payload);
    writeFileSync(output, `${canonicalJson(createQualificationManifest(evidence, inventory))}\n`, { flag: 'w', mode: 0o644 });
    console.log('QUALIFICATION_MANIFEST_CREATED');
  } else {
    const manifest = readJson(args.manifest, 'QUALIFICATION_MANIFEST_JSON_INVALID');
    verifyPayloadAgainstManifest(payload, manifest, sourceSha, evidence.finalBuildId);
    if (canonicalJson(manifest.commands) !== canonicalJson(evidence.commands)) fail('EVIDENCE_COMMANDS_MISMATCH');
    const governance = validateGovernanceEvidence(readJson(args.governance, 'GOVERNANCE_JSON_INVALID'), sourceSha);
    const output = resolve(args.output);
    if (isInside(payload, resolve(args.artifact)) || isInside(payload, output)) fail('ARTIFACT_OR_SIDECAR_MUST_BE_EXTERNAL');
    verifyPackagedArtifactMatchesPayload(args.artifact, payload);
    const source = assertSourceState(resolve(args['source-root']), sourceSha);
    const attestation = {
      schemaVersion: QUALIFICATION_ATTESTATION_SCHEMA,
      finalSourceSha: sourceSha,
      finalBuildId: evidence.finalBuildId,
      payloadDigest: manifest.payload.digest,
      manifestSha256: sha256File(args.manifest),
      artifact: { fileName: basename(args.artifact), sha256: sha256File(args.artifact) },
      source: { headSha: source.headSha, clean: true, postGateHeadSha: source.headSha },
      artifactReconstructed: false,
      versions: evidence.versions,
      migrations: evidence.migrations,
      commands: evidence.commands,
      requiredGates: evidence.requiredGates,
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
