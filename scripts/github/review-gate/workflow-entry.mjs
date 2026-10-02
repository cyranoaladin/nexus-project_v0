import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGateClients } from './api.mjs';
import { collectGateEvidence, rereadGateRefs } from './collect.mjs';
import { runTrustedWorkflow } from './operate.mjs';
import { publishGateCheck } from './publish.mjs';
import { evaluateWithFreshEvidence } from './run.mjs';
import { runThreePassReview } from './model-runner.mjs';
import { loadQualifiedAuthority } from './qualification/authority.mjs';
import { cleanupQualifiedRuntime, prepareQualifiedRuntime } from './qualification/runtime.mjs';
import { resolve } from 'node:path';

const SHA = /^[0-9a-f]{40}$/;
const REPO = 'cyranoaladin/nexus-project_v0';

export function validateTrustedWorkflowContext({ repository, ref, eventName,
  workflowSha, checkoutSha, event } = {}) {
  const run = event?.workflow_run;
  if (repository !== REPO || ref !== 'refs/heads/main' ||
      eventName !== 'workflow_run' || event?.action !== 'completed' ||
      !SHA.test(workflowSha ?? '') || checkoutSha !== workflowSha ||
      !Number.isSafeInteger(run?.id) || run.id <= 0 ||
      !Number.isSafeInteger(run?.run_attempt) || run.run_attempt <= 0 ||
      !SHA.test(run?.head_sha ?? '') || run.event !== 'pull_request') {
    throw new Error('UNTRUSTED_WORKFLOW_CONTEXT');
  }
  return { runId: run.id, attempt: run.run_attempt, expectedHeadSha: run.head_sha };
}

/**
 * This entry point is executed only from main by workflow_run. The App token
 * can create/update its check; all other GitHub evidence uses GITHUB_TOKEN.
 */
export async function executeTrustedWorkflow({ env = process.env,
  readEvent = () => JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')),
  checkoutSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  clientsFactory = createGateClients,
} = {}) {
  const context = validateTrustedWorkflowContext({
    repository: env.GITHUB_REPOSITORY, ref: env.GITHUB_REF,
    eventName: env.GITHUB_EVENT_NAME, workflowSha: env.GITHUB_SHA,
    checkoutSha: checkoutSha(), event: readEvent(),
  });
  if (env.NEXUS_REVIEW_GATE_APP_ID !== '5166727' ||
      env.APP_INSTALLATION_ID !== '167301397') {
    throw new Error('APP_INSTALLATION_UNEXPECTED');
  }
  const clients = clientsFactory({ readToken: env.GITHUB_TOKEN, appToken: env.APP_TOKEN });
  const repoPath = `/repos/${REPO}`;
  const upstreamRun = await clients.readApi(`${repoPath}/actions/runs/${context.runId}`);
  const associatedPrs = await clients.readApi(`${repoPath}/commits/${context.expectedHeadSha}/pulls?per_page=100`);
  const result = await runTrustedWorkflow({
    upstreamRun, associatedPrs, runId: context.runId, attempt: context.attempt,
    expectedSha: context.expectedHeadSha,
    evaluate: async (prNumber) => {
      const authority = loadQualifiedAuthority(process.cwd());
      let prepared;
      try {
        return await evaluateWithFreshEvidence({
          collect: () => collectGateEvidence({ repo: REPO, prNumber,
            readApi: clients.readApi, readGraphql: clients.readGraphql }),
          runSemantic: async (evidence) => {
            if (!authority) throw new Error('MODEL_UNQUALIFIED');
            prepared = await prepareQualifiedRuntime({ candidate: authority.candidate,
              runtime: authority.runtime, runnerTemp: env.RUNNER_TEMP });
            return runThreePassReview({ headSha: evidence.reviewedHeadSha,
              files: evidence.files, modelPath: prepared.modelPath,
              binaryPath: prepared.binaryPath,
              schemaPath: resolve('scripts/github/review-gate/qualification/review-output.schema.json'),
              contextTokens: authority.candidate.contextTokens });
          },
          reread: ({ expectedHeadSha, expectedBaseSha }) => rereadGateRefs({ repo: REPO,
            prNumber, readApi: clients.readApi, expectedHeadSha, expectedBaseSha }),
          qualifiedModel: Boolean(authority),
        });
      } finally {
        if (prepared) await cleanupQualifiedRuntime(prepared.root, env.RUNNER_TEMP);
      }
    },
    rereadBeforePublish: (prNumber) => clients.readApi(`${repoPath}/pulls/${prNumber}`),
    publish: ({ headSha, conclusion, reason }) => publishGateCheck({ headSha,
      conclusion, reason, create: clients.createCheck, update: clients.updateCheck,
      read: clients.readCheck }),
  });
  // Never log PR content, reviews, tokens, model output or the event payload.
  return { reason: result.reason, conclusion: result.conclusion,
    checkRunId: result.check.checkRunId, checkHeadSha: result.check.headSha,
    prNumber: result.prNumber };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = await executeTrustedWorkflow();
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT,
        `conclusion=${result.conclusion}\npr_number=${result.prNumber}\nhead_sha=${result.checkHeadSha}\ncheck_run_id=${result.checkRunId}\n`);
    }
    process.stdout.write(`NEXUS_REVIEW_GATE=${result.conclusion} REASON=${result.reason} CHECK_RUN_ID=${result.checkRunId} CHECK_HEAD_SHA=${result.checkHeadSha}\n`);
  } catch (error) {
    process.stderr.write(`NEXUS_REVIEW_GATE_WORKFLOW_FAILED=${error?.message ?? 'UNKNOWN'}\n`);
    process.exitCode = 1;
  }
}
