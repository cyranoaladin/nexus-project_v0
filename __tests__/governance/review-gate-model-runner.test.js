const HEAD = 'a'.repeat(40);
const fs = require('node:fs');
let runThreePassReview;
beforeAll(async () => {
  ({ runThreePassReview } = await import('../../scripts/github/review-gate/model-runner.mjs'));
});

const clean = JSON.stringify({ review_complete: true, blocking_findings: [], warnings: [] });
const files = [{ filename: 'app/page.tsx', patch: '@@ -1 +1 @@\n-old\n+new',
  additions: 1, deletions: 1, changes: 2, status: 'modified' }];

describe('trusted three-pass local semantic review', () => {
  test('PR text uses a private, removed prompt file and never a command argument', async () => {
    const calls = [];
    const runProcess = jest.fn(async (input) => {
      const promptPath = input.args[input.args.indexOf('-f') + 1];
      calls.push({ ...input, promptPath, fileText: fs.readFileSync(promptPath, 'utf8'),
        fileMode: fs.statSync(promptPath).mode & 0o777,
        dirMode: fs.statSync(require('node:path').dirname(promptPath)).mode & 0o777 });
      return { ok: true, stdout: clean };
    });
    const outputs = await runThreePassReview({ headSha: HEAD, files,
      modelPath: '/tmp/verified/model.gguf', binaryPath: '/tmp/verified/llama-completion',
      schemaPath: '/trusted/review-schema.json', contextTokens: 8192, runProcess });
    expect(Object.keys(outputs)).toEqual(['correctness', 'security', 'runtime']);
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.command).toBe('/tmp/verified/llama-completion');
      expect(call.args).not.toContain('@@ -1 +1 @@');
      expect(call.args).toContain('-f');
      expect(call.args).not.toContain('/dev/stdin');
      expect(call.args).toContain('/trusted/review-schema.json');
      expect(call.prompt).toBe('');
      expect(call.fileText).toContain('app/page.tsx');
      expect(call.fileText).toContain('@@ -1 +1 @@');
      expect(call.fileMode).toBe(0o600);
      expect(call.dirMode).toBe(0o700);
      expect(fs.existsSync(call.promptPath)).toBe(false);
      expect(call.timeoutMs).toBeLessThanOrEqual(120000);
    }
    expect(new Set(calls.map((call) => call.fileText)).size).toBe(3);
  });

  test('invalid paths, unsupported diff and timeout fail closed', async () => {
    const base = { headSha: HEAD, files, modelPath: '/tmp/model.gguf',
      binaryPath: '/tmp/llama-completion', schemaPath: '/tmp/schema.json', contextTokens: 8192 };
    await expect(runThreePassReview({ ...base, modelPath: 'relative.gguf',
      runProcess: async () => ({ ok: true, stdout: clean }) })).rejects.toThrow('MODEL_CONFIG_INVALID');
    await expect(runThreePassReview({ ...base, files: [{ ...files[0], patch: 'x'.repeat(70_000) }],
      runProcess: async () => ({ ok: true, stdout: clean }) })).rejects.toThrow('DIFF_UNSUPPORTED');
    await expect(runThreePassReview({ ...base,
      runProcess: async () => ({ ok: false, reason: 'MODEL_TIMEOUT' }) })).rejects.toThrow('MODEL_TIMEOUT');
    await expect(runThreePassReview({ ...base,
      runProcess: async () => ({ ok: false, reason: 'MODEL_MISSING_RUNTIME_LIBRARY' }) }))
      .rejects.toThrow('MODEL_MISSING_RUNTIME_LIBRARY');
    await expect(runThreePassReview({ ...base,
      runProcess: async () => ({ ok: false, reason: 'untrusted text' }) }))
      .rejects.toThrow('MODEL_EXECUTION_FAILED');
  });
});
