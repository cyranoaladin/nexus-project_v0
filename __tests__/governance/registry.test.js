const path = require('path');

const goodRoot = path.join(__dirname, 'fixtures', 'registry-repo-good');
const renamedRoot = path.join(__dirname, 'fixtures', 'registry-repo-renamed');

function sampleRegistry() {
  return {
    requiredChecks: [
      {
        context: 'Build',
        producer: {
          kind: 'GITHUB_ACTIONS_WORKFLOW',
          workflowPath: '.github/workflows/sample.yml',
          jobKey: 'build',
          expectedContext: 'Build',
        },
      },
    ],
    observedNotRequired: [],
  };
}

describe('required-check registry — producer proofs', () => {
  let registry;

  beforeAll(async () => {
    registry = await import('../../scripts/github/lib/registry.mjs');
  });

  test('good case: real job matches the registry entry', () => {
    const results = registry.proveAllCheckEntries(goodRoot, sampleRegistry());
    expect(results).toEqual([{ context: 'Build', tier: 'required', ok: true }]);
  });

  test('renamed required job is detected and fails', () => {
    const results = registry.proveAllCheckEntries(renamedRoot, sampleRegistry());
    expect(results[0].ok).toBe(false);
    expect(results[0].code).toBe('ZOMBIE_REQUIRED_CHECK');
    expect(results[0].details).toMatch(/now produces context "Build Renamed"/);
  });

  test('matrix producer proof selects the declared lane instead of the first combination', () => {
    const result = registry.proveGithubActionsWorkflowProducer(goodRoot, {
      kind: 'GITHUB_ACTIONS_WORKFLOW',
      workflowPath: '.github/workflows/matrix.yml',
      jobKey: 'aria-jest',
      matrix: { lane: 'api' },
      expectedContext: 'ARIA Jest (api)',
    });

    expect(result).toEqual({ ok: true });
  });

  test('missing workflow file is MISSING_REQUIRED_CHECK, not a crash', () => {
    const reg = {
      requiredChecks: [
        {
          context: 'Ghost',
          producer: {
            kind: 'GITHUB_ACTIONS_WORKFLOW',
            workflowPath: '.github/workflows/does-not-exist.yml',
            jobKey: 'ghost',
            expectedContext: 'Ghost',
          },
        },
      ],
      observedNotRequired: [],
    };
    const results = registry.proveAllCheckEntries(goodRoot, reg);
    expect(results[0].ok).toBe(false);
    expect(results[0].code).toBe('MISSING_REQUIRED_CHECK');
  });

  test('GitGuardian-shaped EXTERNAL_APP producer passes structural validation', () => {
    const result = registry.validateExternalAppProducerStructure({
      kind: 'EXTERNAL_APP',
      appName: 'GitGuardian',
      integrationId: 46505,
      expectedContext: 'GitGuardian Security Checks',
    });
    expect(result.ok).toBe(true);
  });

  test('EXTERNAL_APP producer missing integrationId fails as UNMODELED_EXTERNAL_REQUIRED_CHECK', () => {
    const result = registry.validateExternalAppProducerStructure({
      kind: 'EXTERNAL_APP',
      appName: 'SomeApp',
      expectedContext: 'Some Check',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('UNMODELED_EXTERNAL_REQUIRED_CHECK');
  });

  test('unknown producer.kind fails as UNMODELED_EXTERNAL_REQUIRED_CHECK', () => {
    const result = registry.proveCheckEntry(goodRoot, {
      context: 'Mystery',
      producer: { kind: 'SOMETHING_ELSE' },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('UNMODELED_EXTERNAL_REQUIRED_CHECK');
  });

  test('GITHUB_DEFAULT_SETUP producer with expectedContexts passes structurally', () => {
    const result = registry.validateDefaultSetupProducerStructure({
      kind: 'GITHUB_DEFAULT_SETUP',
      mechanism: 'GHAS CodeQL default setup',
      expectedContexts: ['CodeQL'],
    });
    expect(result.ok).toBe(true);
  });
});
