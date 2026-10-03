const SHA = /^[0-9a-f]{40}$/;

function validPr(pr) {
  return Number.isSafeInteger(pr?.number) && pr.number > 0 &&
    pr.state === 'open' && pr.draft === false && pr.base?.ref === 'main' &&
    SHA.test(pr.base?.sha ?? '') && SHA.test(pr.head?.sha ?? '');
}

export async function safeUpdateBranch({ expectedHeadSha, observedBaseSha, behindBy,
  readPr, update } = {}) {
  if (!SHA.test(expectedHeadSha ?? '') || !SHA.test(observedBaseSha ?? '') ||
      typeof readPr !== 'function' || typeof update !== 'function') throw new Error('UPDATE_CONFIG_INVALID');
  const pr = await readPr();
  if (!validPr(pr)) return 'PR_NOT_ELIGIBLE';
  if (pr.head.sha !== expectedHeadSha) return 'ABORTED_STALE_HEAD';
  if (pr.base.sha !== observedBaseSha) return 'ABORTED_STALE_BASE';
  if (pr.mergeable === false) return 'REFUSED_CONFLICT';
  if (pr.mergeable !== true) return 'MERGEABILITY_UNKNOWN';
  if (!Number.isSafeInteger(behindBy) || behindBy < 0) return 'RELATION_UNKNOWN';
  if (behindBy === 0 && pr.mergeable_state === 'clean') return 'NOT_BEHIND';
  if (behindBy <= 0 || pr.mergeable_state !== 'behind') return 'RELATION_CONTRADICTORY';
  await update(pr.number, { expected_head_sha: expectedHeadSha });
  return 'UPDATED';
}

const ARM_MUTATION = `mutation($pullRequestId:ID!,$expectedHeadOid:GitObjectID!) {
  enablePullRequestAutoMerge(input:{pullRequestId:$pullRequestId, mergeMethod: MERGE,
    expectedHeadOid:$expectedHeadOid}) {
    pullRequest { number autoMergeRequest { mergeMethod } }
  }
}`;

export async function safeArmAutoMerge({ expectedHeadSha, gateConclusion,
  humanExceptionRequired = false, humanExceptionSatisfied = false,
  readPr, graphql } = {}) {
  if (!SHA.test(expectedHeadSha ?? '') || typeof readPr !== 'function' ||
      typeof graphql !== 'function') throw new Error('AUTO_MERGE_CONFIG_INVALID');
  if (gateConclusion !== 'success') return 'GATE_NOT_SUCCESS';
  if (humanExceptionRequired && !humanExceptionSatisfied) return 'HUMAN_EXCEPTION_PENDING';
  const pr = await readPr();
  if (!validPr(pr)) return 'PR_NOT_ELIGIBLE';
  if (pr.head.sha !== expectedHeadSha) return 'ABORTED_STALE_HEAD';
  if (pr.mergeable !== true || pr.mergeable_state !== 'clean' ||
      typeof pr.node_id !== 'string' || !pr.node_id) return 'PR_NOT_ELIGIBLE';
  if (pr.auto_merge?.merge_method === 'merge') return 'ALREADY_ARMED';
  const response = await graphql(ARM_MUTATION,
    { pullRequestId: pr.node_id, expectedHeadOid: expectedHeadSha });
  if (Array.isArray(response?.errors) && response.errors.length) throw new Error('AUTO_MERGE_API_FAILED');
  if (response?.data?.enablePullRequestAutoMerge?.pullRequest?.number !== pr.number ||
      response?.data?.enablePullRequestAutoMerge?.pullRequest?.autoMergeRequest?.mergeMethod !== 'MERGE') {
    throw new Error('AUTO_MERGE_RESPONSE_INVALID');
  }
  return 'ARMED';
}
