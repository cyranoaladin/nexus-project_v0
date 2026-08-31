import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/candidat-individuel-release.yml');
const RELEASE_BRANCH = 'release/candidat-individuel-prod-final';
const RELEASE_WORKFLOW = '.github/workflows/candidat-individuel-release.yml';

type WorkflowStep = { name?: string; uses?: string; run?: string; with?: Record<string, unknown> };
type WorkflowJob = { name?: string; needs?: string[] | string; steps?: WorkflowStep[]; [key: string]: unknown };
type Workflow = {
  on: {
    push?: { branches?: string[] };
    workflow_dispatch?: { inputs?: Record<string, { required?: boolean; type?: string }> };
  };
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs?: Record<string, WorkflowJob>;
};

function parseWorkflow() {
  const source = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  return { source, workflow: yaml.load(source) as Workflow };
}

function commands(job: WorkflowJob) {
  return (job.steps ?? []).map((step) => step.run ?? '').join('\n');
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
    expect(integration).toContain('npm run test:integration');
    expect(integration).not.toContain('prisma db push');
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
    const build = workflow.jobs!['build-artifact'];
    const e2e = workflow.jobs!['candidate-e2e'];
    const buildSource = JSON.stringify(build);
    const e2eSource = JSON.stringify(e2e);

    expect((source.match(/npm run build(?!:)/g) ?? [])).toHaveLength(1);
    expect(buildSource).toContain('NEXUS_RELEASE_SOURCE_SHA');
    expect(buildSource).toContain('${{ github.sha }}');
    expect(commands(build)).toContain('npm run artifact:audit');
    expect(commands(build)).toContain('npm run security:forbidden-artifacts:artifact');
    expect(commands(build)).toContain('verify-standalone-artifact.mjs');
    expect(commands(build)).toContain('test -f .next/standalone/server.js');
    expect(buildSource).toContain('candidate-release-build-${{ github.sha }}');
    expect(e2eSource).toContain('candidate-release-build-${{ github.sha }}');
    expect(e2eSource).toContain('actions/download-artifact@');
    expect(commands(e2e)).not.toMatch(/npm run build|next build|build:e2e/);
    expect(commands(e2e)).toContain('--project=candidate-bundled-chromium');
    expect(commands(e2e)).toContain('--project=candidate-google-chrome-152');
    expect(commands(e2e)).toContain('verify-standalone-artifact.mjs');
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
