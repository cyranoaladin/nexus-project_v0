const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflowPath = path.join(process.cwd(), '.github/workflows/ci.yml');
const workflowSource = fs.readFileSync(workflowPath, 'utf8');
const workflow = yaml.load(workflowSource);

const independentEvidenceJobs = [
  'lint',
  'typecheck',
  'unit',
  'integration',
  'real-db-integration',
  'e2e',
  'security',
  'build',
  'documents',
];
const requiredJobs = ['dependency-integrity', ...independentEvidenceJobs];

function jobSource(job) {
  return JSON.stringify(job);
}

describe('PR #79 complete CI evidence workflow', () => {
  test('is valid YAML and runs for every pull request base branch', () => {
    expect(workflow).toBeTruthy();
    expect(workflow.jobs).toBeTruthy();

    const pullRequest = workflow.on.pull_request;
    // A null mapping is the parsed form of `pull_request:` with no branch
    // filter. This includes main, the historical PR #79 release branch and
    // every stacked feature base without encoding temporary branch names.
    expect(pullRequest).toBeNull();
  });

  test.each(independentEvidenceJobs)(
    '%s executes independently of Dependency Integrity and other jobs',
    (jobName) => {
      expect(workflow.jobs[jobName]).toBeTruthy();
      expect(workflow.jobs[jobName].needs).toBeUndefined();
    },
  );

  test('keeps Dependency Integrity strict and unchanged in substance', () => {
    const gate = workflow.jobs['dependency-integrity'];
    const source = jobSource(gate);
    const runCommands = gate.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(gate['continue-on-error']).not.toBe(true);
    expect(source).not.toContain('"continue-on-error":true');
    expect(runCommands).toContain('npm audit --omit=dev --audit-level=high');
    expect(runCommands).toContain('npm audit --audit-level=high');
    expect(runCommands).not.toMatch(/npm audit[^\n]*\|\|\s*true/);
    expect(runCommands).not.toMatch(/--audit-level=(?:low|moderate)/);
  });

  test('requires clean audits and preserves both SBOMs without any exception path', () => {
    const gate = workflow.jobs['dependency-integrity'];
    const source = jobSource(gate);
    const runCommands = gate.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(runCommands).toContain('npm run security:brace-expansion');
    expect(runCommands).toContain('npm run sbom:full');
    expect(runCommands).toContain('npm run sbom:runtime');
    expect(runCommands).not.toContain(
      'scripts/security/validate-dev-tooling-exception.mjs',
    );
    expect(source).not.toContain('PRE_RENTREE_DEV_TOOLING_EXCEPTION_JSON');
    expect(source).toContain('npm-audit-production.json');
    expect(source).toContain('npm-audit-full.json');
    expect(source).toContain('security/sbom/full.cdx.json');
    expect(source).toContain('security/sbom/runtime.cdx.json');
    expect(
      gate.steps.find((step) => step.name === 'Upload dependency evidence').if,
    ).toBe('always()');
    expect(runCommands).not.toMatch(/exit\s+0\s*(?:#.*)?$/m);
  });

  test('keeps OSV blocking without any exception path', () => {
    const security = workflow.jobs.security;
    const source = jobSource(security);
    const runCommands = security.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(runCommands).toContain('./osv-scanner --lockfile=package-lock.json');
    expect(runCommands).not.toContain(
      'scripts/security/validate-dev-tooling-exception.mjs',
    );
    expect(source).not.toContain('PRE_RENTREE_DEV_TOOLING_EXCEPTION_JSON');
    expect(source).toContain('osv-report.json');
    expect(
      security.steps.find((step) => step.name === 'Upload OSV report').if,
    ).toBe('always()');
  });

  test('audits traces and the exact standalone artifact before upload', () => {
    const build = workflow.jobs.build;
    const commands = build.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(commands).toContain('npm run artifact:traces');
    expect(commands).toContain('npm run artifact:audit');
    expect(commands.indexOf('npm run artifact:audit')).toBeLessThan(
      commands.indexOf('node .next/standalone/server.js'),
    );
  });

  test('makes CI Success fail closed for every required result', () => {
    const aggregate = workflow.jobs['ci-success'];
    const aggregateSource = jobSource(aggregate);
    const run = aggregate.steps.find((step) => step.run).run;

    expect(aggregate.if).toBe('${{ always() }}');
    expect(new Set(aggregate.needs)).toEqual(new Set(requiredJobs));

    for (const jobName of requiredJobs) {
      expect(run).toContain(
        `${jobName}:\${{ needs.${jobName}.result }}`,
      );
    }

    expect(run).toContain('if [ "$result" != "success" ]');
    expect(aggregateSource).not.toMatch(/allow.*cancelled/i);
    expect(aggregateSource).not.toContain('E2E_RESULT');
    expect(aggregateSource).not.toContain('!cancelled()');
  });

  test('runs the allowed real PostgreSQL suites after existing migrations', () => {
    const realDb = workflow.jobs['real-db-integration'];
    const source = jobSource(realDb);
    const commands = realDb.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(realDb.services.postgres.image).toBe('pgvector/pgvector:pg16');
    expect(realDb.services.postgres.env.POSTGRES_PASSWORD).toBe(
      '${{ github.run_id }}',
    );
    expect(source).toContain('pg_isready');
    expect(commands).toContain('npx prisma migrate deploy');
    expect(commands).toContain(
      '__tests__/integration/activate-student.real.test.ts',
    );
    expect(commands).toContain(
      '__tests__/integration/predict-ownership.real.test.ts',
    );
    expect(commands).toContain('__tests__/security/idor-real.test.ts');
    expect(commands).not.toContain('__tests__/lib/bilan/');
    expect(commands).not.toContain('prisma db push');
    expect(commands).not.toMatch(/\bseed\b/i);
    expect(source).not.toContain('${{ secrets.');
    expect(source).toContain('"NEXTAUTH_SECRET":"${{ github.sha }}"');
  });

  test('keeps protected Bilan real tests outside general integration evidence', () => {
    const integration = workflow.jobs.integration;
    const commands = integration.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(commands).toContain(
      "--testPathIgnorePatterns='/__tests__/lib/bilan/'",
    );
    expect(commands).not.toContain('npm run test:db-integration');
  });

  test('verifies frozen public documents without regenerating them', () => {
    const documents = workflow.jobs.documents;
    const commands = documents.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(commands).toContain('npm run pre-rentree:public-pdfs:verify');
    expect(commands).not.toContain('npm run pre-rentree:public-pdfs\n');
    expect(commands).toContain('git diff --exit-code');
    expect(commands).toContain('git status --short');
  });
});
