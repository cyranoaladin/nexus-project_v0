describe('Nexus Review Gate App identity proof', () => {
  let verifyProofCheck;
  let runProof;
  const sha = 'a'.repeat(40);
  const check = {
    id: 42,
    name: 'Nexus Review Gate',
    head_sha: sha,
    status: 'completed',
    conclusion: 'action_required',
    app: { id: 5166727, slug: 'nexus-review-gate' },
  };

  beforeAll(async () => {
    ({ verifyProofCheck, runProof } = await import('../../scripts/github/review-gate/prove-app-check.mjs'));
  });

  test('accepts only the exact App and requested SHA', () => {
    expect(verifyProofCheck(check, sha)).toEqual({
      checkId: 42, headSha: sha, appId: 5166727, appSlug: 'nexus-review-gate',
      status: 'completed', conclusion: 'action_required',
    });
    expect(() => verifyProofCheck({ ...check, app: { id: 7, slug: 'other' } }, sha)).toThrow('CHECK_APP_MISMATCH');
    expect(() => verifyProofCheck(check, 'b'.repeat(40))).toThrow('CHECK_HEAD_MISMATCH');
    expect(() => verifyProofCheck({ ...check, app: { id: 15368, slug: 'github-actions' } }, sha)).toThrow('CHECK_APP_MISMATCH');
  });

  test('rejects malformed or misleading check responses', () => {
    expect(() => verifyProofCheck(null, sha)).toThrow('CHECK_RESPONSE_INVALID');
    expect(() => verifyProofCheck({ ...check, app: null }, sha)).toThrow('CHECK_RESPONSE_INVALID');
    expect(() => verifyProofCheck({ ...check, name: 'Other' }, sha)).toThrow('CHECK_NAME_MISMATCH');
    expect(() => verifyProofCheck({ ...check, conclusion: 'success' }, sha)).toThrow('CHECK_PROOF_CONCLUSION_INVALID');
  });

  function clients({ commitSha = sha, created = check, readback = check } = {}) {
    const readApi = jest.fn(async (path) => {
      if (path.endsWith(`/commits/${sha}`)) return { sha: commitSha };
      return readback;
    });
    const writeApi = jest.fn(async () => created);
    return { readApi, writeApi };
  }

  test('publishes only after exact commit and installation checks, then verifies readback', async () => {
    const { readApi, writeApi } = clients();
    await expect(runProof({ sha, installationId: '167301397', appToken: 'test-only', readApi, writeApi }))
      .resolves.toEqual(expect.objectContaining({ appId: 5166727, headSha: sha }));
    expect(writeApi).toHaveBeenCalledTimes(1);
    expect(writeApi.mock.calls[0][1]).toEqual(expect.objectContaining({
      name: 'Nexus Review Gate', head_sha: sha, conclusion: 'action_required',
    }));
    expect(readApi).toHaveBeenCalledWith(expect.stringContaining('/check-runs/42'));
  });

  test('missing installation or token fails before writing', async () => {
    const { readApi, writeApi } = clients();
    await expect(runProof({ sha, installationId: '', appToken: 'test-only', readApi, writeApi }))
      .rejects.toThrow('INSTALLATION_MISMATCH');
    await expect(runProof({ sha, installationId: '167301397', appToken: '', readApi, writeApi }))
      .rejects.toThrow('APP_TOKEN_MISSING');
    expect(writeApi).not.toHaveBeenCalled();
  });

  test('wrong or stale commit fails before writing', async () => {
    const { readApi, writeApi } = clients({ commitSha: 'b'.repeat(40) });
    await expect(runProof({ sha, installationId: '167301397', appToken: 'test-only', readApi, writeApi }))
      .rejects.toThrow('COMMIT_SHA_MISMATCH');
    expect(writeApi).not.toHaveBeenCalled();
  });

  test('API uncertainty and malformed create/readback fail closed', async () => {
    const badApi = jest.fn(async () => { throw new Error('API_FAILURE'); });
    await expect(runProof({ sha, installationId: '167301397', appToken: 'test-only', readApi: badApi, writeApi: jest.fn() }))
      .rejects.toThrow('API_FAILURE');
    const badCreate = clients({ created: {} });
    await expect(runProof({ sha, installationId: '167301397', appToken: 'test-only', ...badCreate }))
      .rejects.toThrow('CHECK_RESPONSE_INVALID');
    const badReadback = clients({ readback: { ...check, app: { id: 15368, slug: 'github-actions' } } });
    await expect(runProof({ sha, installationId: '167301397', appToken: 'test-only', ...badReadback }))
      .rejects.toThrow('CHECK_APP_MISMATCH');
  });
});
