describe('gh client — injectable, never a real network/process call in tests', () => {
  let createGhClient;

  beforeAll(async () => {
    ({ createGhClient } = await import('../../scripts/github/lib/gh.mjs'));
  });

  test('apiJson with default GET is not counted as a write call', () => {
    const fakeExec = jest.fn(() => JSON.stringify({ ok: true }));
    const gh = createGhClient(fakeExec);
    gh.apiJson('repos/foo/bar');
    expect(gh.writeCallCount()).toBe(0);
    expect(fakeExec).toHaveBeenCalledWith('gh', ['api', 'repos/foo/bar', '-X', 'GET'], expect.any(Object));
  });

  test('PATCH/POST/PUT/DELETE are counted as write calls', () => {
    const fakeExec = jest.fn(() => '{}');
    const gh = createGhClient(fakeExec);
    gh.apiJson('repos/foo/bar', { method: 'PATCH', fields: [['x', '1']] });
    gh.apiJson('repos/foo/baz', { method: 'DELETE' });
    expect(gh.writeCallCount()).toBe(2);
  });

  test('graphql calls never execute a real process; every call is recorded', () => {
    const fakeExec = jest.fn(() => JSON.stringify({ data: {} }));
    const gh = createGhClient(fakeExec);
    gh.graphql('query { viewer { login } }', { number: 5 });
    expect(fakeExec).toHaveBeenCalledTimes(1);
    expect(gh.calls).toHaveLength(1);
    expect(gh.calls[0][0]).toBe('api');
    expect(gh.calls[0][1]).toBe('graphql');
  });
});
