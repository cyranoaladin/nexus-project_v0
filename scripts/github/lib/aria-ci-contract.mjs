import { parseWorkflowFile } from './yaml-workflows.mjs';
import { readFileSync } from 'node:fs';
import { inspectNativeCiWorkflow } from '../../testing/ci-native-workflow-contract.mjs';

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
    lane('desktop', 'test:aria:e2e:desktop', '.artifacts/aria/playwright/aria-desktop'),
    lane('mobile', 'test:aria:e2e:mobile', '.artifacts/aria/playwright/aria-mobile'),
    lane('a11y', 'test:aria:a11y', '.artifacts/aria/playwright/aria-a11y'),
    lane('smoke', 'aria:smoke:production-artifact', '.artifacts/aria/playwright/aria-smoke'),
  ]),
});

const SPECIAL_JOBS = Object.freeze({
  'aria-coverage': Object.freeze({
    commands: Object.freeze(['npm run test:aria:coverage', 'npm run aria:coverage:check']),
    artifactName: `aria-coverage-${PR_HEAD_REF}-${RUN_ATTEMPT}`,
    artifactPath: '.artifacts/aria/coverage/',
  }),
  'aria-evidence': Object.freeze({
    commands: Object.freeze([
      'npm run aria:test-evidence:jest',
      'npm run aria:visual-evidence:check',
      'npm run aria:test-plan:check',
    ]),
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

function inspectArtifact(jobKey, job, expectedName, expectedPath, findings, sealAction) {
  if(jobKey!=='aria-static'){
    const seals=(job?.steps??[]).filter(step=>step.uses==='./.github/actions/seal-native-test-evidence');
    const raw=uploadSteps(job);
    if(seals.length!==1||raw.length){findings.push(`ARIA_CI_ARTIFACT_STEP_COUNT:${jobKey}:${seals.length+raw.length}`);return;}
    const seal=seals[0],derived=jobKey==='aria-evidence';
    if(seal.if!=='always()')findings.push(`ARIA_CI_ARTIFACT_NOT_ALWAYS:${jobKey}`);
    if(seal.with?.['producer-label']!==(derived?'aria-evidence':'${{ env.NEXUS_CI_EVIDENCE_LABEL }}'))findings.push(`ARIA_CI_ARTIFACT_NAME_UNSEALED:${jobKey}`);
    const attachments=jobKey==='aria-browser'?'${{ github.workspace }}/.artifacts/aria':jobKey==='aria-coverage'?'${{ github.workspace }}/.artifacts/aria/coverage':derived?'${{ github.workspace }}/.artifacts/aria/qualification':undefined;
    if(seal.with?.['attachment-root']!==attachments||seal.with?.['evidence-kind']!==(derived?'attachments':undefined))findings.push(`ARIA_CI_ARTIFACT_PATH_UNSCOPED:${jobKey}`);
    const uploads=uploadSteps(sealAction?.runs),upload=uploads[0];
    if(uploads.length!==1||upload?.with?.['if-no-files-found']!=='error')findings.push(`ARIA_CI_ARTIFACT_MISSING_NOT_FATAL:${jobKey}`);
    if(upload?.with?.name!=='corev2-private-${{ github.run_id }}-${{ github.run_attempt }}-${{ inputs.producer-label }}')findings.push(`ARIA_CI_ARTIFACT_NAME_UNSEALED:${jobKey}`);
    if(upload?.with?.path!=='${{ runner.temp }}/nexus-sealed/payload.gpg\n${{ runner.temp }}/nexus-sealed/manifest.json\n')findings.push(`ARIA_CI_ARTIFACT_PATH_UNSCOPED:${jobKey}`);
    const attestation=(sealAction?.runs?.steps??[]).filter(step=>step.uses==='actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8'
      &&step.with?.['subject-name']==='payload.gpg'&&step.with?.['subject-digest']==='sha256:${{ steps.private-seal.outputs.cipher-sha256 }}');
    if(attestation.length!==1)findings.push(`ARIA_CI_CIPHERTEXT_ATTESTATION_INVALID:${jobKey}`);
    return;
  }
  const allUploads = uploadSteps(job);
  // The unified Core+ARIA execution aggregate consumes a separate, exact-run
  // envelope. Keep the original ARIA artifact contract intact; permit only
  // this precisely scoped additional export, not arbitrary extra uploads.
  const executionUploads = jobKey === 'aria-browser' ? allUploads.filter(step =>
    step.with?.name === `e2e-execution-aria-${'${{ matrix.lane }}'}-${PR_HEAD_REF}-${'${{ github.run_id }}'}-${RUN_ATTEMPT}`
    && step.with?.path === 'e2e-execution/'
    && step.if === 'always()'
    && step.with?.['if-no-files-found'] === 'error') : [];
  const uploads = executionUploads.length === 1
    ? allUploads.filter(step => step !== executionUploads[0]) : allUploads;
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

function inspectMatrixJob(jobKey, job, expectedLanes, findings, sealAction) {
  if (!inspectCommonJob(jobKey, job, findings)) return;
  if (job?.strategy?.['fail-fast'] !== false) findings.push(`ARIA_CI_MATRIX_FAIL_FAST:${jobKey}`);
  const matrix = job?.strategy?.matrix;
  const include = matrix && Object.keys(matrix).length === 1 && Array.isArray(matrix.include)
    ? matrix.include
    : null;
  if (!include || JSON.stringify(include) !== JSON.stringify(expectedLanes)) {
    findings.push(`ARIA_CI_MATRIX_CONTRACT_MISMATCH:${jobKey}`);
  }
  const protectedCommand=jobKey==='aria-static'?MATRIX_RUN:jobKey==='aria-browser'?'node scripts/testing/run-test-lane.mjs pw-aria-aria-${{ matrix.lane }}':'node scripts/testing/run-test-lane.mjs jest-aria-${{ matrix.lane }}';
  const protectedSteps = exactRunSteps(job, protectedCommand);
  if (protectedSteps.length !== 1) findings.push(`ARIA_CI_COMMAND_STEP_INVALID:${jobKey}`);
  if (protectedSteps.some((step) => Object.prototype.hasOwnProperty.call(step, 'if'))) {
    findings.push(`ARIA_CI_PROTECTED_STEP_CONDITIONAL:${jobKey}`);
  }
  if (jobKey === 'aria-browser') {
    const publishers = exactRunSteps(job, 'node scripts/testing/safe-playwright-report.mjs ${{ matrix.artifactPath }}/report.json .artifacts/publish/aria-${{ matrix.lane }}/report.json');
    if (publishers.length !== 1 || publishers[0]?.if !== 'always()') {
      findings.push('ARIA_CI_BROWSER_PRIVACY_PUBLISHER_INVALID');
    }
  }
  inspectArtifact(
    jobKey,
    job,
    `aria-${jobKey.slice('aria-'.length)}-${'${{ matrix.lane }}'}-${PR_HEAD_REF}-${RUN_ATTEMPT}`,
    jobKey === 'aria-browser' ? '.artifacts/publish/aria-${{ matrix.lane }}/' : MATRIX_ARTIFACT_PATH,
    findings,
    sealAction,
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
    || resolver[0]?.run !== 'npm run aria:contracts:lock:emit'
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

function inspectSpecialJob(jobKey, job, expected, findings, sealAction) {
  if (!inspectCommonJob(jobKey, job, findings)) return;
  if (job?.strategy?.matrix !== undefined) findings.push(`ARIA_CI_UNEXPECTED_MATRIX:${jobKey}`);
  for (const command of expected.commands) {
    const steps = exactRunSteps(job, command);
    if (steps.length !== 1) findings.push(`ARIA_CI_COMMAND_STEP_INVALID:${jobKey}:${command}`);
    if (steps.some((step) => Object.prototype.hasOwnProperty.call(step, 'if'))) {
      findings.push(`ARIA_CI_PROTECTED_STEP_CONDITIONAL:${jobKey}`);
    }
  }
  inspectArtifact(jobKey, job, expected.artifactName, expected.artifactPath, findings, sealAction);
}

export function loadWorkflow(path) {
  return parseWorkflowFile(path);
}

export function inspectAriaCiWorkflow(document,{sealAction=parseWorkflowFile(new URL('../../../.github/actions/seal-native-test-evidence/action.yml',import.meta.url))}={}) {
  const findings = [];
  const pullRequest = document?.on?.pull_request;
  if (!pullRequest || typeof pullRequest !== 'object') {
    findings.push('ARIA_CI_PULL_REQUEST_TRIGGER_MISSING');
  } else if (Object.prototype.hasOwnProperty.call(pullRequest, 'paths')
    || Object.prototype.hasOwnProperty.call(pullRequest, 'paths-ignore')) {
    findings.push('ARIA_CI_PULL_REQUEST_PATH_FILTERED');
  }

  for (const [jobKey, expectedLanes] of Object.entries(ARIA_CI_MATRIX_JOBS)) {
    inspectMatrixJob(jobKey, document?.jobs?.[jobKey], expectedLanes, findings, sealAction);
  }
  inspectRagCompanionProvisioning(document?.jobs?.['aria-static'], findings);
  for (const [jobKey, expected] of Object.entries(SPECIAL_JOBS)) {
    inspectSpecialJob(jobKey, document?.jobs?.[jobKey], expected, findings, sealAction);
  }

  const evidenceNeeds = document?.jobs?.['aria-evidence']?.needs;
  if (!Array.isArray(evidenceNeeds)
    || !['aria-jest', 'aria-postgres', 'aria-browser'].every((job) => evidenceNeeds.includes(job))) {
    findings.push('ARIA_CI_EVIDENCE_DEPENDENCIES_INVALID');
  }
  const evidenceSteps=document?.jobs?.['aria-evidence']?.steps??[];
  const selection='aria-jest-unit,aria-jest-api,aria-jest-integration,aria-jest-sse,aria-jest-architecture,aria-postgres-db,aria-postgres-concurrency,aria-browser-aria-desktop,aria-browser-aria-mobile,aria-browser-aria-a11y,aria-browser-aria-smoke';
  const validDownloads=evidenceSteps.filter(step=>step.run===`node scripts/testing/ci-private-evidence.mjs fetch-reports ${selection} "$RUNNER_TEMP/verified-native"`
    &&step.env?.GH_TOKEN==='${{ github.token }}'&&step.env?.NEXUS_CI_EVIDENCE_PRIVATE_KEY==='${{ secrets.CORE_V2_PROOF_346_KEY }}'&&!step.if).length===1
    &&!evidenceSteps.some(step=>step.uses?.startsWith('actions/download-artifact@'))
    &&document.jobs['aria-evidence'].env?.NEXUS_TEST_ARIA_REPORTS_DIR==='${{ runner.temp }}/verified-native/reports';
  if (!validDownloads) findings.push('ARIA_CI_EVIDENCE_DOWNLOAD_INVALID');

  const aggregate = document?.jobs?.['ci-success'];
  const needs = Array.isArray(aggregate?.needs) ? aggregate.needs : [];
  for (const jobKey of ARIA_CI_QUALIFICATION_JOBS) {
    if (!needs.includes(jobKey)) findings.push(`ARIA_CI_AGGREGATE_NEED_MISSING:${jobKey}`);
  }
  const assertionSteps = (aggregate?.steps ?? []).filter((step) =>
    step?.run === 'node scripts/github/assert-ci-needs.mjs'
    && step?.env?.CI_NEEDS_JSON === '${{ toJSON(needs) }}');
  if (assertionSteps.length !== 1) findings.push('ARIA_CI_AGGREGATE_ASSERTION_INVALID');
  const registry=JSON.parse(readFileSync(new URL('../../../.github/governance/test-lanes.json',import.meta.url),'utf8'));
  const producers=JSON.parse(readFileSync(new URL('../../../.github/governance/ci-test-producers.json',import.meta.url),'utf8')).producers;
  findings.push(...inspectNativeCiWorkflow(document,registry,producers).blockers);

  return Object.freeze({ ok: findings.length === 0, findings: Object.freeze(findings) });
}
