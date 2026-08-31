#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  GOVERNANCE_SCHEMA,
  REQUIRED_CI_CONTEXTS,
  assertSourceState,
  canonicalJson,
  canonicalSourceSha,
} from './qualified-release-core.mjs';

function fail(code) { throw new Error(code); }
function parse(tokens) {
  const allowed = new Set(['source-root', 'remote', 'repository', 'branch', 'tag', 'output']);
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    if (!tokens[index]?.startsWith('--') || tokens[index + 1] === undefined) fail('ARGUMENT_INVALID');
    const key = tokens[index].slice(2);
    if (!allowed.has(key) || values[key] !== undefined) fail('ARGUMENT_INVALID');
    values[key] = tokens[index + 1];
  }
  return values;
}
function command(binary, args, cwd) {
  try { return execFileSync(binary, args, { cwd, encoding: 'utf8', timeout: 20_000 }).trim(); }
  catch { fail('REMOTE_GOVERNANCE_QUERY_FAILED'); }
}
function lsRemoteLine(output, reference) {
  const line = output.split('\n').find((candidate) => candidate.endsWith(`\t${reference}`));
  return line?.split(/\s+/)[0] ?? null;
}

try {
  const args = parse(process.argv.slice(2));
  for (const key of ['source-root', 'remote', 'repository', 'branch', 'tag', 'output']) {
    if (!args[key]) fail('ARGUMENT_REQUIRED');
  }
  const sourceSha = canonicalSourceSha(process.env.FINAL_SOURCE_SHA);
  const sourceRoot = resolve(args['source-root']);
  assertSourceState(sourceRoot, sourceSha);
  if (args.branch !== 'release/candidat-individuel-prod') fail('RELEASE_BRANCH_INVALID');
  if (args.tag !== `candidat-individuel-v1-${sourceSha.slice(0, 12)}`) fail('RELEASE_TAG_INVALID');

  const branchRef = `refs/heads/${args.branch}`;
  const branchOutput = command('git', ['ls-remote', '--heads', args.remote, branchRef], sourceRoot);
  if (lsRemoteLine(branchOutput, branchRef) !== sourceSha) fail('REMOTE_BRANCH_SHA_MISMATCH');
  const tagRef = `refs/tags/${args.tag}`;
  const peeledRef = `${tagRef}^{}`;
  const tagOutput = command('git', ['ls-remote', '--tags', args.remote, tagRef, peeledRef], sourceRoot);
  if (!lsRemoteLine(tagOutput, tagRef) || lsRemoteLine(tagOutput, peeledRef) !== sourceSha) fail('REMOTE_TAG_NOT_ANNOTATED_OR_MISMATCH');

  const encodedBranch = encodeURIComponent(args.branch);
  let protection;
  let checks;
  try {
    protection = JSON.parse(command('gh', ['api', `repos/${args.repository}/branches/${encodedBranch}/protection`], sourceRoot));
    checks = JSON.parse(command('gh', ['api', `repos/${args.repository}/commits/${sourceSha}/check-runs`], sourceRoot));
  } catch {
    fail('REMOTE_GOVERNANCE_RESPONSE_INVALID');
  }
  if (protection?.allow_force_pushes?.enabled !== false) fail('FORCE_PUSH_PROTECTION_UNVERIFIED');
  const checkRuns = Array.isArray(checks?.check_runs) ? checks.check_runs : [];
  const contexts = REQUIRED_CI_CONTEXTS.map((name) => {
    const check = checkRuns.find((candidate) => candidate?.name === name && candidate?.head_sha === sourceSha);
    if (!check || check.conclusion !== 'success') fail('REQUIRED_REMOTE_CHECK_NOT_PASS');
    return { name, status: 'PASS', sourceSha };
  });

  const evidence = {
    schemaVersion: GOVERNANCE_SCHEMA,
    sourceSha,
    branch: args.branch,
    remoteBranchSha: sourceSha,
    tag: args.tag,
    tagTargetSha: sourceSha,
    annotated: true,
    forcePushProtection: 'VERIFIED',
    remoteStateVerified: true,
    ci: { kind: 'REMOTE_STATUS_CHECK', contexts },
  };
  const output = resolve(args.output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${canonicalJson(evidence)}\n`, { flag: 'wx', mode: 0o600 });
  assertSourceState(sourceRoot, sourceSha);
  console.log('REMOTE_RELEASE_GOVERNANCE_VERIFIED');
} catch (error) {
  console.error(`RELEASE_GOVERNANCE_INVALID:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  process.exit(1);
}
