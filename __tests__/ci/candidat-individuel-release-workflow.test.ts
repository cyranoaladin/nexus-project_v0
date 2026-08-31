import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/candidat-individuel-release.yml');
const RELEASE_BRANCH = 'release/candidat-individuel-prod-final';
const RELEASE_WORKFLOW = '.github/workflows/candidat-individuel-release.yml';
const NPC_HARNESS_PATH = path.join(ROOT, 'scripts/testing/run-npc-real-db-tests.sh');

type WorkflowStep = { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; 'timeout-minutes'?: number };
type WorkflowJob = {
  name?: string;
  needs?: string[] | string;
  steps?: WorkflowStep[];
  services?: Record<string, { image?: string }>;
  'timeout-minutes'?: number;
  [key: string]: unknown;
};
type Workflow = {
  on: {
    push?: { branches?: string[] };
    workflow_dispatch?: { inputs?: Record<string, { required?: boolean; type?: string }> };
  };
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  env?: Record<string, unknown>;
  jobs?: Record<string, WorkflowJob>;
};

function parseWorkflow() {
  const source = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  return { source, workflow: yaml.load(source) as Workflow };
}

function commands(job: WorkflowJob) {
  return (job.steps ?? []).map((step) => step.run ?? '').join('\n');
}

function findNpcRealSuites(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findNpcRealSuites(absolutePath);
    return /^npc-.*\.real\.test\.ts$/.test(entry.name)
      ? [path.relative(ROOT, absolutePath)]
      : [];
  }).sort();
}

describe('governed candidate individual release workflow', () => {
  it('runs only for the governed branch or a dispatch bound to its selected head', () => {
    const { source, workflow } = parseWorkflow();

    expect(workflow.on.push?.branches).toEqual([RELEASE_BRANCH]);
    expect(workflow.on.workflow_dispatch?.inputs?.release_sha).toMatchObject({
      required: true,
      type: 'string',
    });
    expect(source).not.toMatch(/pull_request:|refs\/heads\/main|git\s+(?:merge|rebase)\b/);
    expect(workflow.concurrency).toEqual({
      group: 'candidat-individuel-release-${{ github.sha }}',
      'cancel-in-progress': false,
    });
  });

  it('pins every job checkout to the exact event SHA and verifies HEAD before work', () => {
    const { workflow } = parseWorkflow();
    const jobs = workflow.jobs ?? {};

    expect(Object.keys(jobs)).toEqual(expect.arrayContaining([
      'source-gates',
      'db-order-matrix',
      'integration',
      'build-artifact',
      'candidate-e2e',
      'ci-success',
    ]));
    for (const [jobId, job] of Object.entries(jobs)) {
      const checkout = (job.steps ?? []).find((step) => step.uses?.startsWith('actions/checkout@'));
      const verify = (job.steps ?? []).find((step) => step.name === 'Verify exact source SHA');
      expect({ jobId, checkout: checkout?.with }).toMatchObject({
        jobId,
        checkout: { ref: '${{ github.sha }}' },
      });
      expect({ jobId, verify: verify?.run }).toMatchObject({
        jobId,
        verify: expect.stringContaining('git rev-parse HEAD'),
      });
      expect(verify?.run).toContain('GITHUB_SHA');
      expect(verify?.run).toContain('RELEASE_DISPATCH_SHA');
      expect(verify?.run).toContain('refs/heads/release/candidat-individuel-prod-final');
    }
  });

  it('runs the complete source, unit, security and integration gates', () => {
    const { workflow } = parseWorkflow();
    const source = commands(workflow.jobs!['source-gates']);
    const integration = commands(workflow.jobs!.integration);

    expect(source).toContain('npm ci');
    expect(source).toContain('npx prisma generate');
    expect(source).toContain('npx prisma validate');
    expect(source).toContain('npm run typecheck');
    expect(source).toContain('npm run lint');
    expect(source).toContain('npm test -- --runInBand');
    expect(source).toContain('__tests__/architecture/t4-v1-release-freeze.test.ts');
    expect(source).toContain('npm run security:forbidden-artifacts');
    expect(source).toContain('npm run security:legacy-search-consumers');
    expect(source).toContain('npm run security:repo');
    expect(source).toContain('npm run check:test-quarantines');
    expect(integration).toContain('npx jest --config jest.integration.config.js --runInBand --ci');
    const ignoredNpcPattern = integration.match(/--testPathIgnorePatterns='([^']+)'/)?.[1];
    expect(ignoredNpcPattern).toBe('__tests__/integration/(?:.*/)?npc-[^/]*\\.real\\.test\\.ts$');
    const ignoredNpcRegex = new RegExp(ignoredNpcPattern!);
    expect(ignoredNpcRegex.test('/repo/__tests__/integration/npc-root.real.test.ts')).toBe(true);
    expect(ignoredNpcRegex.test('/repo/__tests__/integration/nested/npc-child.real.test.ts')).toBe(true);
    expect(ignoredNpcRegex.test('/repo/__tests__/security/npc-policy.real.test.ts')).toBe(false);
    expect(integration).toContain('bash scripts/testing/run-npc-real-db-tests.sh --all');
    expect(integration).not.toMatch(/run-npc-real-db-tests\.sh\s+\\?\n\s+__tests__\/integration\/npc-/);
    expect(integration).not.toContain('npm run test:integration');
    expect(integration).not.toContain('prisma db push');
  });

  it('runs every real NPC suite through an immutable Node 22 and PostgreSQL harness', () => {
    const { workflow } = parseWorkflow();
    const integration = commands(workflow.jobs!.integration);
    const harness = fs.readFileSync(NPC_HARNESS_PATH, 'utf8');
    const npcInventory = findNpcRealSuites(path.join(ROOT, '__tests__/integration'));

    expect(npcInventory).toHaveLength(3);
    expect(integration).toContain('run-npc-real-db-tests.sh --all');
    expect(integration).toContain('NPC_RUNTIME_EVIDENCE_PATH=reports/npc-runtime.txt');
    expect(harness).toContain("find __tests__/integration -type f -name 'npc-*.real.test.ts'");
    expect(harness).not.toContain('-maxdepth');
    expect(harness).toContain("NODE_IMAGE='node:22.23.1-bookworm@sha256:5647be709086c696ff32edaaf1c70cd26d1da6ab2b39c32f3c7b4c4a31957e37'");
    expect(harness).toContain("POSTGRES_IMAGE='pgvector/pgvector:pg15@sha256:a947c45cdc5906a1bc951f20a8709e321256343ee0f251e4ae00b5e7def4e6da'");
    expect(harness).toContain("EXPECTED_NODE_VERSION='v22.23.1'");
    expect(harness).toContain('test "$(node --version)" = "$EXPECTED_NODE_VERSION"');
    for (const suite of npcInventory) {
      expect(harness).not.toContain(suite);
    }
  });

  it('provisions the complete Git and PDF runtime required by the full unit suite', () => {
    const { workflow } = parseWorkflow();
    const sourceJob = workflow.jobs!['source-gates'];
    const source = commands(sourceJob);
    const checkout = sourceJob.steps!.find((step) => step.uses?.startsWith('actions/checkout@'));

    expect(checkout?.with).toMatchObject({
      ref: '${{ github.sha }}',
      'fetch-depth': 0,
    });
    expect(source).toContain('poppler-utils');
    expect(source).toContain('texlive-latex-base');
    expect(source).toContain('npx playwright install --with-deps chromium');
  });

  it('keeps nested Jest output stable and provisions every real integration dependency', () => {
    const { source, workflow } = parseWorkflow();
    const integration = workflow.jobs!.integration;
    const integrationSource = JSON.stringify(integration);
    const integrationCommands = commands(integration);

    expect(workflow.env?.FORCE_COLOR).toBe('0');
    expect(integration.services).toHaveProperty('mailpit');
    expect(integrationCommands).toContain('npx playwright install --with-deps chromium');
    expect(integrationSource).toContain('DOCUMENT_ENCRYPTION_KEY');
    expect(integrationSource).toContain('MAILPIT_API_URL');
    expect(integrationSource).toContain('SMTP_HOST');
    expect(integrationSource).toContain('SMTP_PORT');
    expect(source).not.toContain('session_replication_role=replica');
  });

  it('keeps the exact hermetic database matrix as a required status check', () => {
    const { source, workflow } = parseWorkflow();
    const matrix = workflow.jobs!['db-order-matrix'];
    const run = commands(matrix);

    expect(matrix.name).toBe('Hermetic DB Order Matrix');
    expect(run).toContain('run-db-order-matrix.mjs --migrate-only');
    expect(run).toContain('npm run test:db:order-matrix');
    expect(source).toContain('EXPECTED_DB_TESTS: 211');
    expect(source).toContain('EXPECTED_MIGRATIONS: 88');
    expect(source).toContain('nexus_disposable_release_test');
  });

  it('builds once and runs both governed browsers from that same uploaded artifact', () => {
    const { source, workflow } = parseWorkflow();
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const build = workflow.jobs!['build-artifact'];
    const e2e = workflow.jobs!['candidate-e2e'];
    const buildSource = JSON.stringify(build);
    const e2eSource = JSON.stringify(e2e);
    const buildCommands = commands(build);
    const e2eCommands = commands(e2e);
    const productionBuildStep = build.steps!.findIndex((step) => step.run === 'npm run build');
    const hashStep = build.steps![productionBuildStep + 1];

    expect((source.match(/npm run build(?!:)/g) ?? [])).toHaveLength(1);
    expect(buildSource).toContain('NEXUS_RELEASE_SOURCE_SHA');
    expect(buildSource).toContain('${{ github.sha }}');
    expect((pkg.scripts.build.match(/npm run artifact:audit/g) ?? [])).toHaveLength(1);
    expect((pkg.scripts.build.match(/npm run security:forbidden-artifacts:artifact/g) ?? [])).toHaveLength(1);
    expect((pkg.scripts.build.match(/verify-standalone-artifact\.mjs/g) ?? [])).toHaveLength(1);
    expect(buildCommands).not.toMatch(/npm run artifact:audit|security:forbidden-artifacts:artifact|verify-standalone-artifact\.mjs/);
    expect(e2eCommands).not.toMatch(/npm run artifact:audit|security:forbidden-artifacts:artifact|verify-standalone-artifact\.mjs/);
    expect(hashStep.name).toBe('Hash unchanged production artifact');
    expect(hashStep.run).toContain('test -f .next/standalone/server.js');
    expect(hashStep.run).toContain('artifact-tree.sha256');
    expect(hashStep.run).not.toMatch(/\bnpm\b|\bnode\b/);
    expect(buildSource).toContain('candidate-release-build-${{ github.sha }}');
    expect(e2eSource).toContain('candidate-release-build-${{ github.sha }}');
    expect(e2eSource).toContain('actions/download-artifact@');
    expect(e2eCommands).not.toMatch(/npm run build|next build|build:e2e/);
  });

  it('budgets the long candidate matrix as two independently bounded browser lanes', () => {
    const { workflow } = parseWorkflow();
    const e2e = workflow.jobs!['candidate-e2e'];
    const chromium = e2e.steps!.find((step) => step.name === 'Run bundled Chromium candidate lane');
    const chrome = e2e.steps!.find((step) => step.name === 'Run exact Chrome 152 candidate lane');

    expect(e2e['timeout-minutes']).toBeGreaterThanOrEqual(120);
    expect(chromium?.['timeout-minutes']).toBeGreaterThanOrEqual(40);
    expect(chrome?.['timeout-minutes']).toBeGreaterThanOrEqual(50);
    expect(chromium?.run).toContain('--project=candidate-bundled-chromium');
    expect(chromium?.run).not.toContain('candidate-google-chrome-152');
    expect(chrome?.run).toContain('--project=candidate-google-chrome-152');
    expect(chrome?.run).not.toContain('candidate-bundled-chromium');
  });

  it('pins every PostgreSQL, Redis and Mailpit service to reviewed immutable digests', () => {
    const { workflow } = parseWorkflow();
    const images = Object.values(workflow.jobs ?? {}).flatMap((job) =>
      Object.values(job.services ?? {}).map((service) => service.image),
    );

    expect(new Set(images)).toEqual(new Set([
      'pgvector/pgvector:pg15@sha256:a947c45cdc5906a1bc951f20a8709e321256343ee0f251e4ae00b5e7def4e6da',
      'redis:7-alpine@sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf',
      'axllent/mailpit:v1.30.6@sha256:7f33095f80e901f6ad08028f06ca284aa58fe84942be5496008d041d3b9f4d4d',
    ]));
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image).toMatch(/^[a-z0-9./-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$/);
    }
  });

  it('fails closed without skipped gates and aggregates every required job', () => {
    const { source, workflow } = parseWorkflow();
    const final = workflow.jobs!['ci-success'];

    expect(final.name).toBe('CI Success');
    expect(new Set(final.needs as string[])).toEqual(new Set([
      'source-gates',
      'db-order-matrix',
      'integration',
      'build-artifact',
      'candidate-e2e',
    ]));
    expect(commands(final)).toContain('if [ "$result" != "success" ]');
    expect(source).not.toMatch(/continue-on-error:\s*true|--passWithNoTests|\.skip\(|\.only\(/);
    expect(source).toContain('actions/upload-artifact@');
    expect(source).toContain('artifact-tree.sha256');
  });

  it('binds remote governance to this exact workflow and branch', () => {
    const qualified = fs.readFileSync(path.join(ROOT, 'scripts/release/qualified-release-core.mjs'), 'utf8');
    const remote = fs.readFileSync(path.join(ROOT, 'scripts/release/release-governance-core.mjs'), 'utf8');

    expect(qualified).toContain(`export const REQUIRED_RELEASE_BRANCH = '${RELEASE_BRANCH}'`);
    expect(qualified).toContain(`export const REQUIRED_RELEASE_WORKFLOW_PATH = '${RELEASE_WORKFLOW}'`);
    expect(remote).toContain('REQUIRED_RELEASE_BRANCH');
    expect(remote).toContain('REQUIRED_RELEASE_WORKFLOW_PATH');
    expect(remote).toContain('gh');
    expect(remote).toContain('check-runs');
    expect(remote).not.toContain('actions/workflows/ci.yml/runs');
  });
});
