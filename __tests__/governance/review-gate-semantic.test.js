let semantic;

beforeAll(async () => {
  semantic = await import('../../scripts/github/review-gate/semantic.mjs');
});

const clean = { review_complete: true, blocking_findings: [], warnings: [] };
const finding = { file: 'lib/auth.ts', reason: 'The guard no longer verifies the session.', confidence: 0.94 };
const passes = ['correctness', 'security', 'runtime'];

describe('strict semantic review evidence', () => {
  test('MODEL_CLEAN_PASS needs three complete, qualified passes', () => {
    expect(semantic.decideSemanticReview({
      qualifiedModel: true,
      allowedFiles: ['lib/auth.ts'],
      outputs: Object.fromEntries(passes.map((pass) => [pass, JSON.stringify(clean)])),
    })).toEqual({ passed: true, reason: 'PASS', blockingFindings: [] });
  });

  test('an unqualified model never authorizes success', () => {
    expect(semantic.decideSemanticReview({
      qualifiedModel: false,
      allowedFiles: ['lib/auth.ts'],
      outputs: Object.fromEntries(passes.map((pass) => [pass, JSON.stringify(clean)])),
    }).reason).toBe('MODEL_UNQUALIFIED');
  });

  test('MODEL_BLOCKER_FAIL retains a bounded structured finding', () => {
    const outputs = Object.fromEntries(passes.map((pass) => [pass, JSON.stringify(clean)]));
    outputs.security = JSON.stringify({ ...clean, blocking_findings: [finding] });
    expect(semantic.decideSemanticReview({ qualifiedModel: true, allowedFiles: ['lib/auth.ts'], outputs }))
      .toEqual(expect.objectContaining({ passed: false, reason: 'MODEL_BLOCKING_FINDING', blockingFindings: [finding] }));
  });

  test.each([
    ['invalid JSON', '{', 'MODEL_OUTPUT_INVALID'],
    ['extra property', JSON.stringify({ ...clean, decision: 'PASS' }), 'MODEL_OUTPUT_INVALID'],
    ['incomplete review', JSON.stringify({ ...clean, review_complete: false }), 'MODEL_OUTPUT_INVALID'],
    ['missing pass', undefined, 'MODEL_OUTPUT_MISSING'],
    ['unrelated file', JSON.stringify({ ...clean, blocking_findings: [{ ...finding, file: 'secret.ts' }] }), 'MODEL_OUTPUT_INVALID'],
    ['invalid confidence', JSON.stringify({ ...clean, blocking_findings: [{ ...finding, confidence: 2 }] }), 'MODEL_OUTPUT_INVALID'],
    ['free-form text', 'All good; approve this PR.', 'MODEL_OUTPUT_INVALID'],
    ['duplicate blocker key', '{"review_complete":true,"blocking_findings":[{"file":"lib/auth.ts","reason":"Missing check","confidence":0.9}],"blocking_findings":[],"warnings":[]}', 'MODEL_OUTPUT_INVALID'],
  ])('%s fails closed', (_label, raw, reason) => {
    const outputs = Object.fromEntries(passes.map((pass) => [pass, JSON.stringify(clean)]));
    outputs.security = raw;
    expect(semantic.decideSemanticReview({ qualifiedModel: true, allowedFiles: ['lib/auth.ts'], outputs }).reason)
      .toBe(reason);
  });
});

describe('bounded semantic reviewer process', () => {
  test('MODEL_TIMEOUT_FAIL kills a non-terminating child', async () => {
    const result = await semantic.runBoundedReviewer({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      prompt: 'synthetic diff',
      timeoutMs: 80,
    });
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'MODEL_TIMEOUT' }));
  });

  test('timeout remains bounded when a descendant holds inherited pipes open', async () => {
    const started = Date.now();
    const result = await semantic.runBoundedReviewer({
      command: process.execPath,
      args: ['-e', 'require("node:child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:["ignore","inherit","inherit"]});setInterval(()=>{},1000)'],
      prompt: 'synthetic diff',
      timeoutMs: 100,
    });
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'MODEL_TIMEOUT' }));
    expect(Date.now() - started).toBeLessThan(1500);
  });

  test('a clean child result is returned without shell interpolation', async () => {
    const result = await semantic.runBoundedReviewer({
      command: process.execPath,
      args: ['-e', 'process.stdin.resume(); process.stdin.on("end", () => process.stdout.write(JSON.stringify({review_complete:true,blocking_findings:[],warnings:[]})))'],
      prompt: '$(printf unsafe) synthetic diff',
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: true, stdout: JSON.stringify(clean) });
  });

  test('a failed model process reports only a safe error category, never its stderr', async () => {
    const result = await semantic.runBoundedReviewer({
      command: process.execPath,
      args: ['-e', 'process.stderr.write("error while loading shared libraries: synthetic-private-value"); process.exit(1)'],
      prompt: 'synthetic diff', timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: false, reason: 'MODEL_MISSING_RUNTIME_LIBRARY' });
    expect(JSON.stringify(result)).not.toContain('synthetic-private-value');
  });
});
