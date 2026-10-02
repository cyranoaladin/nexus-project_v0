const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
let validateUpstreamRun;
let selectCurrentPr;

beforeAll(async () => {
  ({ validateUpstreamRun, selectCurrentPr } = await import('../../scripts/github/review-gate/entry.mjs'));
});

const run = () => ({ id: 123, run_attempt: 1, event: 'pull_request', workflow_id: 185409165,
  path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success',
  head_sha: HEAD, repository: { full_name: 'cyranoaladin/nexus-project_v0' } });
const pr = () => ({ number: 42, state: 'open', draft: false,
  base: { ref: 'main', sha: BASE }, head: { sha: HEAD } });

describe('trusted workflow_run to PR association', () => {
  test('accepts the exact completed CI workflow and unique current PR', () => {
    expect(validateUpstreamRun(run(), { runId: 123, attempt: 1, expectedSha: HEAD }))
      .toEqual(expect.objectContaining({ headSha: HEAD, runId: 123 }));
    expect(selectCurrentPr([pr()], HEAD)).toEqual(pr());
  });

  test('rejects wrong workflow, repository, event, SHA, attempt and status', () => {
    for (const mutation of [
      { event: 'push' }, { workflow_id: 1 }, { path: '.github/workflows/other.yml' },
      { status: 'in_progress' }, { head_sha: BASE }, { run_attempt: 2 },
      { repository: { full_name: 'attacker/fork' } },
    ]) {
      expect(() => validateUpstreamRun({ ...run(), ...mutation },
        { runId: 123, attempt: 1, expectedSha: HEAD })).toThrow();
    }
  });

  test('a failed upstream run is still identifiable but is not a success', () => {
    expect(validateUpstreamRun({ ...run(), conclusion: 'failure' },
      { runId: 123, attempt: 1, expectedSha: HEAD }).conclusion).toBe('failure');
  });

  test('ambiguous, closed, stale or wrong-base PR association fails closed', () => {
    for (const prs of [[], [pr(), { ...pr(), number: 43 }],
      [{ ...pr(), state: 'closed' }], [{ ...pr(), head: { sha: BASE } }],
      [{ ...pr(), base: { ref: 'release', sha: BASE } }]]) {
      expect(() => selectCurrentPr(prs, HEAD)).toThrow();
    }
  });
});
