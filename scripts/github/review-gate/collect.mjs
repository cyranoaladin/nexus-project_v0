/** Read-only, SHA-bound evidence collection. All API clients must use GITHUB_TOKEN. */
const SHA = /^[0-9a-f]{40}$/;
const REPO = 'cyranoaladin/nexus-project_v0';
const PAGE_SIZE = 100;
const MAX_PAGES = 30; // GitHub caps PR files at 3,000; an unsupported diff fails closed.
const CUBIC_APP_ID = 1082092;
const THREADS_QUERY = `query($owner:String!,$repo:String!,$number:Int!,$cursor:String) {
  repository(owner:$owner,name:$repo) {
    pullRequest(number:$number) {
      reviewThreads(first:100,after:$cursor) {
        nodes { isResolved }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

function invalid(reason) { throw new Error(reason); }

function validateInput({ repo, prNumber, readApi, readGraphql }) {
  if (repo !== REPO || !Number.isSafeInteger(prNumber) || prNumber <= 0 ||
      typeof readApi !== 'function' || typeof readGraphql !== 'function') invalid('COLLECTOR_INPUT_INVALID');
}

async function api(readApi, path) {
  try { return await readApi(path); } catch { invalid('GITHUB_EVIDENCE_UNAVAILABLE'); }
}

async function graphql(readGraphql, variables) {
  let response;
  try {
    response = await readGraphql(THREADS_QUERY, variables);
  } catch { invalid('GITHUB_EVIDENCE_UNAVAILABLE'); }
  if (Array.isArray(response?.errors) && response.errors.length > 0) invalid('REVIEW_THREADS_INCOMPLETE');
  return response;
}

async function listPages(readApi, path, errorCode) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await api(readApi, `${path}${path.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}&page=${page}`);
    if (!Array.isArray(response)) invalid(errorCode);
    items.push(...response);
    if (response.length < PAGE_SIZE) return items;
  }
  invalid(errorCode);
}

async function listCheckRuns(readApi, repo, sha) {
  const runs = [];
  let total = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await api(readApi,
      `/repos/${repo}/commits/${sha}/check-runs?filter=all&per_page=${PAGE_SIZE}&page=${page}`);
    if (!response || !Number.isSafeInteger(response.total_count) || response.total_count < 0 ||
        !Array.isArray(response.check_runs) || response.check_runs.length > PAGE_SIZE ||
        (total !== null && response.total_count !== total)) invalid('CHECK_RUNS_INVALID');
    total = response.total_count;
    runs.push(...response.check_runs);
    if (runs.length === total) return runs;
    if (response.check_runs.length === 0 || runs.length > total) invalid('CHECK_RUNS_INVALID');
  }
  invalid('CHECK_RUNS_INCOMPLETE');
}

async function listThreads(readGraphql, prNumber) {
  const nodes = [];
  let cursor = null;
  const seen = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await graphql(readGraphql, {
      owner: 'cyranoaladin', repo: 'nexus-project_v0', number: prNumber, cursor,
    });
    const connection = response?.data?.repository?.pullRequest?.reviewThreads;
    if (!Array.isArray(connection?.nodes) || !connection.pageInfo ||
        typeof connection.pageInfo.hasNextPage !== 'boolean' ||
        connection.nodes.some((node) => typeof node?.isResolved !== 'boolean')) {
      invalid('REVIEW_THREADS_INCOMPLETE');
    }
    nodes.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) return nodes;
    cursor = connection.pageInfo.endCursor;
    if (typeof cursor !== 'string' || cursor.length === 0 || seen.has(cursor)) {
      invalid('REVIEW_THREADS_INCOMPLETE');
    }
    seen.add(cursor);
  }
  invalid('REVIEW_THREADS_INCOMPLETE');
}

function validatePr(pr, prNumber) {
  if (pr?.number !== prNumber || !SHA.test(pr?.head?.sha ?? '') ||
      !SHA.test(pr?.base?.sha ?? '') || typeof pr?.base?.ref !== 'string' ||
      !Number.isSafeInteger(pr?.changed_files) || pr.changed_files < 0) invalid('PR_RESPONSE_INVALID');
  return pr;
}

function validateReviews(reviews) {
  if (reviews.some((review) => !Number.isSafeInteger(review?.id) || review.id <= 0 ||
      typeof review?.user?.login !== 'string' || typeof review?.state !== 'string' ||
      (review.commit_id !== null && review.commit_id !== undefined && !SHA.test(review.commit_id)))) {
    invalid('REVIEWS_INVALID');
  }
  if (new Set(reviews.map((review) => review.id)).size !== reviews.length) invalid('REVIEWS_INVALID');
}

function applicableChangesRequested(reviews) {
  const latestByAuthor = new Map();
  for (const review of [...reviews].sort((a, b) => a.id - b.id)) {
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) {
      latestByAuthor.set(review.user.login.toLowerCase(), review);
    }
  }
  return [...latestByAuthor.values()].filter((review) => review.state === 'CHANGES_REQUESTED').length;
}

function cubicSignal(checkRuns, reviews, sha) {
  const candidates = checkRuns.filter((check) => check?.head_sha === sha && check?.app?.id === CUBIC_APP_ID);
  const current = [...candidates].sort((a, b) => a.id - b.id).at(-1);
  // A green/neutral check alone is not proof that an AI review actually ran.
  const realReview = Boolean(current?.status === 'completed' && current.conclusion === 'success' &&
    /\bAI review completed\b/i.test(current.output?.summary ?? '') &&
    reviews.some((review) => review.commit_id === sha &&
      /^cubic-dev-ai(?:\[bot\])?$/i.test(review.user.login)));
  return { realReview, checkRunId: current?.id ?? null };
}

export async function rereadGateRefs({ repo, prNumber, readApi, expectedHeadSha, expectedBaseSha }) {
  if (repo !== REPO || !Number.isSafeInteger(prNumber) || prNumber <= 0 ||
      typeof readApi !== 'function' || !SHA.test(expectedHeadSha ?? '') ||
      !SHA.test(expectedBaseSha ?? '')) invalid('COLLECTOR_INPUT_INVALID');
  const pr = validatePr(await api(readApi, `/repos/${repo}/pulls/${prNumber}`), prNumber);
  return {
    currentHeadSha: pr.head.sha,
    currentBaseSha: pr.base.sha,
    stable: pr.state === 'open' && pr.draft === false && pr.base.ref === 'main' &&
      pr.head.sha === expectedHeadSha && pr.base.sha === expectedBaseSha,
  };
}

export async function collectGateEvidence({ repo, prNumber, readApi, readGraphql }) {
  validateInput({ repo, prNumber, readApi, readGraphql });
  const evaluationStartedAt = new Date().toISOString();
  const pr = validatePr(await api(readApi, `/repos/${repo}/pulls/${prNumber}`), prNumber);
  const reviewedHeadSha = pr.head.sha;
  const reviewedBaseSha = pr.base.sha;
  if (pr.changed_files > 3000) invalid('DIFF_TOO_LARGE');

  const effectiveRules = await listPages(readApi, `/repos/${repo}/rules/branches/main`, 'RULESET_INCOMPLETE');
  if (!effectiveRules.length || !effectiveRules.some((rule) => rule?.type === 'required_status_checks')) {
    invalid('RULESET_INCOMPLETE');
  }
  const files = await listPages(readApi, `/repos/${repo}/pulls/${prNumber}/files`, 'DIFF_INCOMPLETE');
  if (files.length !== pr.changed_files || !files.length ||
      files.some((file) => typeof file?.filename !== 'string' ||
        typeof file?.patch !== 'string' || !file.patch.length)) invalid('DIFF_INCOMPLETE');
  const checkRuns = await listCheckRuns(readApi, repo, reviewedHeadSha);
  if (checkRuns.some((check) => !Number.isSafeInteger(check?.id) || check.id <= 0 ||
      !SHA.test(check?.head_sha ?? '') || check.head_sha !== reviewedHeadSha ||
      typeof check?.name !== 'string' || !Number.isSafeInteger(check?.app?.id))) {
    invalid('CHECK_RUNS_INVALID');
  }
  const rawStatuses = await listPages(readApi,
    `/repos/${repo}/commits/${reviewedHeadSha}/statuses`, 'REQUIRED_STATUSES_INCOMPLETE');
  if (rawStatuses.some((status) => typeof status?.context !== 'string' ||
      typeof status?.state !== 'string' ||
      (status.sha !== undefined && status.sha !== reviewedHeadSha))) invalid('REQUIRED_STATUSES_INCOMPLETE');
  const statuses = rawStatuses.map((status) => ({ ...status, sha: reviewedHeadSha }));
  const reviews = await listPages(readApi, `/repos/${repo}/pulls/${prNumber}/reviews`, 'REVIEWS_INCOMPLETE');
  validateReviews(reviews);
  const threads = await listThreads(readGraphql, prNumber);
  const finalRefs = await rereadGateRefs({ repo, prNumber, readApi,
    expectedHeadSha: reviewedHeadSha, expectedBaseSha: reviewedBaseSha });
  if (!finalRefs.stable) invalid('PR_CHANGED_DURING_COLLECTION');

  return {
    prNumber, evaluationStartedAt,
    pr, reviewedHeadSha, reviewedBaseSha,
    currentHeadSha: finalRefs.currentHeadSha, currentBaseSha: finalRefs.currentBaseSha,
    effectiveRules, rulesComplete: true,
    files, diffAvailable: true, diffComplete: true,
    diffBaseSha: reviewedBaseSha, diffHeadSha: reviewedHeadSha,
    checkRuns, checksComplete: true, statuses, statusesComplete: true,
    requiredCheckTargetSha: reviewedHeadSha,
    reviews, reviewsComplete: true,
    reviewThreads: threads, threadsComplete: true,
    unresolvedReviewThreads: threads.filter((thread) => !thread.isResolved).length,
    applicableChangesRequested: applicableChangesRequested(reviews),
    cubic: cubicSignal(checkRuns, reviews, reviewedHeadSha),
  };
}
