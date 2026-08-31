import { parseWorkflowFile } from './yaml-workflows.mjs';

const PR_HEAD_REF = '${{ github.event.pull_request.head.sha || github.sha }}';
const RUN_ATTEMPT = '${{ github.run_attempt }}';
const MATRIX_RUN = 'npm run ${{ matrix.script }}';
const MATRIX_ARTIFACT_PATH = '${{ matrix.artifactPath }}/';
const RAG_CONTRACT_LANE_IF = "${{ matrix.lane == 'contracts' }}";
const RAG_COMPANION_PATH = '.aria-rag-contract-producer';
const RAG_REPOSITORY_OUTPUT = '${{ steps.rag-lock.outputs.producer_repository }}';
const RAG_COMMIT_OUTPUT = '${{ steps.rag-lock.outputs.producer_commit }}';

function lane(laneName, script, artifactPath = `.artifacts/aria/ci/${laneName}`) {
  return Object.freeze({ lane: laneName, script, artifactPath });
}

export const ARIA_CI_MATRIX_JOBS = Object.freeze({
  'aria-jest': Object.freeze([
    lane('unit', 'test:aria:unit'),
    lane('api', 'test:aria:api'),
    lane('integration', 'test:aria:integration'),
    lane('sse', 'test:aria:sse'),
    lane('architecture', 'test:aria:architecture'),
  ]),
  'aria-postgres': Object.freeze([
    lane('db', 'test:aria:db'),
    lane('concurrency', 'test:aria:concurrency'),
    lane('migrations', 'test:aria:migrations'),
    lane('backfills', 'test:aria:backfills'),
  ]),
  'aria-static': Object.freeze([
    lane('enum-drift', 'aria:enum-drift'),
    lane('scripts-typecheck', 'typecheck:aria-scripts'),
    lane('security', 'aria:security'),
    lane('manifest', 'aria:manifest:check'),
    lane('contracts', 'aria:contracts:check'),
    lane('resource-registry', 'aria:resource-registry:check'),
    lane('performance', 'aria:performance:check'),
    lane('reachability', 'aria:reachability'),
    lane('integrity', 'aria:integrity'),
    lane('zero-test-debt', 'test:zero-debt'),
    lane('evaluation-contract', 'aria:evaluate:check'),
    lane('source-artifact', 'aria:artifact:source-check'),
  ]),
  'aria-browser': Object.freeze([
    lane('desktop', 'test:aria:e2e:desktop', '.artifacts/aria'),
    lane('mobile', 'test:aria:e2e:mobile', '.artifacts/aria'),
    lane('a11y', 'test:aria:a11y', '.artifacts/aria'),
    lane('smoke', 'aria:smoke:production-artifact', '.artifacts/aria'),
  ]),
});

const SPECIAL_JOBS = Object.freeze({
  'aria-coverage': Object.freeze({
    commands: Object.freeze(['npm run test:aria:coverage', 'npm run aria:coverage:check']),
    artifactName: `aria-coverage-${PR_HEAD_REF}-${RUN_ATTEMPT}`,
    artifactPath: '.artifacts/aria/coverage/',
  }),
  'aria-evidence': Object.freeze({
    commands: Object.freeze(['npm run aria:test-evidence:jest', 'npm run aria:test-plan:check']),
    artifactName: `aria-evidence-${PR_HEAD_REF}-${RUN_ATTEMPT}`,
    artifactPath: '.artifacts/aria/qualification/',
  }),
});

export const ARIA_CI_QUALIFICATION_JOBS = Object.freeze([
  ...Object.keys(ARIA_CI_MATRIX_JOBS),
  ...Object.keys(SPECIAL_JOBS),
]);

function checkoutStep(job) {
  return (job?.steps ?? []).find((step) =>
    typeof step?.uses === 'string' && step.uses.startsWith('actions/checkout@'));
}

function uploadSteps(job) {
  return (job?.steps ?? []).filter((step) =>
    typeof step?.uses === 'string' && step.uses.startsWith('actions/upload-artifact@'));
}

function exactRunSteps(job, command) {
  return (job?.steps ?? []).filter((step) => step?.run === command);
}

function inspectCommonJob(jobKey, job, findings) {
  if (!job) {
    findings.push(`ARIA_CI_JOB_MISSING:${jobKey}`);
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(job, 'if')) findings.push(`ARIA_CI_JOB_CONDITIONAL:${jobKey}`);
  if (job?.['continue-on-error'] === true
    || (job.steps ?? []).some((step) => step?.['continue-on-error'] === true)) {
    findings.push(`ARIA_CI_CONTINUE_ON_ERROR:${jobKey}`);
  }
  const checkout = checkoutStep(job);
  if (checkout?.with?.ref !== PR_HEAD_REF || checkout?.with?.['fetch-depth'] !== 0) {
    findings.push(`ARIA_CI_HEAD_CHECKOUT_UNSEALED:${jobKey}`);
  }
  return true;
}

function inspectArtifact(jobKey, job, expectedName, expectedPath, findings) {
  const uploads = uploadSteps(job);
  if (uploads.length !== 1) {
    findings.push(`ARIA_CI_ARTIFACT_STEP_COUNT:${jobKey}:${uploads.length}`);
    return;
  }
  const [upload] = uploads;
  if (upload.if !== 'always()') findings.push(`ARIA_CI_ARTIFACT_NOT_ALWAYS:${jobKey}`);
  if (upload.with?.['if-no-files-found'] !== 'error') {
    findings.push(`ARIA_CI_ARTIFACT_MISSING_NOT_FATAL:${jobKey}`);
  }
  if (upload.with?.name !== expectedName) findings.push(`ARIA_CI_ARTIFACT_NAME_UNSEALED:${jobKey}`);
  if (upload.with?.path !== expectedPath) findings.push(`ARIA_CI_ARTIFACT_PATH_UNSCOPED:${jobKey}`);
}

function inspectMatrixJob(jobKey, job, expectedLanes, findings) {
  if (!inspectCommonJob(jobKey, job, findings)) return;
  if (job?.strategy?.['fail-fast'] !== false) findings.push(`ARIA_CI_MATRIX_FAIL_FAST:${jobKey}`);
  const matrix = job?.strategy?.matrix;
  const include = matrix && Object.keys(matrix).length === 1 && Array.isArray(matrix.include)
    ? matrix.include
    : null;
  if (!include || JSON.stringify(include) !== JSON.stringify(expectedLanes)) {
    findings.push(`ARIA_CI_MATRIX_CONTRACT_MISMATCH:${jobKey}`);
  }
  const protectedSteps = exactRunSteps(job, MATRIX_RUN);
  if (protectedSteps.length !== 1) findings.push(`ARIA_CI_COMMAND_STEP_INVALID:${jobKey}`);
  if (protectedSteps.some((step) => Object.prototype.hasOwnProperty.call(step, 'if'))) {
    findings.push(`ARIA_CI_PROTECTED_STEP_CONDITIONAL:${jobKey}`);
  }
  inspectArtifact(
    jobKey,
    job,
    `aria-${jobKey.slice('aria-'.length)}-${'${{ matrix.lane }}'}-${PR_HEAD_REF}-${RUN_ATTEMPT}`,
    MATRIX_ARTIFACT_PATH,
    findings,
  );
}

function inspectRagCompanionProvisioning(job, findings) {
  const steps = job?.steps ?? [];
  const resolver = steps.filter((step) => step?.id === 'rag-lock');
  const checkouts = steps.filter((step) =>
    typeof step?.uses === 'string' && step.uses.startsWith('actions/checkout@'));
  const companions = checkouts.filter((step) => step?.with?.path === RAG_COMPANION_PATH);
  const [companion] = companions;
  if (
    resolver.length !== 1
    || resolver[0]?.if !== RAG_CONTRACT_LANE_IF
    || resolver[0]?.run !== 'node scripts/aria/emit-rag-contract-lock.mjs'
    || checkouts.length !== 2
    || companions.length !== 1
    || companion?.if !== RAG_CONTRACT_LANE_IF
    || companion?.with?.repository !== RAG_REPOSITORY_OUTPUT
    || companion?.with?.ref !== RAG_COMMIT_OUTPUT
    || companion?.with?.['fetch-depth'] !== 1
    || companion?.with?.['persist-credentials'] !== false
  ) {
    findings.push('ARIA_CI_RAG_COMPANION_PROVISIONING_INVALID');
  }
  const commands = exactRunSteps(job, MATRIX_RUN);
  if (
    commands.length !== 1
    || JSON.stringify(commands[0]?.env) !== JSON.stringify({
      ARIA_RAG_WORKTREE: '${{ github.workspace }}/.aria-rag-contract-producer',
      ARIA_RAG_EXPECTED_SHA: RAG_COMMIT_OUTPUT,
    })
  ) {
    findings.push('ARIA_CI_RAG_COMPANION_ENV_INVALID');
  }
}

function inspectSpecialJob(jobKey, job, expected, findings) {
  if (!inspectCommonJob(jobKey, job, findings)) return;
  if (job?.strategy?.matrix !== undefined) findings.push(`ARIA_CI_UNEXPECTED_MATRIX:${jobKey}`);
  for (const command of expected.commands) {
    const steps = exactRunSteps(job, command);
    if (steps.length !== 1) findings.push(`ARIA_CI_COMMAND_STEP_INVALID:${jobKey}:${command}`);
    if (steps.some((step) => Object.prototype.hasOwnProperty.call(step, 'if'))) {
      findings.push(`ARIA_CI_PROTECTED_STEP_CONDITIONAL:${jobKey}`);
    }
  }
  inspectArtifact(jobKey, job, expected.artifactName, expected.artifactPath, findings);
}

export function loadWorkflow(path) {
  return parseWorkflowFile(path);
}

export function inspectAriaCiWorkflow(document) {
  const findings = [];
  const pullRequest = document?.on?.pull_request;
  if (!pullRequest || typeof pullRequest !== 'object') {
    findings.push('ARIA_CI_PULL_REQUEST_TRIGGER_MISSING');
  } else if (Object.prototype.hasOwnProperty.call(pullRequest, 'paths')
    || Object.prototype.hasOwnProperty.call(pullRequest, 'paths-ignore')) {
    findings.push('ARIA_CI_PULL_REQUEST_PATH_FILTERED');
  }

  for (const [jobKey, expectedLanes] of Object.entries(ARIA_CI_MATRIX_JOBS)) {
    inspectMatrixJob(jobKey, document?.jobs?.[jobKey], expectedLanes, findings);
  }
  inspectRagCompanionProvisioning(document?.jobs?.['aria-static'], findings);
  for (const [jobKey, expected] of Object.entries(SPECIAL_JOBS)) {
    inspectSpecialJob(jobKey, document?.jobs?.[jobKey], expected, findings);
  }

  const evidenceNeeds = document?.jobs?.['aria-evidence']?.needs;
  if (!Array.isArray(evidenceNeeds)
    || !['aria-jest', 'aria-postgres', 'aria-browser'].every((job) => evidenceNeeds.includes(job))) {
    findings.push('ARIA_CI_EVIDENCE_DEPENDENCIES_INVALID');
  }
  const download = (document?.jobs?.['aria-evidence']?.steps ?? []).find((step) =>
    typeof step?.uses === 'string' && step.uses.startsWith('actions/download-artifact@'));
  if (download?.with?.pattern !== `aria-browser-*-${PR_HEAD_REF}-${RUN_ATTEMPT}`
    || download?.with?.path !== '.artifacts/aria'
    || download?.with?.['merge-multiple'] !== true) {
    findings.push('ARIA_CI_EVIDENCE_DOWNLOAD_INVALID');
  }

  const aggregate = document?.jobs?.['ci-success'];
  const needs = Array.isArray(aggregate?.needs) ? aggregate.needs : [];
  for (const jobKey of ARIA_CI_QUALIFICATION_JOBS) {
    if (!needs.includes(jobKey)) findings.push(`ARIA_CI_AGGREGATE_NEED_MISSING:${jobKey}`);
  }
  const assertionSteps = (aggregate?.steps ?? []).filter((step) =>
    step?.run === 'node scripts/github/assert-ci-needs.mjs'
    && step?.env?.CI_NEEDS_JSON === '${{ toJSON(needs) }}');
  if (assertionSteps.length !== 1) findings.push('ARIA_CI_AGGREGATE_ASSERTION_INVALID');

  return Object.freeze({ ok: findings.length === 0, findings: Object.freeze(findings) });
}
