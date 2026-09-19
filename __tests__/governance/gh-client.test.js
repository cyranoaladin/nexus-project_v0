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

  // A GraphQL mutation carries no `-X`, so counting verbs alone reported it as
  // a read. `API_WRITE_CALLS=0` was therefore a claim about REST only, while
  // the operator path's `deleteBranchProtectionRule` would have passed for one.
  test('a graphql mutation is counted as a write call', () => {
    const gh = createGhClient(jest.fn(() => JSON.stringify({ data: {} })));
    gh.graphql('mutation { deleteBranchProtectionRule(input:{branchProtectionRuleId:"BPR_x"}) { clientMutationId } }');
    expect(gh.writeCallCount()).toBe(1);
  });

  test('a graphql query is not counted as a write call', () => {
    const gh = createGhClient(jest.fn(() => JSON.stringify({ data: {} })));
    gh.graphql('query { repository(owner:"a",name:"b"){ id } }');
    expect(gh.writeCallCount()).toBe(0);
  });

  test('a mutation behind a leading comment is still counted', () => {
    const gh = createGhClient(jest.fn(() => JSON.stringify({ data: {} })));
    gh.graphql('# restore the classic rule\nmutation { createBranchProtectionRule(input:{pattern:"main"}) { clientMutationId } }');
    expect(gh.writeCallCount()).toBe(1);
  });

  test('the word "mutation" inside a query string is not a mutation', () => {
    const gh = createGhClient(jest.fn(() => JSON.stringify({ data: {} })));
    gh.graphql('query { search(query:"mutation", type:ISSUE, first:1){ issueCount } }');
    expect(gh.writeCallCount()).toBe(0);
  });
});
