const CHECK_NAME = 'Nexus Review Gate';
const APP_ID = 5166727;
const APP_SLUG = 'nexus-review-gate';
const SHA = /^[0-9a-f]{40}$/;
const CONCLUSIONS = new Set(['success', 'failure', 'action_required']);

function verifyReadback(check, { id, headSha, status, conclusion }) {
  if (!check || check.id !== id || check.name !== CHECK_NAME ||
      check.head_sha !== headSha || check?.app?.id !== APP_ID ||
      check?.app?.slug !== APP_SLUG) throw new Error('CHECK_APP_MISMATCH');
  if (check.status !== status || check.conclusion !== conclusion) {
    throw new Error('CHECK_FINAL_STATE_INVALID');
  }
}

/** App-token writes are injected separately from GITHUB_TOKEN readback. */
export async function publishGateCheck({ headSha, conclusion, reason, create, update, read } = {}) {
  if (!SHA.test(headSha ?? '') || !CONCLUSIONS.has(conclusion) ||
      typeof reason !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(reason) ||
      typeof create !== 'function' || typeof update !== 'function' || typeof read !== 'function') {
    throw new Error('CHECK_VERDICT_INVALID');
  }
  let created;
  try {
    created = await create({ name: CHECK_NAME, head_sha: headSha, status: 'in_progress',
      output: { title: 'Review in progress', summary: 'Trusted evaluation of the exact PR head is running.' } });
  } catch { throw new Error('CHECK_CREATE_FAILED'); }
  if (!Number.isSafeInteger(created?.id) || created.id <= 0) throw new Error('CHECK_RESPONSE_INVALID');
  let initial;
  try { initial = await read(created.id); } catch { throw new Error('CHECK_READBACK_FAILED'); }
  verifyReadback(initial, { id: created.id, headSha, status: 'in_progress', conclusion: null });

  try {
    await update(created.id, { status: 'completed', conclusion,
      output: { title: `Nexus Review Gate: ${conclusion}`,
        summary: `Reason: ${reason}. This verdict is bound to commit ${headSha}.` } });
  } catch { throw new Error('CHECK_UPDATE_FAILED'); }
  let final;
  try { final = await read(created.id); } catch { throw new Error('CHECK_READBACK_FAILED'); }
  verifyReadback(final, { id: created.id, headSha, status: 'completed', conclusion });
  return { checkRunId: created.id, headSha, appId: APP_ID, appSlug: APP_SLUG, conclusion };
}
