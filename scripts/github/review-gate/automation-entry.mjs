import { fileURLToPath } from 'node:url';
import { safeArmAutoMerge, safeUpdateBranch } from './automation.mjs';
import { evaluateDeterministicGate } from './policy.mjs';
import { applicableHumanApproval, classifyRisk } from './risk.mjs';

const SHA = /^[0-9a-f]{40}$/;
const REPO = 'cyranoaladin/nexus-project_v0';

export async function automateAfterGate({ expectedHeadSha, prNumber, checkRunId,
  readCheck, readPr, compare, updateBranch,
  armAutoMerge = safeArmAutoMerge, recheckEvidence, graphql } = {}) {
  if (!SHA.test(expectedHeadSha ?? '') || !Number.isSafeInteger(prNumber) || prNumber <= 0 ||
      !Number.isSafeInteger(checkRunId) || checkRunId <= 0 ||
      [readCheck, readPr, compare, updateBranch, armAutoMerge, recheckEvidence]
        .some((fn) => typeof fn !== 'function')) {
    throw new Error('AUTOMATION_CONFIG_INVALID');
  }
  const check = await readCheck(checkRunId);
  if (check?.id !== checkRunId || check.name !== 'Nexus Review Gate' ||
      check.head_sha !== expectedHeadSha || check.status !== 'completed' ||
      check.conclusion !== 'success' || check.app?.id !== 5166727 ||
      check.app.slug !== 'nexus-review-gate') throw new Error('GATE_CHECK_UNQUALIFIED');
  const pr = await readPr();
  if (pr?.number !== prNumber || pr.state !== 'open' || pr.draft !== false ||
      pr.head?.sha !== expectedHeadSha || pr.base?.ref !== 'main' ||
      !SHA.test(pr.base?.sha ?? '')) throw new Error('PR_STALE_OR_INELIGIBLE');
  const relation = await compare(pr.base.sha, expectedHeadSha);
  if (!Number.isSafeInteger(relation?.behind_by) || relation.behind_by < 0) {
    throw new Error('BRANCH_RELATION_INVALID');
  }
  if (relation.behind_by > 0) {
    return safeUpdateBranch({ expectedHeadSha, observedBaseSha: pr.base.sha,
      behindBy: relation.behind_by, readPr,
      update: (number, body) => updateBranch({ prNumber: number,
        expectedHeadSha: body.expected_head_sha, observedBaseSha: pr.base.sha,
        behindBy: relation.behind_by }),
    });
  }
  if (await recheckEvidence(prNumber, expectedHeadSha, pr.base.sha) !== true) {
    throw new Error('GATE_EVIDENCE_STALE');
  }
  return armAutoMerge({ expectedHeadSha, gateConclusion: 'success', readPr, graphql });
}

export function validPostGateEvidence(evidence, { prNumber, expectedHeadSha, baseSha } = {}) {
  if (evidence?.prNumber !== prNumber || evidence.reviewedHeadSha !== expectedHeadSha ||
      evidence.reviewedBaseSha !== baseSha ||
      evaluateDeterministicGate(evidence).passed !== true ||
      evidence.threadsComplete !== true || evidence.reviewsComplete !== true ||
      evidence.unresolvedReviewThreads !== 0 || evidence.applicableChangesRequested !== 0) return false;
  const risk = classifyRisk(evidence.files);
  if (risk.classification === 'UNCLASSIFIED') return false;
  if (risk.humanExceptionRequired && !applicableHumanApproval({ headSha: expectedHeadSha,
    reviews: evidence.reviews, reviewsComplete: true }).approved) return false;
  return true;
}

export async function runPostGateAutomation(env = process.env) {
  if (env.GITHUB_REPOSITORY !== REPO || env.GITHUB_REF !== 'refs/heads/main' ||
      env.GITHUB_EVENT_NAME !== 'workflow_run' || !SHA.test(env.GITHUB_SHA ?? '') ||
      !env.GITHUB_TOKEN) throw new Error('AUTOMATION_CONTEXT_UNTRUSTED');
  // GITHUB_TOKEN-created update-branch/auto-merge events do not reliably
  // trigger the required fresh CI on the new head or main merge. The
  // checks-only App token cannot perform either mutation. Keep the tested
  // policy helpers dormant until a separately scoped, audited mutation
  // identity exists; never silently arm an unsafe merge path.
  throw new Error('AUTOMATION_MUTATION_TOKEN_UNAVAILABLE');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const outcome = await runPostGateAutomation();
    process.stdout.write(`NEXUS_POST_GATE_AUTOMATION=${outcome}\n`);
  } catch (error) {
    process.stderr.write(`NEXUS_POST_GATE_AUTOMATION_FAILED=${error?.message ?? 'UNKNOWN'}\n`);
    process.exitCode = 1;
  }
}
