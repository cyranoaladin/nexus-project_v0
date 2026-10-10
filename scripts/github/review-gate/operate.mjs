import { selectCurrentPr, validateUpstreamRun } from './entry.mjs';

/** No GitHub governance write happens here; App publication is injected. */
export async function runTrustedWorkflow({ upstreamRun, associatedPrs, runId, attempt,
  expectedSha, evaluate, publish, rereadBeforePublish } = {}) {
  const upstream = validateUpstreamRun(upstreamRun, { runId, attempt, expectedSha });
  const pr = selectCurrentPr(associatedPrs, expectedSha);
  if (typeof evaluate !== 'function' || typeof publish !== 'function') {
    throw new Error('WORKFLOW_CLIENT_INVALID');
  }
  let verdict;
  if (upstream.conclusion !== 'success') {
    verdict = { conclusion: 'failure', reason: 'UPSTREAM_CI_NOT_SUCCESS', reviewedHeadSha: expectedSha };
  } else {
    try { verdict = await evaluate(pr.number); }
    catch { verdict = { conclusion: 'failure', reason: 'EVALUATION_FAILED', reviewedHeadSha: expectedSha }; }
  }
  if (verdict?.reviewedHeadSha !== expectedSha ||
      !['success', 'failure', 'action_required'].includes(verdict.conclusion) ||
      !/^[A-Z][A-Z0-9_]{0,79}$/.test(verdict.reason ?? '')) {
    verdict = { conclusion: 'failure', reason: 'VERDICT_INVALID_OR_STALE', reviewedHeadSha: expectedSha };
  }
  if (verdict.conclusion === 'success') {
    let current;
    try {
      if (typeof rereadBeforePublish !== 'function') throw new Error('FINAL_READ_MISSING');
      current = await rereadBeforePublish(pr.number);
    } catch {
      verdict = { conclusion: 'failure', reason: 'FINAL_HEAD_READ_FAILED', reviewedHeadSha: expectedSha };
    }
    if (verdict.conclusion === 'success' &&
        (current?.state !== 'open' || current.draft !== false ||
          current.base?.ref !== 'main' || current.base.sha !== pr.base.sha ||
          current.head?.sha !== expectedSha)) {
      verdict = { conclusion: 'failure', reason: 'STALE_HEAD', reviewedHeadSha: expectedSha };
    }
  }
  const check = await publish({ headSha: expectedSha, conclusion: verdict.conclusion, reason: verdict.reason });
  if (check?.appId !== 5166727 || check.headSha !== expectedSha ||
      check.conclusion !== verdict.conclusion) throw new Error('PUBLISHED_CHECK_INVALID');
  return { ...verdict, check, prNumber: pr.number };
}
