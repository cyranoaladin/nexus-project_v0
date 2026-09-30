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
    const expectedApp = producer.kind === 'EXTERNAL_APP' ? producer.appName : 'GitHub Actions';
    const fromProducer = exactSha.filter((check) => getProducerName(check) === expectedApp);
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
  return stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
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
  const checkGate = validateRequiredStatusChecks(
    checkRuns,
    registry.requiredChecks.filter((check) => check.required),
    sourceSha,
  );
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
  console.log('SOURCE_CHECKS=ALL_REQUIRED_SUCCESS');
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
  validateWorkflowQualification,
  validateRequiredPolicy,
  validateJitsiServerUrl,
  compiledBundleContainsConfiguredJitsiUrl,
  validateJitsiCspHeader,
};
