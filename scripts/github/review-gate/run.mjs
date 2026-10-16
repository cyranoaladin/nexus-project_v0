import { decideOperationalGate } from './decision.mjs';

const failure = (reason, reviewedHeadSha) => ({ conclusion: 'failure', reason, reviewedHeadSha });

/**
 * PR data remains data. The caller supplies read-only GitHub collectors and a
 * trusted model runner; nothing from a PR is imported or executed here.
 */
export async function evaluateWithFreshEvidence({ collect, runSemantic, reread, qualifiedModel } = {}) {
  if (typeof collect !== 'function' || typeof runSemantic !== 'function' ||
      typeof reread !== 'function') return failure('EVALUATOR_CONFIG_INVALID');
  let first;
  try { first = await collect(); } catch { return failure('EVIDENCE_COLLECTION_FAILED'); }
  const preliminary = decideOperationalGate({ evidence: first, qualifiedModel, outputs: undefined });
  if (preliminary.reason !== 'MODEL_OUTPUT_MISSING') return preliminary;

  let outputs;
  try { outputs = await runSemantic(first); }
  catch { return failure('MODEL_EXECUTION_FAILED', first.reviewedHeadSha); }

  let fresh;
  try { fresh = await collect(); }
  catch { return failure('EVIDENCE_REFRESH_FAILED', first.reviewedHeadSha); }
  if (fresh.reviewedHeadSha !== first.reviewedHeadSha ||
      fresh.reviewedBaseSha !== first.reviewedBaseSha ||
      JSON.stringify(fresh.files) !== JSON.stringify(first.files)) {
    return failure('STALE_HEAD', first.reviewedHeadSha);
  }
  const verdict = decideOperationalGate({ evidence: fresh, qualifiedModel, outputs });
  if (verdict.conclusion !== 'success') return verdict;

  let refs;
  try { refs = await reread({ expectedHeadSha: first.reviewedHeadSha,
    expectedBaseSha: first.reviewedBaseSha }); }
  catch { return failure('FINAL_HEAD_READ_FAILED', first.reviewedHeadSha); }
  if (refs?.stable !== true || refs.currentHeadSha !== first.reviewedHeadSha ||
      refs.currentBaseSha !== first.reviewedBaseSha) {
    return failure('STALE_HEAD', first.reviewedHeadSha);
  }
  return verdict;
}
