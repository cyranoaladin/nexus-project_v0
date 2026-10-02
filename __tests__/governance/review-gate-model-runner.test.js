const HEAD = 'a'.repeat(40);
let runThreePassReview;
beforeAll(async () => {
  ({ runThreePassReview } = await import('../../scripts/github/review-gate/model-runner.mjs'));
});

const clean = JSON.stringify({ review_complete: true, blocking_findings: [], warnings: [] });
const files = [{ filename: 'app/page.tsx', patch: '@@ -1 +1 @@\n-old\n+new',
  additions: 1, deletions: 1, changes: 2, status: 'modified' }];

describe('trusted three-pass local semantic review', () => {
  test('PR text is stdin data and never a command argument', async () => {
    const calls = [];
    const runProcess = jest.fn(async (input) => { calls.push(input); return { ok: true, stdout: clean }; });
    const outputs = await runThreePassReview({ headSha: HEAD, files,
      modelPath: '/tmp/verified/model.gguf', binaryPath: '/tmp/verified/llama-cli',
      schemaPath: '/trusted/review-schema.json', contextTokens: 8192, runProcess });
    expect(Object.keys(outputs)).toEqual(['correctness', 'security', 'runtime']);
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.command).toBe('/tmp/verified/llama-cli');
      expect(call.args).not.toContain('@@ -1 +1 @@');
      expect(call.args).toContain('/trusted/review-schema.json');
      expect(call.prompt).toContain('app/page.tsx');
      expect(call.prompt).toContain('@@ -1 +1 @@');
      expect(call.timeoutMs).toBeLessThanOrEqual(120000);
    }
    expect(new Set(calls.map((call) => call.prompt)).size).toBe(3);
  });

  test('invalid paths, unsupported diff and timeout fail closed', async () => {
    const base = { headSha: HEAD, files, modelPath: '/tmp/model.gguf',
      binaryPath: '/tmp/llama-cli', schemaPath: '/tmp/schema.json', contextTokens: 8192 };
    await expect(runThreePassReview({ ...base, modelPath: 'relative.gguf',
      runProcess: async () => ({ ok: true, stdout: clean }) })).rejects.toThrow('MODEL_CONFIG_INVALID');
    await expect(runThreePassReview({ ...base, files: [{ ...files[0], patch: 'x'.repeat(70_000) }],
      runProcess: async () => ({ ok: true, stdout: clean }) })).rejects.toThrow('DIFF_UNSUPPORTED');
    await expect(runThreePassReview({ ...base,
      runProcess: async () => ({ ok: false, reason: 'MODEL_TIMEOUT' }) })).rejects.toThrow('MODEL_TIMEOUT');
  });
});
