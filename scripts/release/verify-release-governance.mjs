#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  assertSourceState,
  canonicalJson,
  canonicalSourceSha,
  parseStrictArgs,
} from './qualified-release-core.mjs';
import { queryRemoteGovernance } from './release-governance-core.mjs';

function fail(code) { throw new Error(code); }
try {
  const args = parseStrictArgs(process.argv.slice(2), ['source-root', 'remote', 'branch', 'tag', 'output']);
  for (const key of ['source-root', 'remote', 'branch', 'tag', 'output']) {
    if (!args[key]) fail('ARGUMENT_REQUIRED');
  }
  const sourceSha = canonicalSourceSha(process.env.FINAL_SOURCE_SHA);
  const sourceRoot = resolve(args['source-root']);
  assertSourceState(sourceRoot, sourceSha);
  const evidence = queryRemoteGovernance({
    sourceRoot,
    remoteName: args.remote,
    branch: args.branch,
    tag: args.tag,
    sourceSha,
  });
  const output = resolve(args.output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${canonicalJson(evidence)}\n`, { flag: 'wx', mode: 0o600 });
  assertSourceState(sourceRoot, sourceSha);
  console.log('REMOTE_RELEASE_GOVERNANCE_VERIFIED');
} catch (error) {
  console.error(`RELEASE_GOVERNANCE_INVALID:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  process.exit(1);
}
