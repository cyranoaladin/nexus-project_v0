import { execFileSync } from 'node:child_process';
import {
  GOVERNANCE_SCHEMA,
  REQUIRED_CI_CONTEXTS,
  canonicalSourceSha,
} from './qualified-release-core.mjs';

const REMOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const REPOSITORY_PART = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,98}[A-Za-z0-9])?$/;
const WORKFLOW_PATH = '.github/workflows/ci.yml';
const TAG_PATTERN = 'refs/tags/candidat-individuel-v1-*';

function fail(code) { throw new Error(code); }

function command(binary, args, cwd) {
  try { return execFileSync(binary, args, { cwd, encoding: 'utf8', timeout: 30_000 }).trim(); }
  catch { fail('REMOTE_GOVERNANCE_QUERY_FAILED'); }
}

function jsonCommand(binary, args, cwd) {
  try { return JSON.parse(command(binary, args, cwd)); }
  catch (error) {
    if (error instanceof Error && error.message === 'REMOTE_GOVERNANCE_QUERY_FAILED') throw error;
    fail('REMOTE_GOVERNANCE_RESPONSE_INVALID');
  }
}

function flattenPages(value, key) {
  const pages = Array.isArray(value) ? value : [value];
  const output = [];
  for (const page of pages) {
    const entries = page?.[key];
    if (!Array.isArray(entries)) fail('REMOTE_GOVERNANCE_RESPONSE_INVALID');
    output.push(...entries);
  }
  return output;
}

function lsRemoteLine(output, reference) {
  const line = output.split('\n').find((candidate) => candidate.endsWith(`\t${reference}`));
  return line?.split(/\s+/)[0] ?? null;
}

export function canonicalGithubRemote(remoteName, remoteUrl) {
  if (typeof remoteName !== 'string' || !REMOTE_NAME.test(remoteName)) fail('REMOTE_NAME_INVALID');
  if (typeof remoteUrl !== 'string' || remoteUrl.includes('\u0000') || /[?&#]/.test(remoteUrl)) fail('REMOTE_URL_INVALID');
  const patterns = [
    /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
    /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
  ];
  const match = patterns.map((pattern) => remoteUrl.match(pattern)).find(Boolean);
  if (!match) fail('REMOTE_URL_INVALID');
  const owner = match[1];
  const repositoryName = match[2];
  if (!REPOSITORY_PART.test(owner) || !REPOSITORY_PART.test(repositoryName) || owner.includes('..') || repositoryName.includes('..')) {
    fail('REMOTE_URL_INVALID');
  }
  return Object.freeze({ name: remoteName, url: remoteUrl, repository: `${owner}/${repositoryName}` });
}

export function queryRemoteGovernance({ sourceRoot, remoteName, branch, tag, sourceSha }) {
  canonicalSourceSha(sourceSha);
  if (branch !== 'release/candidat-individuel-prod') fail('RELEASE_BRANCH_INVALID');
  if (tag !== `candidat-individuel-v1-${sourceSha.slice(0, 12)}`) fail('RELEASE_TAG_INVALID');
  const remoteUrl = command('git', ['remote', 'get-url', remoteName], sourceRoot);
  const remote = canonicalGithubRemote(remoteName, remoteUrl);

  const branchRef = `refs/heads/${branch}`;
  const branchOutput = command('git', ['ls-remote', '--heads', remoteName, branchRef], sourceRoot);
  if (lsRemoteLine(branchOutput, branchRef) !== sourceSha) fail('REMOTE_BRANCH_SHA_MISMATCH');
  const tagRef = `refs/tags/${tag}`;
  const peeledRef = `${tagRef}^{}`;
  const tagOutput = command('git', ['ls-remote', '--tags', remoteName, tagRef, peeledRef], sourceRoot);
  if (!lsRemoteLine(tagOutput, tagRef) || lsRemoteLine(tagOutput, peeledRef) !== sourceSha) {
    fail('REMOTE_TAG_NOT_ANNOTATED_OR_MISMATCH');
  }

  const encodedBranch = encodeURIComponent(branch);
  const protection = jsonCommand('gh', ['api', `repos/${remote.repository}/branches/${encodedBranch}/protection`], sourceRoot);
  if (
    protection?.enforce_admins?.enabled !== true
    || protection?.allow_force_pushes?.enabled !== false
    || protection?.allow_deletions?.enabled !== false
  ) fail('BRANCH_PROTECTION_UNVERIFIED');

  const rulesetSummaries = jsonCommand('gh', ['api', '--paginate', '--slurp', `repos/${remote.repository}/rulesets?includes_parents=true&per_page=100`], sourceRoot);
  const summaries = Array.isArray(rulesetSummaries) ? rulesetSummaries.flat() : [];
  let governedRuleset = null;
  for (const summary of summaries) {
    if (!Number.isSafeInteger(summary?.id)) continue;
    const candidate = jsonCommand('gh', ['api', `repos/${remote.repository}/rulesets/${summary.id}`], sourceRoot);
    const ruleTypes = new Set(Array.isArray(candidate?.rules) ? candidate.rules.map((rule) => rule?.type) : []);
    if (
      candidate?.target === 'tag'
      && candidate?.enforcement === 'active'
      && Array.isArray(candidate?.bypass_actors)
      && candidate.bypass_actors.length === 0
      && Array.isArray(candidate?.conditions?.ref_name?.include)
      && candidate.conditions.ref_name.include.includes(TAG_PATTERN)
      && ruleTypes.has('deletion')
      && ruleTypes.has('non_fast_forward')
    ) {
      governedRuleset = candidate;
      break;
    }
  }
  if (!governedRuleset) fail('TAG_RULESET_UNVERIFIED');

  const workflowPages = jsonCommand('gh', [
    'api', '--paginate', '--slurp',
    `repos/${remote.repository}/actions/workflows/ci.yml/runs?head_sha=${sourceSha}&status=completed&per_page=100`,
  ], sourceRoot);
  const runs = flattenPages(workflowPages, 'workflow_runs')
    .filter((run) => (
      run?.head_sha === sourceSha
      && run?.status === 'completed'
      && run?.conclusion === 'success'
      && run?.path === WORKFLOW_PATH
      && Number.isSafeInteger(run?.id)
      && Number.isSafeInteger(run?.run_number)
      && run?.html_url === `https://github.com/${remote.repository}/actions/runs/${run.id}`
    ))
    .sort((left, right) => right.run_number - left.run_number || right.id - left.id);
  const governedRun = runs[0];
  if (!governedRun) fail('GOVERNED_WORKFLOW_RUN_NOT_PASS');

  const checkPages = jsonCommand('gh', [
    'api', '--paginate', '--slurp',
    `repos/${remote.repository}/commits/${sourceSha}/check-runs?per_page=100`,
  ], sourceRoot);
  const checkRuns = flattenPages(checkPages, 'check_runs');
  const contexts = REQUIRED_CI_CONTEXTS.map((name) => {
    const trusted = checkRuns
      .filter((check) => (
        check?.name === name
        && check?.head_sha === sourceSha
        && check?.conclusion === 'success'
        && check?.app?.slug === 'github-actions'
        && check?.app?.owner?.login === 'github'
        && Number.isSafeInteger(check?.id)
        && typeof check?.details_url === 'string'
        && check.details_url.startsWith(`https://github.com/${remote.repository}/actions/runs/${governedRun.id}/`)
      ))
      .sort((left, right) => right.id - left.id)[0];
    if (!trusted) fail('REQUIRED_REMOTE_CHECK_NOT_PASS');
    return {
      name,
      status: 'PASS',
      sourceSha,
      checkRunId: trusted.id,
      detailsUrl: trusted.details_url,
      app: { slug: 'github-actions', owner: 'github' },
    };
  });

  return Object.freeze({
    schemaVersion: GOVERNANCE_SCHEMA,
    sourceSha,
    remote,
    branch,
    remoteBranchSha: sourceSha,
    tag,
    tagTargetSha: sourceSha,
    annotated: true,
    branchProtection: { enforceAdmins: true, allowForcePushes: false, allowDeletions: false },
    tagRuleset: {
      id: governedRuleset.id,
      name: governedRuleset.name,
      enforcement: 'active',
      pattern: TAG_PATTERN,
      bypassActors: 0,
      deletionProtected: true,
      nonFastForwardProtected: true,
    },
    remoteStateVerified: true,
    ci: { kind: 'REMOTE_STATUS_CHECK', workflow: WORKFLOW_PATH, runId: governedRun.id, contexts },
  });
}
