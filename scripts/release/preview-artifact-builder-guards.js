const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

function isFullSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);
}

function validateSourceSelection({ eventName, ref, workflowSha }) {
  const errors = [];
  if (eventName !== 'workflow_dispatch') errors.push('WORKFLOW_EVENT_NOT_DISPATCH');
  if (ref !== 'refs/heads/main') errors.push('WORKFLOW_REF_NOT_MAIN');
  if (!isFullSha(workflowSha)) errors.push('WORKFLOW_SHA_INVALID');
  return errors;
}

function getProducerName(check) {
  return check?.app?.name || '';
}

function isExpectedProducer(check, producer) {
  const expectedName = producer.kind === 'EXTERNAL_APP' ? producer.appName : 'GitHub Actions';
  return Number.isInteger(producer.integrationId)
    && getProducerName(check) === expectedName
    && check?.app?.id === producer.integrationId;
}

function checkTimestamp(check) {
  const raw = check?.started_at || check?.created_at || check?.updated_at || '';
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function validateRequiredStatusChecks(checkRuns, requiredChecks, expectedSha) {
  const errors = [];
  for (const requirement of requiredChecks) {
    const { context, producer } = requirement;
    const sameName = checkRuns.filter((check) => check.name === context);
    const exactSha = sameName.filter((check) => check.head_sha === expectedSha);
    const fromProducer = exactSha.filter((check) => isExpectedProducer(check, producer));
    if (fromProducer.length === 0) {
      if (exactSha.length > 0) errors.push(`REQUIRED_CHECK_WRONG_PRODUCER:${context}`);
      else errors.push(`REQUIRED_CHECK_MISSING:${context}`);
      continue;
    }
    fromProducer.sort((a, b) => checkTimestamp(b) - checkTimestamp(a));
    const latest = fromProducer[0];
    if (latest.status !== 'completed' || latest.conclusion !== 'success') {
      errors.push(`REQUIRED_CHECK_NOT_SUCCESS:${context}:${latest.conclusion || latest.status || 'unknown'}`);
    }
  }
  return { passed: errors.length === 0, errors };
}

// GitGuardian's GitHub App issues PR check runs, not a new check on the merge commit.
// This fallback is deliberately narrower than ancestry: the checked PR head must be
// the merge's second parent and have the exact tree delivered by the merge commit.
function validateGitGuardianMergeEvidence({
  sourceSha, repository, mergeCommit, associatedPullRequests, headCommit, headCheckRuns, requirement,
}) {
  const errors = [];
  const parents = mergeCommit?.parents;
  const baseSha = parents?.[0]?.sha;
  const headSha = parents?.[1]?.sha;
  const mergeTree = mergeCommit?.commit?.tree?.sha;
  if (!isFullSha(sourceSha) || mergeCommit?.sha !== sourceSha || parents?.length !== 2
    || !isFullSha(baseSha) || !isFullSha(headSha) || !isFullSha(mergeTree)) {
    errors.push('GITGUARDIAN_MERGE_COMMIT_IDENTITY_INVALID');
  }
  if (requirement?.context !== 'GitGuardian Security Checks'
    || requirement?.producer?.kind !== 'EXTERNAL_APP'
    || requirement?.producer?.appName !== 'GitGuardian'
    || !Number.isInteger(requirement?.producer?.integrationId)) {
    errors.push('GITGUARDIAN_REQUIREMENT_INVALID');
  }
  if (errors.length) return { passed: false, errors };

  const matching = (Array.isArray(associatedPullRequests) ? associatedPullRequests : []).filter((pr) => (
    pr?.state === 'closed'
    && Boolean(pr.merged_at)
    && pr.merge_commit_sha === sourceSha
    && pr.base?.ref === 'main'
    && pr.base?.sha === baseSha
    && pr.head?.sha === headSha
    && pr.base?.repo?.full_name === repository
    && pr.head?.repo?.full_name === repository
  ));
  if (associatedPullRequests?.length !== 1 || matching.length !== 1
    || !Number.isInteger(matching[0]?.number) || matching[0].number < 1) {
    errors.push('GITGUARDIAN_MERGED_PR_NOT_UNIQUE_OR_MISMATCHED');
  }
  if (headCommit?.sha !== headSha || headCommit?.commit?.tree?.sha !== mergeTree) {
    errors.push('GITGUARDIAN_HEAD_TREE_MISMATCH');
  }
  const sameName = (Array.isArray(headCheckRuns) ? headCheckRuns : []).filter((check) => (
    check.name === requirement.context && check.head_sha === headSha
  ));
  const fromProducer = sameName.filter((check) => isExpectedProducer(check, requirement.producer));
  if (fromProducer.length === 0) {
    errors.push(sameName.length ? 'GITGUARDIAN_HEAD_CHECK_WRONG_PRODUCER' : 'GITGUARDIAN_HEAD_CHECK_MISSING');
  } else {
    fromProducer.sort((a, b) => checkTimestamp(b) - checkTimestamp(a));
    const latest = fromProducer[0];
    if (latest.status !== 'completed' || latest.conclusion !== 'success') {
      errors.push(`GITGUARDIAN_HEAD_CHECK_NOT_SUCCESS:${latest.conclusion || latest.status || 'unknown'}`);
    }
  }
  if (errors.length) return { passed: false, errors };
  return {
    passed: true,
    errors: [],
    pullRequestNumber: matching[0].number,
    headSha,
    checkRunId: fromProducer[0].id,
  };
}

function validateWorkflowQualification(workflowRuns, workflowPath, expectedSha) {
  const qualifies = workflowRuns.some((run) => (
    run.head_sha === expectedSha
    && run.path === workflowPath
    && run.event === 'push'
    && run.head_branch === 'main'
    && run.status === 'completed'
    && run.conclusion === 'success'
  ));
  return {
    passed: qualifies,
    errors: qualifies ? [] : ['QUALIFYING_WORKFLOW_RUN_MISSING'],
  };
}

function validateRequiredPolicy(requiredChecks, ruleset) {
  const registered = requiredChecks.filter((check) => check.required).map((check) => check.context).sort();
  const protectedContexts = ruleset?.current?.rules?.requiredStatusChecks?.contexts;
  if (!Array.isArray(protectedContexts)) return { passed: false, errors: ['MAIN_REQUIRED_CONTEXTS_MISSING'] };
  const protectedSorted = [...protectedContexts].sort();
  const matches = registered.length === protectedSorted.length
    && registered.every((context, index) => context === protectedSorted[index]);
  return {
    passed: matches,
    errors: matches ? [] : ['REQUIRED_CHECK_REGISTRY_RULESET_MISMATCH'],
  };
}

function validateJitsiServerUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return ['JITSI_URL_INVALID'];
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) {
    return ['JITSI_URL_MUST_BE_PUBLIC_HTTPS_BASE_URL'];
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.test')) {
    return ['JITSI_URL_MUST_NOT_USE_TEST_OR_LOCAL_HOST'];
  }
  if (hostname === 'meet.jit.si') return ['JITSI_URL_MUST_NOT_USE_PUBLIC_FALLBACK'];
  return [];
}

function compiledBundleContainsConfiguredJitsiUrl(compiledFiles, configuredUrl) {
  const normalized = String(configuredUrl || '').replace(/\/$/, '');
  return Boolean(normalized) && compiledFiles.some((content) => String(content).includes(normalized));
}

function validateJitsiCspHeader(header, configuredUrl) {
  let origin;
  try {
    origin = new URL(configuredUrl).origin;
  } catch {
    return ['JITSI_CSP_CONFIGURED_ORIGIN_INVALID'];
  }
  if (typeof header !== 'string') {
    return ['JITSI_CSP_CONFIGURED_ORIGIN_MISSING'];
  }
  const directives = header.split(';').map((directive) => directive.trim().split(/\s+/));
  const frameSources = directives.find(([name]) => name?.toLowerCase() === 'frame-src')?.slice(1) || [];
  if (!frameSources.some((source) => {
    try {
      return new URL(source).origin === origin;
    } catch {
      return false;
    }
  })) return ['JITSI_CSP_CONFIGURED_ORIGIN_MISSING'];

  const publicFallbackActive = frameSources.some((source) => {
    try {
      const parsed = new URL(source);
      return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'meet.jit.si';
    } catch {
      return false;
    }
  });
  if (publicFallbackActive) return ['JITSI_CSP_PUBLIC_FALLBACK_ACTIVE'];
  return [];
}

function ghJsonLines(args) {
  const stdout = execFileSync('gh', ['api', '--paginate', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!stdout.trim()) return [];
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
}

function main() {
  const sourceSha = process.env.APPLICATION_SOURCE_SHA || process.env.GITHUB_SHA;
  const errors = validateSourceSelection({
    eventName: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    workflowSha: process.env.GITHUB_SHA,
  });
  const registryPath = process.argv[2] || '.github/governance/checks-registry.json';
  const rulesetPath = process.argv[3] || '.github/governance/main-ruleset.json';
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const ruleset = JSON.parse(fs.readFileSync(rulesetPath, 'utf8'));
  const policy = validateRequiredPolicy(registry.requiredChecks, ruleset);
  errors.push(...policy.errors);
  if (!isFullSha(sourceSha)) errors.push('APPLICATION_SOURCE_SHA_INVALID');
  if (errors.length) throw new Error(errors.join('\n'));

  const repository = process.env.GITHUB_REPOSITORY;
  const checkRuns = ghJsonLines([
    `repos/${repository}/commits/${sourceSha}/check-runs?per_page=100`,
    '--jq', '.check_runs[]',
  ]);
  const requiredChecks = registry.requiredChecks.filter((check) => check.required);
  const checkGate = validateRequiredStatusChecks(checkRuns, requiredChecks, sourceSha);
  const missingGitGuardian = 'REQUIRED_CHECK_MISSING:GitGuardian Security Checks';
  const gitGuardianRequirement = requiredChecks.find((check) => check.context === 'GitGuardian Security Checks');
  if (checkGate.errors.includes(missingGitGuardian) && gitGuardianRequirement) {
    const mergeCommit = ghJsonLines([`repos/${repository}/commits/${sourceSha}`])[0];
    const associatedPullRequests = ghJsonLines([
      `repos/${repository}/commits/${sourceSha}/pulls?per_page=100`, '--jq', '.[]',
    ]);
    const headSha = mergeCommit?.parents?.[1]?.sha;
    const headCommit = isFullSha(headSha)
      ? ghJsonLines([`repos/${repository}/commits/${headSha}`])[0] : null;
    const headCheckRuns = isFullSha(headSha)
      ? ghJsonLines([`repos/${repository}/commits/${headSha}/check-runs?per_page=100`, '--jq', '.check_runs[]']) : [];
    const evidence = validateGitGuardianMergeEvidence({
      sourceSha, repository, mergeCommit, associatedPullRequests, headCommit, headCheckRuns,
      requirement: gitGuardianRequirement,
    });
    if (evidence.passed) {
      checkGate.errors.splice(checkGate.errors.indexOf(missingGitGuardian), 1);
      console.log(`GITGUARDIAN_PROOF_SCOPE=PR_HEAD_TREE_IDENTICAL_TO_MERGE`);
      console.log(`GITGUARDIAN_PR_NUMBER=${evidence.pullRequestNumber}`);
      console.log(`GITGUARDIAN_PR_HEAD_SHA=${evidence.headSha}`);
      console.log(`GITGUARDIAN_CHECK_RUN_ID=${evidence.checkRunId}`);
    } else {
      errors.push(...evidence.errors);
    }
  }
  errors.push(...checkGate.errors);

  const workflows = ghJsonLines([
    `repos/${repository}/actions/workflows?per_page=100`,
    '--jq', '.workflows[]',
  ]);
  const requiredWorkflowPaths = [...new Set(registry.requiredChecks
    .filter((check) => check.required && check.producer.kind === 'GITHUB_ACTIONS_WORKFLOW')
    .map((check) => check.producer.workflowPath))];
  for (const workflowPath of requiredWorkflowPaths) {
    const workflow = workflows.find((candidate) => candidate.path === workflowPath);
    if (!workflow) {
      errors.push(`REQUIRED_WORKFLOW_NOT_REGISTERED:${workflowPath}`);
      continue;
    }
    const runs = ghJsonLines([
      `repos/${repository}/actions/workflows/${workflow.id}/runs?head_sha=${sourceSha}&per_page=100`,
      '--jq', '.workflow_runs[]',
    ]);
    const gate = validateWorkflowQualification(runs, workflowPath, sourceSha);
    errors.push(...gate.errors.map((error) => `${error}:${workflowPath}`));
  }

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`SOURCE_SHA=${sourceSha}`);
  console.log(`REQUIRED_CHECKS=${registry.requiredChecks.filter((check) => check.required).length}`);
  console.log('SOURCE_WORKFLOWS=QUALIFIED');
  console.log('SOURCE_EVIDENCE=ALL_REQUIRED_QUALIFIED');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`SOURCE_CHECK_GATES_FAILED:${error instanceof Error ? error.message : 'unknown'}`);
    process.exitCode = 1;
  }
}

module.exports = {
  validateSourceSelection,
  validateRequiredStatusChecks,
  validateGitGuardianMergeEvidence,
  validateWorkflowQualification,
  validateRequiredPolicy,
  validateJitsiServerUrl,
  compiledBundleContainsConfiguredJitsiUrl,
  validateJitsiCspHeader,
};
