#!/usr/bin/env node

import { fail, parseArguments, requireArguments } from './lib/args.mjs';
import { createGhClient } from './lib/gh.mjs';

const REPO = 'cyranoaladin/nexus-project_v0';

const PR_QUERY = `query($number: Int!) {
  repository(owner: "cyranoaladin", name: "nexus-project_v0") {
    pullRequest(number: $number) {
      id
      number
      isDraft
      baseRefName
      headRefOid
      autoMergeRequest { enabledAt mergeMethod }
      author { login }
    }
  }
}`;

const ENABLE_AUTO_MERGE_MUTATION = `mutation($pullRequestId: ID!) {
  enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: MERGE }) {
    pullRequest { number autoMergeRequest { enabledAt mergeMethod } }
  }
}`;

// Never approves — submits no review of any kind. Only arms GitHub's
// native auto-merge; every gate it waits on (reviews, required checks,
// staleness-on-push) is still enforced by GitHub, never bypassed here.
export function armAutoMerge({ repo = REPO, prNumber, expectedBase = 'main', gh = createGhClient() }) {
  if (repo !== REPO) {
    fail('ARM_AUTO_MERGE_REPO_MISMATCH', `expected ${REPO}, got ${repo}`);
  }
  if (!Number.isInteger(prNumber) || prNumber < 1) {
    fail('ARM_AUTO_MERGE_INVALID_PR_NUMBER', String(prNumber));
  }

  const result = gh.graphql(PR_QUERY, { number: prNumber });
  const pr = result?.data?.repository?.pullRequest;
  if (!pr) {
    fail('ARM_AUTO_MERGE_PR_NOT_FOUND', String(prNumber));
  }
  if (pr.baseRefName !== expectedBase) {
    fail('ARM_AUTO_MERGE_BASE_MISMATCH', `expected base "${expectedBase}", got "${pr.baseRefName}"`);
  }
  if (pr.isDraft) {
    fail('ARM_AUTO_MERGE_DRAFT_REFUSED', `PR #${prNumber} is a draft`);
  }

  if (pr.autoMergeRequest?.mergeMethod === 'MERGE') {
    process.stdout.write(`ARM_AUTO_MERGE_ALREADY_ARMED pr=${prNumber} headSha=${pr.headRefOid}\n`);
    return { alreadyArmed: true, prNumber, headSha: pr.headRefOid };
  }

  gh.graphql(ENABLE_AUTO_MERGE_MUTATION, { pullRequestId: pr.id });

  process.stdout.write(`ARM_AUTO_MERGE_OK pr=${prNumber} headSha=${pr.headRefOid} method=merge\n`);
  return { alreadyArmed: false, prNumber, headSha: pr.headRefOid };
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  requireArguments(args, ['pr']);
  const prNumber = Number(args.pr);
  armAutoMerge({
    repo: args.repo ?? REPO,
    prNumber,
    expectedBase: args.base ?? 'main',
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
