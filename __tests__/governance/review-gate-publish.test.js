const HEAD = 'a'.repeat(40);
let publishGateCheck;
beforeAll(async () => {
  ({ publishGateCheck } = await import('../../scripts/github/review-gate/publish.mjs'));
});

function fixture() {
  let state = { id: 123, name: 'Nexus Review Gate', head_sha: HEAD,
    app: { id: 5166727, slug: 'nexus-review-gate' }, status: 'in_progress', conclusion: null };
  const create = jest.fn(async (payload) => {
    expect(payload.head_sha).toBe(HEAD);
    return { id: 123 };
  });
  const update = jest.fn(async (_id, payload) => {
    state = { ...state, status: payload.status, conclusion: payload.conclusion };
    return { id: 123 };
  });
  const read = jest.fn(async () => state);
  return { create, update, read, setState: (value) => { state = value; } };
}

describe('App-owned check publication', () => {
  test('only exact-head App 5166727 can publish a success', async () => {
    const api = fixture();
    const result = await publishGateCheck({ headSha: HEAD, conclusion: 'success', reason: 'PASS', ...api });
    expect(result).toEqual(expect.objectContaining({ appId: 5166727, headSha: HEAD,
      conclusion: 'success', checkRunId: 123 }));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.read).toHaveBeenCalledTimes(2);
  });

  test('a same-name github-actions check cannot be accepted as Nexus App source', async () => {
    const api = fixture();
    api.setState({ id: 123, name: 'Nexus Review Gate', head_sha: HEAD,
      app: { id: 15368, slug: 'github-actions' }, status: 'in_progress', conclusion: null });
    await expect(publishGateCheck({ headSha: HEAD, conclusion: 'success', reason: 'PASS', ...api }))
      .rejects.toThrow('CHECK_APP_MISMATCH');
    expect(api.update).not.toHaveBeenCalled();
  });

  test('wrong-head or malformed readback refuses publication', async () => {
    for (const state of [null, { id: 123, name: 'Nexus Review Gate', head_sha: 'b'.repeat(40),
      app: { id: 5166727, slug: 'nexus-review-gate' }, status: 'in_progress' }]) {
      const api = fixture();
      api.setState(state);
      await expect(publishGateCheck({ headSha: HEAD, conclusion: 'success', reason: 'PASS', ...api }))
        .rejects.toThrow();
      expect(api.update).not.toHaveBeenCalled();
    }
  });

  test('never accepts neutral/skipped or unbounded untrusted output as a verdict', async () => {
    const api = fixture();
    await expect(publishGateCheck({ headSha: HEAD, conclusion: 'neutral', reason: 'PASS', ...api }))
      .rejects.toThrow('CHECK_VERDICT_INVALID');
    expect(api.create).not.toHaveBeenCalled();
    await expect(publishGateCheck({ headSha: HEAD, conclusion: 'success', reason: 'x'.repeat(500), ...api }))
      .rejects.toThrow('CHECK_VERDICT_INVALID');
  });

  test('API failure or wrong final readback cannot claim success', async () => {
    const api = fixture();
    api.update.mockRejectedValueOnce(new Error('token unavailable'));
    await expect(publishGateCheck({ headSha: HEAD, conclusion: 'success', reason: 'PASS', ...api }))
      .rejects.toThrow('CHECK_UPDATE_FAILED');
    const bad = fixture();
    bad.update = jest.fn(async () => ({ id: 123 }));
    await expect(publishGateCheck({ headSha: HEAD, conclusion: 'success', reason: 'PASS', ...bad }))
      .rejects.toThrow('CHECK_FINAL_STATE_INVALID');
  });
});
