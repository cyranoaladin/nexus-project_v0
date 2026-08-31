#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { closeSync, constants, fsyncSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
  canonicalSourceSha,
  parseStrictArgs,
  validateBuildBinding,
  verifyPackagedArtifactMatchesPayload,
} from './qualified-release-core.mjs';

function fail(code) { throw new Error(code); }

let temporaryDirectory;
try {
  const args = parseStrictArgs(process.argv.slice(2), ['source-root', 'payload', 'build-receipt', 'output']);
  for (const key of ['source-root', 'payload', 'build-receipt', 'output']) if (!args[key]) fail('ARGUMENT_REQUIRED');
  const sourceSha = canonicalSourceSha(process.env.FINAL_SOURCE_SHA);
  const payload = path.resolve(args.payload);
  const output = path.resolve(args.output);
  try { lstatSync(output); fail('ARTIFACT_OUTPUT_ALREADY_EXISTS'); } catch (error) {
    if (error instanceof Error && error.message === 'ARTIFACT_OUTPUT_ALREADY_EXISTS') throw error;
    if (typeof error !== 'object' || error === null || error.code !== 'ENOENT') fail('ARTIFACT_OUTPUT_PREFLIGHT_FAILED');
  }
  lstatSync(path.join(payload, '.next', 'BUILD_ID'));
  const buildId = readFileSync(path.join(payload, '.next', 'BUILD_ID'), 'utf8').trim();
  validateBuildBinding(payload, args['build-receipt'], sourceSha, buildId);
  mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  temporaryDirectory = mkdtempSync(path.join(path.dirname(output), '.nexus-pack-'));
  const temporary = path.join(temporaryDirectory, 'artifact.tar');
  execFileSync('tar', [
    '--sort=name', '--format=posix', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner',
    '--pax-option=delete=atime,delete=ctime',
    '-cf', temporary, '-C', payload, '.',
  ], { timeout: 120_000 });
  verifyPackagedArtifactMatchesPayload(temporary, payload);
  const artifactDescriptor = openSync(temporary, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try { fsyncSync(artifactDescriptor); } finally { closeSync(artifactDescriptor); }
  linkSync(temporary, output);
  const directoryDescriptor = openSync(path.dirname(output), constants.O_RDONLY);
  try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
  rmSync(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
  console.log('QUALIFIED_ARTIFACT_PACKAGED');
} catch (error) {
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
  console.error(`QUALIFIED_PACKAGE_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  process.exit(1);
}
