import { fileURLToPath } from 'node:url';
import { safeArmAutoMerge, safeUpdateBranch } from './automation.mjs';
import { collectGateEvidence } from './collect.mjs';
import { evaluateDeterministicGate } from './policy.mjs';
import { applicableHumanApproval, classifyRisk } from './risk.mjs';

const SHA = /^[0-9a-f]{40}$/;
const REPO = 'cyranoaladin/nexus-project_v0';
const API = 'https://api.github.com';

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

async function request(token, path, { method = 'GET', body } = {}) {
  if (!token || !path.startsWith('/') || path.startsWith('//') || /[\r\n#]/.test(path)) {
    throw new Error('AUTOMATION_API_CONFIG_INVALID');
  }
  let response;
  try {
    response = await fetch(`${API}${path}`, { method,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch { throw new Error('AUTOMATION_API_UNAVAILABLE'); }
  if (!response.ok) throw new Error(`AUTOMATION_API_HTTP_${response.status}`);
  try { return await response.json(); } catch { throw new Error('AUTOMATION_API_RESPONSE_INVALID'); }
}

export async function runPostGateAutomation(env = process.env) {
  const prNumber = Number(env.GATE_PR_NUMBER);
  const checkRunId = Number(env.GATE_CHECK_RUN_ID);
  const expectedHeadSha = env.GATE_EXPECTED_HEAD_SHA;
  if (env.GITHUB_REPOSITORY !== REPO || env.GITHUB_REF !== 'refs/heads/main' ||
      env.GITHUB_EVENT_NAME !== 'workflow_run' || !SHA.test(env.GITHUB_SHA ?? '') ||
      !env.GITHUB_TOKEN) throw new Error('AUTOMATION_CONTEXT_UNTRUSTED');
  const base = `/repos/${REPO}`;
  const readPr = () => request(env.GITHUB_TOKEN, `${base}/pulls/${prNumber}`);
  const readApi = (path) => request(env.GITHUB_TOKEN, path);
  const readGraphql = (query, variables) => request(env.GITHUB_TOKEN, '/graphql', {
    method: 'POST', body: { query, variables },
  });
  const outcome = await automateAfterGate({ expectedHeadSha, prNumber, checkRunId,
    readCheck: (id) => request(env.GITHUB_TOKEN, `${base}/check-runs/${id}`),
    readPr,
    compare: (baseSha, headSha) => request(env.GITHUB_TOKEN,
      `${base}/compare/${baseSha}...${headSha}`),
    updateBranch: ({ prNumber: number, expectedHeadSha: sha }) => request(env.GITHUB_TOKEN,
      `${base}/pulls/${number}/update-branch`, {
        method: 'PUT', body: { expected_head_sha: sha },
      }),
    recheckEvidence: async (number, headSha, baseSha) => {
      const evidence = await collectGateEvidence({ repo: REPO, prNumber: number,
        readApi, readGraphql });
      return validPostGateEvidence(evidence, { prNumber: number,
        expectedHeadSha: headSha, baseSha });
    },
    graphql: readGraphql,
  });
  return outcome;
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
