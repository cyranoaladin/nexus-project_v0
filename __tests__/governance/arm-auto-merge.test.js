const { installExitTrap, ProcessExitError } = require('./helpers/process-exit');

describe('arm-auto-merge — never approves, arms native auto-merge only', () => {
  let armAutoMerge;
  let exitSpy;

  beforeAll(async () => {
    ({ armAutoMerge } = await import('../../scripts/github/arm-auto-merge.mjs'));
  });

  beforeEach(() => {
    exitSpy = installExitTrap();
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  function fakeGh({ isDraft = false, baseRefName = 'main', autoMergeRequest = null } = {}) {
    const graphqlCalls = [];
    return {
      graphqlCalls,
      graphql: (query, variables) => {
        graphqlCalls.push({ query, variables });
        if (query.includes('enablePullRequestAutoMerge')) {
          return { data: { enablePullRequestAutoMerge: { pullRequest: { number: 42 } } } };
        }
        return {
          data: {
            repository: {
              pullRequest: {
                id: 'PR_kwABC',
                number: 42,
                isDraft,
                baseRefName,
                headRefOid: 'deadbeef',
                autoMergeRequest,
                author: { login: 'nexus-agent' },
              },
            },
          },
        };
      },
    };
  }

  test('arms auto-merge and never calls any review-submission endpoint', () => {
    const gh = fakeGh();
    const result = armAutoMerge({ prNumber: 42, gh });
    expect(result).toEqual({ alreadyArmed: false, prNumber: 42, headSha: 'deadbeef' });
    for (const call of gh.graphqlCalls) {
      expect(call.query).not.toMatch(/submitPullRequestReview|addPullRequestReview/i);
    }
    const enableCall = gh.graphqlCalls.find((c) => c.query.includes('enablePullRequestAutoMerge'));
    expect(enableCall.query).toMatch(/mergeMethod:\s*MERGE/);
  });

  test('refuses a draft PR', () => {
    const gh = fakeGh({ isDraft: true });
    expect(() => armAutoMerge({ prNumber: 42, gh })).toThrow(ProcessExitError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('fails closed on a base-branch mismatch', () => {
    const gh = fakeGh({ baseRefName: 'develop' });
    expect(() => armAutoMerge({ prNumber: 42, gh })).toThrow(ProcessExitError);
  });

  test('fails closed on a repo mismatch, before any GraphQL call', () => {
    const gh = fakeGh();
    expect(() => armAutoMerge({ repo: 'someone/else', prNumber: 42, gh })).toThrow(ProcessExitError);
    expect(gh.graphqlCalls).toHaveLength(0);
  });

  test('is idempotent: re-arming an already-armed PR makes no mutation call', () => {
    const gh = fakeGh({ autoMergeRequest: { enabledAt: '2026-08-29T00:00:00Z', mergeMethod: 'MERGE' } });
    const result = armAutoMerge({ prNumber: 42, gh });
    expect(result.alreadyArmed).toBe(true);
    expect(gh.graphqlCalls.every((c) => !c.query.includes('enablePullRequestAutoMerge'))).toBe(true);
  });
});
