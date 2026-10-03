let createGateClients;
beforeAll(async () => {
  ({ createGateClients } = await import('../../scripts/github/review-gate/api.mjs'));
});

describe('GitHub token separation for review gate', () => {
  test('read token gets all evidence reads; App token writes only Check Runs', async () => {
    const calls = [];
    const fetchImpl = jest.fn(async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ id: 7 }) };
    });
    const clients = createGateClients({ readToken: 'R',
      appToken: 'A', fetchImpl });
    await clients.readApi('/repos/cyranoaladin/nexus-project_v0/pulls/42');
    await clients.readGraphql('query { viewer { login } }', {});
    await clients.createCheck({ name: 'Nexus Review Gate' });
    await clients.updateCheck(7, { conclusion: 'failure' });
    await clients.readCheck(7);
    expect(calls.map(({ options }) => options.headers.Authorization)).toEqual([
      'Bearer R', 'Bearer R',
      'Bearer A', 'Bearer A', 'Bearer R',
    ]);
    expect(calls.filter(({ options }) => options.headers.Authorization === 'Bearer A')
      .every(({ url }) => url.includes('/check-runs'))).toBe(true);
  });

  test('missing tokens, API error and malformed JSON fail without exposing response bodies', async () => {
    expect(() => createGateClients({ readToken: '', appToken: 'x' })).toThrow('GITHUB_TOKEN_MISSING');
    const failing = createGateClients({ readToken: 'R', appToken: 'A',
      fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'secret body' }) });
    await expect(failing.readApi('/repos/cyranoaladin/nexus-project_v0/pulls/42'))
      .rejects.toThrow('GITHUB_API_HTTP_403');
    const malformed = createGateClients({ readToken: 'R', appToken: 'A',
      fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('secret body'); } }) });
    await expect(malformed.readCheck(7)).rejects.toThrow('GITHUB_API_RESPONSE_INVALID');
  });
});
