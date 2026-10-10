const REPO = 'cyranoaladin/nexus-project_v0';
const CI_WORKFLOW_ID = 185409165;
const SHA = /^[0-9a-f]{40}$/;

export function validateUpstreamRun(run, { runId, attempt, expectedSha } = {}) {
  if (!Number.isSafeInteger(runId) || runId <= 0 ||
      !Number.isSafeInteger(attempt) || attempt <= 0 || !SHA.test(expectedSha ?? '') ||
      run?.id !== runId || run.run_attempt !== attempt || run.event !== 'pull_request' ||
      run.workflow_id !== CI_WORKFLOW_ID || run.path !== '.github/workflows/ci.yml' ||
      run.repository?.full_name !== REPO || run.status !== 'completed' ||
      run.head_sha !== expectedSha ||
      !['success', 'failure', 'cancelled', 'timed_out', 'action_required'].includes(run.conclusion)) {
    throw new Error('UNQUALIFIED_UPSTREAM_RUN');
  }
  return { runId, attempt, headSha: expectedSha, conclusion: run.conclusion };
}

export function selectCurrentPr(prs, expectedSha) {
  if (!Array.isArray(prs) || !SHA.test(expectedSha ?? '')) throw new Error('PR_ASSOCIATION_INVALID');
  const current = prs.filter((pr) => pr?.state === 'open' && pr?.draft === false &&
    pr?.head?.sha === expectedSha && pr?.base?.ref === 'main' && SHA.test(pr?.base?.sha ?? '') &&
    Number.isSafeInteger(pr?.number) && pr.number > 0);
  if (current.length !== 1) throw new Error('PR_ASSOCIATION_AMBIGUOUS_OR_MISSING');
  return current[0];
}
