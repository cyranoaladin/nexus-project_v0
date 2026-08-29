const path = require('path');

const fixturesDir = path.join(__dirname, 'fixtures', 'workflows');

describe('yaml-workflows: real YAML 1.2 parsing, no regex', () => {
  let lib;

  beforeAll(async () => {
    lib = await import('../../scripts/github/lib/yaml-workflows.mjs');
  });

  test('job with no name: falls back to the job key', () => {
    const doc = lib.parseWorkflowFile(path.join(fixturesDir, 'missing-name.yml'));
    const contexts = lib.listJobContexts(doc);
    expect(contexts).toEqual([{ jobKey: 'build-artifacts', context: 'build-artifacts', matrix: null }]);
  });

  test('two jobs whose names differ only by case resolve independently (no collision error)', () => {
    const doc = lib.parseWorkflowFile(path.join(fixturesDir, 'case-collision.yml'));
    const contexts = lib.listJobContexts(doc);
    expect(contexts).toEqual(
      expect.arrayContaining([
        { jobKey: 'documents', context: 'Documents', matrix: null },
        { jobKey: 'documents-lower', context: 'documents', matrix: null },
      ]),
    );
    expect(contexts).toHaveLength(2);
  });

  test('strategy.matrix expands into parenthesised contexts', () => {
    const doc = lib.parseWorkflowFile(path.join(fixturesDir, 'matrix.yml'));
    const contexts = lib.listJobContexts(doc).map((c) => c.context);
    expect(contexts).toEqual(
      expect.arrayContaining([
        'E2E (Playwright) / Playwright E2E (chromium)',
        'E2E (Playwright) / Playwright E2E (firefox)',
        'E2E (Playwright) / Playwright E2E (webkit)',
      ]),
    );
    expect(contexts).toHaveLength(3);
  });

  test('non-ASCII job name is preserved exactly', () => {
    const doc = lib.parseWorkflowFile(path.join(fixturesDir, 'non-ascii-name.yml'));
    const found = lib.findJobContext(doc, 'e2e-auth');
    expect(found.context).toBe('E2E Parcours Authentifiés');
  });

  test('GitHub expressions in a job name are preserved verbatim, never evaluated', () => {
    const doc = lib.parseWorkflowFile(path.join(fixturesDir, 'unevaluated-expression.yml'));
    const found = lib.findJobContext(doc, 'suite');
    expect(found.context).toBe('${{ matrix.suite }} results');
  });

  test('on: is never coerced to a boolean (YAML 1.2, not 1.1)', () => {
    const doc = lib.parseWorkflowFile(path.join(fixturesDir, 'path-filtered.yml'));
    expect(doc.on).not.toBe(true);
    expect(typeof doc.on).toBe('object');
    expect(lib.hasPullRequestTrigger(doc)).toBe(true);
  });

  test('path-filtered workflow is still correctly parsed for its trigger paths', () => {
    const doc = lib.parseWorkflowFile(path.join(fixturesDir, 'path-filtered.yml'));
    expect(doc.on.pull_request.paths).toEqual(['content/**']);
  });

  test('a workflow with no pull_request trigger is detected as such', () => {
    const doc = lib.parseWorkflowFile(path.join(fixturesDir, 'no-pull-request-trigger.yml'));
    expect(lib.hasPullRequestTrigger(doc)).toBe(false);
  });
});
