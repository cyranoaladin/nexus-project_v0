const path = require('node:path');

const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const WORKFLOW_PATH = path.join(REPOSITORY_ROOT, '.github/workflows/ci.yml');

describe('ARIA GitHub CI qualification contract', () => {
  let inspectAriaCiWorkflow;
  let loadWorkflow;

  beforeAll(async () => {
    ({ inspectAriaCiWorkflow, loadWorkflow } = await import(
      '../../scripts/github/lib/aria-ci-contract.mjs'
    ));
  });

  const inspectRealWorkflow = () => inspectAriaCiWorkflow(loadWorkflow(WORKFLOW_PATH));
  const passingDocument = () => {
    const document = loadWorkflow(WORKFLOW_PATH);
    const result = inspectAriaCiWorkflow(document);
    expect(result.findings).toEqual([]);
    return structuredClone(document);
  };

  test('ARIA_CI_EXECUTES_EVERY_QUALIFICATION_LANE_ON_EVERY_PR_AND_UPLOADS_EVIDENCE_ALWAYS', () => {
    expect(inspectRealWorkflow().findings).toEqual([]);
  });

  test('ARIA_CI_CONTRACTS_LANE_PROVISIONS_LOCKED_PUBLIC_RAG_COMPANION', () => {
    const document = loadWorkflow(WORKFLOW_PATH);
    const steps = document.jobs['aria-static'].steps;
    const resolver = steps.find((step) => step.id === 'rag-lock');
    expect(resolver).toMatchObject({
      if: "${{ matrix.lane == 'contracts' }}",
      run: 'npm run aria:contracts:lock:emit',
    });
    const companionCheckout = steps.find((step) =>
      String(step.uses ?? '').startsWith('actions/checkout@')
      && step.with?.path === '.aria-rag-contract-producer');
    expect(companionCheckout).toMatchObject({
      if: "${{ matrix.lane == 'contracts' }}",
      with: {
        repository: '${{ steps.rag-lock.outputs.producer_repository }}',
        ref: '${{ steps.rag-lock.outputs.producer_commit }}',
        path: '.aria-rag-contract-producer',
        'fetch-depth': 1,
        'persist-credentials': false,
      },
    });
    const command = steps.find((step) => step.run === 'npm run ${{ matrix.script }}');
    expect(command.env).toEqual({
      ARIA_RAG_WORKTREE: '${{ github.workspace }}/.aria-rag-contract-producer',
      ARIA_RAG_EXPECTED_SHA: '${{ steps.rag-lock.outputs.producer_commit }}',
    });
  });

  test.each([
    ['repository', (document) => {
      const checkout = document.jobs['aria-static'].steps.find((step) =>
        step.with?.path === '.aria-rag-contract-producer');
      checkout.with.repository = 'cyranoaladin/RAG';
    }, 'ARIA_CI_RAG_COMPANION_PROVISIONING_INVALID'],
    ['ref', (document) => {
      const checkout = document.jobs['aria-static'].steps.find((step) =>
        step.with?.path === '.aria-rag-contract-producer');
      checkout.with.ref = '0'.repeat(40);
    }, 'ARIA_CI_RAG_COMPANION_PROVISIONING_INVALID'],
    ['resolver', (document) => {
      document.jobs['aria-static'].steps.find((step) => step.id === 'rag-lock').run =
        'echo "npm run aria:contracts:lock:emit"';
    }, 'ARIA_CI_RAG_COMPANION_PROVISIONING_INVALID'],
    ['environment', (document) => {
      const command = document.jobs['aria-static'].steps.find((step) =>
        step.run === 'npm run ${{ matrix.script }}');
      command.env.ARIA_RAG_EXPECTED_SHA = '0'.repeat(40);
    }, 'ARIA_CI_RAG_COMPANION_ENV_INVALID'],
  ])('ARIA_CI_REJECTS_RAG_COMPANION_%s_DRIFT', (_field, mutate, expectedFinding) => {
    const document = passingDocument();
    mutate(document);
    expect(inspectAriaCiWorkflow(document).findings).toContain(expectedFinding);
  });

  test('ARIA_CI_REJECTS_PATH_FILTERED_PULL_REQUEST', () => {
    const document = passingDocument();
    document.on.pull_request.paths = ['lib/aria/**'];

    expect(inspectAriaCiWorkflow(document).findings).toContain('ARIA_CI_PULL_REQUEST_PATH_FILTERED');
  });

  test('ARIA_CI_REJECTS_MISSING_OR_DUPLICATED_LANE', () => {
    const missing = passingDocument();
    missing.jobs['aria-jest'].strategy.matrix.include.pop();
    expect(inspectAriaCiWorkflow(missing).findings).toContain('ARIA_CI_MATRIX_CONTRACT_MISMATCH:aria-jest');

    const duplicated = passingDocument();
    duplicated.jobs['aria-jest'].strategy.matrix.include.push(
      structuredClone(duplicated.jobs['aria-jest'].strategy.matrix.include[0]),
    );
    expect(inspectAriaCiWorkflow(duplicated).findings).toContain('ARIA_CI_MATRIX_CONTRACT_MISMATCH:aria-jest');
  });

  test('ARIA_CI_REJECTS_UNEXPECTED_MATRIX_LANE', () => {
    const document = passingDocument();
    document.jobs['aria-browser'].strategy.matrix.include.push({
      lane: 'optional-demo',
      script: 'test:aria:e2e:desktop',
      artifactPath: '.artifacts/aria',
    });

    expect(inspectAriaCiWorkflow(document).findings)
      .toContain('ARIA_CI_MATRIX_CONTRACT_MISMATCH:aria-browser');
  });

  test('ARIA_CI_BINDS_EACH_LANE_TO_EXACT_PACKAGE_SCRIPT', () => {
    const document = passingDocument();
    const [unit, api] = document.jobs['aria-jest'].strategy.matrix.include;
    [unit.script, api.script] = [api.script, unit.script];

    expect(inspectAriaCiWorkflow(document).findings)
      .toContain('ARIA_CI_MATRIX_CONTRACT_MISMATCH:aria-jest');
  });

  test('ARIA_CI_REJECTS_ECHO_COMMENT_OR_PREFIX_COMMAND_BYPASS', () => {
    const document = passingDocument();
    document.jobs['aria-static'].strategy.matrix.include[0].script = 'aria:enum-drift-disabled';
    const command = document.jobs['aria-static'].steps.find((step) =>
      step.run === 'npm run ${{ matrix.script }}');
    command.run = 'echo "npm run ${{ matrix.script }}"';

    const findings = inspectAriaCiWorkflow(document).findings;
    expect(findings).toContain('ARIA_CI_MATRIX_CONTRACT_MISMATCH:aria-static');
    expect(findings).toContain('ARIA_CI_COMMAND_STEP_INVALID:aria-static');
  });

  test('ARIA_CI_REJECTS_FAIL_FAST_MATRIX', () => {
    const document = passingDocument();
    document.jobs['aria-browser'].strategy['fail-fast'] = true;

    expect(inspectAriaCiWorkflow(document).findings).toContain('ARIA_CI_MATRIX_FAIL_FAST:aria-browser');
  });

  test('ARIA_CI_REJECTS_CONDITIONAL_OR_CONTINUE_ON_ERROR_LANE', () => {
    const conditional = passingDocument();
    conditional.jobs['aria-coverage'].if = "${{ contains(github.event.pull_request.labels.*.name, 'aria') }}";
    expect(inspectAriaCiWorkflow(conditional).findings).toContain('ARIA_CI_JOB_CONDITIONAL:aria-coverage');

    const ignored = passingDocument();
    ignored.jobs['aria-postgres']['continue-on-error'] = true;
    expect(inspectAriaCiWorkflow(ignored).findings).toContain('ARIA_CI_CONTINUE_ON_ERROR:aria-postgres');
  });

  test('ARIA_CI_REJECTS_CONDITIONAL_PROTECTED_STEP', () => {
    const document = passingDocument();
    const command = document.jobs['aria-browser'].steps.find((step) =>
      step.run === 'npm run ${{ matrix.script }}');
    command.if = "${{ matrix.lane != 'mobile' }}";

    expect(inspectAriaCiWorkflow(document).findings)
      .toContain('ARIA_CI_PROTECTED_STEP_CONDITIONAL:aria-browser');
  });

  test('ARIA_CI_REJECTS_ARTIFACT_NOT_ALWAYS', () => {
    const document = passingDocument();
    const upload = document.jobs['aria-jest'].steps.find((step) =>
      String(step.uses ?? '').startsWith('actions/upload-artifact@'));
    delete upload.if;

    expect(inspectAriaCiWorkflow(document).findings).toContain('ARIA_CI_ARTIFACT_NOT_ALWAYS:aria-jest');
  });

  test('ARIA_CI_REJECTS_ARTIFACT_IGNORE_MISSING', () => {
    const document = passingDocument();
    const upload = document.jobs['aria-postgres'].steps.find((step) =>
      String(step.uses ?? '').startsWith('actions/upload-artifact@'));
    upload.with['if-no-files-found'] = 'ignore';

    expect(inspectAriaCiWorkflow(document).findings).toContain('ARIA_CI_ARTIFACT_MISSING_NOT_FATAL:aria-postgres');
  });

  test('ARIA_CI_REJECTS_ARTIFACT_NAME_OR_PATH_SUBSTRING_BYPASS', () => {
    const document = passingDocument();
    const upload = document.jobs['aria-static'].steps.find((step) =>
      String(step.uses ?? '').startsWith('actions/upload-artifact@'));
    upload.with.name = `prefix-${upload.with.name}`;
    upload.with.path = `${upload.with.path}-old`;

    const findings = inspectAriaCiWorkflow(document).findings;
    expect(findings).toContain('ARIA_CI_ARTIFACT_NAME_UNSEALED:aria-static');
    expect(findings).toContain('ARIA_CI_ARTIFACT_PATH_UNSCOPED:aria-static');
  });

  test('ARIA_CI_COVERAGE_FAILS_IF_GENERATION_FAILS', () => {
    const document = passingDocument();
    const generation = document.jobs['aria-coverage'].steps.find((step) =>
      step.run === 'npm run test:aria:coverage');
    generation.run = 'npm run test:aria:coverage; npm run aria:coverage:check';

    expect(inspectAriaCiWorkflow(document).findings)
      .toContain('ARIA_CI_COMMAND_STEP_INVALID:aria-coverage:npm run test:aria:coverage');
  });

  test('ARIA_CI_REQUALIFIES_THE_SEALED_VISUAL_MATRIX_BEFORE_TRACEABILITY', () => {
    const document = passingDocument();
    const commands = document.jobs['aria-evidence'].steps.map((step) => step.run).filter(Boolean);
    expect(commands.indexOf('npm run aria:visual-evidence:check')).toBeGreaterThan(
      commands.indexOf('npm run aria:test-evidence:jest'),
    );
    expect(commands.indexOf('npm run aria:test-plan:check')).toBeGreaterThan(
      commands.indexOf('npm run aria:visual-evidence:check'),
    );
  });

  test('ARIA_CI_REJECTS_LANE_ABSENT_FROM_CI_SUCCESS_NEEDS', () => {
    const document = passingDocument();
    document.jobs['ci-success'].needs = document.jobs['ci-success'].needs
      .filter((job) => job !== 'aria-browser');

    expect(inspectAriaCiWorkflow(document).findings).toContain('ARIA_CI_AGGREGATE_NEED_MISSING:aria-browser');
  });

  test('ARIA_CI_REQUIRES_STRUCTURED_ALL_NEEDS_RESULT_ASSERTION', () => {
    const document = passingDocument();
    const assertion = document.jobs['ci-success'].steps.find((step) =>
      step.run === 'node scripts/github/assert-ci-needs.mjs');
    assertion.run = 'echo "node scripts/github/assert-ci-needs.mjs"';
    delete assertion.env.CI_NEEDS_JSON;

    expect(inspectAriaCiWorkflow(document).findings).toContain('ARIA_CI_AGGREGATE_ASSERTION_INVALID');
  });

  test('ARIA_CI_REJECTS_NONCANONICAL_PR_HEAD_CHECKOUT', () => {
    const document = passingDocument();
    const checkout = document.jobs['aria-browser'].steps.find((step) =>
      String(step.uses ?? '').startsWith('actions/checkout@'));
    delete checkout.with.ref;

    expect(inspectAriaCiWorkflow(document).findings).toContain('ARIA_CI_HEAD_CHECKOUT_UNSEALED:aria-browser');
  });
});
