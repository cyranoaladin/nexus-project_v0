let validateTrustedWorkflowContext;
let executeTrustedWorkflow;

beforeAll(async () => {
  ({ validateTrustedWorkflowContext, executeTrustedWorkflow } = await import('../../scripts/github/review-gate/workflow-entry.mjs'));
});

test('trusted failed CI publishes an App-owned failure without invoking PR code', async () => {
  let state = 'in_progress';
  const readApi = jest.fn(async (path) => {
    if (path.endsWith('/actions/runs/42')) return {
      id: 42, run_attempt: 1, event: 'pull_request', workflow_id: 185409165,
      path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'failure',
      head_sha: 'b'.repeat(40), repository: { full_name: 'cyranoaladin/nexus-project_v0' },
    };
    if (path.includes('/commits/')) return [{ number: 12, state: 'open', draft: false,
      head: { sha: 'b'.repeat(40) }, base: { ref: 'main', sha: SHA } }];
    throw new Error('unexpected read');
  });
  const clients = {
    readApi, readGraphql: jest.fn(),
    createCheck: jest.fn(async () => ({ id: 123 })),
    updateCheck: jest.fn(async (_id, body) => { state = body.conclusion; return {}; }),
    readCheck: jest.fn(async () => ({ id: 123, name: 'Nexus Review Gate', head_sha: 'b'.repeat(40),
      app: { id: 5166727, slug: 'nexus-review-gate' },
      status: state === 'in_progress' ? 'in_progress' : 'completed',
      conclusion: state === 'in_progress' ? null : state })),
  };
  const result = await executeTrustedWorkflow({
    env: { GITHUB_REPOSITORY: context.repository, GITHUB_REF: context.ref,
      GITHUB_EVENT_NAME: context.eventName, GITHUB_SHA: SHA,
      NEXUS_REVIEW_GATE_APP_ID: '5166727', APP_INSTALLATION_ID: '167301397',
      GITHUB_TOKEN: 'R', APP_TOKEN: 'A' },
    readEvent: () => context.event, checkoutSha: () => SHA,
    clientsFactory: ({ readToken, appToken }) => {
      expect(readToken).toBe('R');
      expect(appToken).toBe('A');
      return clients;
    },
  });
  expect(result).toEqual({ reason: 'UPSTREAM_CI_NOT_SUCCESS', conclusion: 'failure',
    checkRunId: 123, checkHeadSha: 'b'.repeat(40), prNumber: 12 });
  expect(clients.createCheck).toHaveBeenCalledTimes(1);
  expect(clients.updateCheck).toHaveBeenCalledWith(123,
    expect.objectContaining({ conclusion: 'failure' }));
  expect(clients.readGraphql).not.toHaveBeenCalled();
});

const SHA = 'a'.repeat(40);
const context = {
  repository: 'cyranoaladin/nexus-project_v0',
  ref: 'refs/heads/main',
  eventName: 'workflow_run',
  workflowSha: SHA,
  checkoutSha: SHA,
  event: { action: 'completed', workflow_run: {
    id: 42, run_attempt: 1, head_sha: 'b'.repeat(40), event: 'pull_request',
  } },
};

describe('trusted workflow context', () => {
  it('accepts only a workflow_run from the trusted main checkout', () => {
    expect(validateTrustedWorkflowContext(context)).toEqual({
      runId: 42, attempt: 1, expectedHeadSha: 'b'.repeat(40),
    });
  });

  it.each([
    ['PR checkout', { checkoutSha: 'b'.repeat(40) }],
    ['PR ref', { ref: 'refs/pull/1/merge' }],
    ['another repository', { repository: 'someone/else' }],
    ['another event', { eventName: 'pull_request' }],
    ['incomplete trigger', { event: { action: 'requested', workflow_run: context.event.workflow_run } }],
    ['invalid head', { event: { action: 'completed', workflow_run: { ...context.event.workflow_run, head_sha: 'bad' } } }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => validateTrustedWorkflowContext({ ...context, ...overrides })).toThrow('UNTRUSTED_WORKFLOW_CONTEXT');
  });
});
