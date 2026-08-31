#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  canonicalSourceSha,
  parseStrictArgs,
  validateBuildBinding,
  verifyPackagedArtifactMatchesPayload,
} from './qualified-release-core.mjs';

function fail(code) { throw new Error(code); }

let temporary;
try {
  const args = parseStrictArgs(process.argv.slice(2), ['source-root', 'payload', 'build-receipt', 'output']);
  for (const key of ['source-root', 'payload', 'build-receipt', 'output']) if (!args[key]) fail('ARGUMENT_REQUIRED');
  const sourceSha = canonicalSourceSha(process.env.FINAL_SOURCE_SHA);
  const payload = path.resolve(args.payload);
  const output = path.resolve(args.output);
  try { lstatSync(output); fail('ARTIFACT_OUTPUT_ALREADY_EXISTS'); } catch (error) {
    if (error instanceof Error && error.message === 'ARTIFACT_OUTPUT_ALREADY_EXISTS') throw error;
  }
  lstatSync(path.join(payload, '.next', 'BUILD_ID'));
  const buildId = readFileSync(path.join(payload, '.next', 'BUILD_ID'), 'utf8').trim();
  validateBuildBinding(args['source-root'], payload, args['build-receipt'], sourceSha, buildId);
  mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'nexus-pack-'));
  temporary = path.join(temporaryDirectory, 'artifact.tar');
  execFileSync('tar', [
    '--sort=name', '--format=posix', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner',
    '--mode=u+rwX,go+rX,go-w', '--pax-option=delete=atime,delete=ctime',
    '-cf', temporary, '-C', payload, '.',
  ], { timeout: 120_000 });
  verifyPackagedArtifactMatchesPayload(temporary, payload);
  renameSync(temporary, output);
  temporary = undefined;
  rmSync(temporaryDirectory, { recursive: true, force: true });
  console.log('QUALIFIED_ARTIFACT_PACKAGED');
} catch (error) {
  if (temporary) rmSync(path.dirname(temporary), { recursive: true, force: true });
  console.error(`QUALIFIED_PACKAGE_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  process.exit(1);
}
