/** App identity proof only. This never issues a successful review verdict. */
const REPO = 'cyranoaladin/nexus-project_v0';
const APP_ID = 5166727;
const INSTALLATION_ID = '167301397';
const APP_SLUG = 'nexus-review-gate';
const CHECK_NAME = 'Nexus Review Gate';
const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function verifyProofCheck(check, expectedSha) {
  if (!check || !Number.isSafeInteger(check.id) || check.id <= 0 ||
      !check.app || !Number.isSafeInteger(check.app.id) || typeof check.app.slug !== 'string') {
    throw new Error('CHECK_RESPONSE_INVALID');
  }
  if (check.name !== CHECK_NAME) throw new Error('CHECK_NAME_MISMATCH');
  if (check.head_sha !== expectedSha) throw new Error('CHECK_HEAD_MISMATCH');
  if (check.app.id !== APP_ID || check.app.slug !== APP_SLUG) throw new Error('CHECK_APP_MISMATCH');
  if (check.status !== 'completed' || check.conclusion !== 'action_required') {
    throw new Error('CHECK_PROOF_CONCLUSION_INVALID');
  }
  return {
    checkId: check.id,
    headSha: check.head_sha,
    appId: check.app.id,
    appSlug: check.app.slug,
    status: check.status,
    conclusion: check.conclusion,
  };
}

export async function runProof({ sha, installationId, appToken, readApi, writeApi }) {
  if (!SHA_PATTERN.test(sha || '')) throw new Error('PROOF_SHA_INVALID');
  if (String(installationId) !== INSTALLATION_ID) throw new Error('INSTALLATION_MISMATCH');
  if (!appToken) throw new Error('APP_TOKEN_MISSING');
  if (typeof readApi !== 'function' || typeof writeApi !== 'function') throw new Error('API_CLIENT_MISSING');

  const commit = await readApi(`/repos/${REPO}/commits/${sha}`);
  if (commit?.sha !== sha) throw new Error('COMMIT_SHA_MISMATCH');

  const created = await writeApi(`/repos/${REPO}/check-runs`, {
    name: CHECK_NAME,
    head_sha: sha,
    status: 'completed',
    conclusion: 'action_required',
    output: {
      title: 'Identity proof only — no review performed',
      summary: 'This check proves the installation token and Check Run source. It is not an approval or review verdict.',
    },
  });
  if (!Number.isSafeInteger(created?.id) || created.id <= 0) throw new Error('CHECK_RESPONSE_INVALID');
  // This read uses GITHUB_TOKEN, not the App installation token. Its app.id is
  // the independent source-of-truth for future ruleset integration_id binding.
  const readback = await readApi(`/repos/${REPO}/check-runs/${created.id}`);
  if (readback?.id !== created.id) throw new Error('CHECK_RESPONSE_INVALID');
  return verifyProofCheck(readback, sha);
}

async function githubJson(token, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  // Do not print response bodies: they are not needed to diagnose a failed
  // proof and could unexpectedly contain request metadata.
  if (!response.ok) throw new Error(`GITHUB_API_HTTP_${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error('GITHUB_API_RESPONSE_INVALID');
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    if (process.env.GITHUB_EVENT_NAME !== 'workflow_run' ||
        process.env.GITHUB_REF !== 'refs/heads/main' ||
        process.env.GITHUB_REPOSITORY !== REPO) {
      throw new Error('UNTRUSTED_WORKFLOW_CONTEXT');
    }
    const result = await runProof({
      sha: process.env.PROOF_SHA,
      installationId: process.env.APP_INSTALLATION_ID,
      appToken: process.env.APP_TOKEN,
      readApi: (path) => githubJson(process.env.GITHUB_TOKEN, path),
      writeApi: (path, body) => githubJson(process.env.APP_TOKEN, path, body),
    });
    process.stdout.write(`${JSON.stringify({
      CHECK_NAME,
      CHECK_SOURCE_APP_ID: result.appId,
      CHECK_APP_SLUG: result.appSlug,
      CHECK_HEAD_SHA: result.headSha,
      CHECK_STATUS: result.status,
      CHECK_CONCLUSION: result.conclusion,
      CHECK_SOURCE_APP_VERIFIED: 'YES',
      CHECK_RUN_ID: result.checkId,
    })}\n`);
  } catch (error) {
    process.stderr.write(`APP_CHECK_PROOF_FAILED=${error instanceof Error ? error.message : 'UNKNOWN'}\n`);
    process.exitCode = 1;
  }
}
