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
  'db-order-matrix',
  'real-db-integration',
  'e2e',
  // Gate des parcours authentifiés (playwright.auth.config.ts) : requis
  // depuis #134 — c'est l'angle mort par lequel les défauts d'enchaînement
  // passaient malgré des CI vertes.
  'e2e-auth',
  'security',
  'build',
  'documents',
  'bilan-runtime-real-db',
];
const requiredJobs = ['dependency-integrity', ...independentEvidenceJobs];

function jobSource(job) {
  return JSON.stringify(job);
}

describe('PR #79 complete CI evidence workflow', () => {
  test('is valid YAML and runs for the stacked PR base branch', () => {
    expect(workflow).toBeTruthy();
    expect(workflow.jobs).toBeTruthy();

    const pullRequest = workflow.on.pull_request;
    expect(pullRequest.branches).toEqual(
      expect.arrayContaining(['main', 'release/pre-rentree-2026-public-ready']),
    );
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

  test('accepts only the schema-validated exact exception while preserving raw audits', () => {
    const gate = workflow.jobs['dependency-integrity'];
    const source = jobSource(gate);
    const runCommands = gate.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(runCommands).toContain(
      'scripts/security/validate-brace-expansion-attestation.mjs',
    );
    expect(runCommands).toContain('--mode npm');
    expect(runCommands).toContain(
      '--attestation security/brace-expansion-backport-attestation.json',
    );
    expect(runCommands).toContain('--lockfile package-lock.json');
    expect(runCommands).toContain('--production-audit');
    expect(runCommands).toContain('--runtime-sbom');
    expect(source).not.toContain('PRE_RENTREE_DEV_TOOLING_EXCEPTION_JSON');
    expect(source).toContain('npm-audit-production.json');
    expect(source).toContain('npm-audit-full.json');
    expect(
      gate.steps.find((step) => step.name === 'Upload dependency evidence').if,
    ).toBe('always()');
    expect(runCommands).not.toMatch(/exit\s+0\s*(?:#.*)?$/m);
  });

  test('keeps OSV blocking unless the same exact exception validates', () => {
    const security = workflow.jobs.security;
    const source = jobSource(security);
    const runCommands = security.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(runCommands).toContain(
      'scripts/security/validate-brace-expansion-attestation.mjs',
    );
    expect(runCommands).toContain('--mode osv');
    expect(runCommands).toContain(
      '--attestation security/brace-expansion-backport-attestation.json',
    );
    expect(runCommands).toContain('--lockfile package-lock.json');
    expect(source).not.toContain('PRE_RENTREE_DEV_TOOLING_EXCEPTION_JSON');
    expect(source).toContain('osv-report.json');
    expect(
      security.steps.find((step) => step.name === 'Upload OSV report').if,
    ).toBe('always()');
  });

  test('audits traces and the exact standalone artifact before upload', () => {
    const build = workflow.jobs.build;
    const packageScripts = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
    ).scripts;
    const commands = build.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(commands).toContain('npm run artifact:traces');
    expect(commands).toContain('npm run build');
    expect(packageScripts.build).toContain('npm run artifact:audit');
    expect((packageScripts.build.match(/npm run artifact:audit/g) || [])).toHaveLength(1);
    expect(commands).not.toContain('npm run artifact:audit');
    expect(commands.indexOf('npm run build')).toBeLessThan(commands.indexOf('node .next/standalone/server.js'));
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
    expect(commands).not.toContain('__tests__/lib/bilan-runtime/');
    expect(commands).not.toContain('prisma db push');
    expect(commands).not.toMatch(/\bseed\b/i);
    expect(source).not.toContain('${{ secrets.');
    expect(source).toContain('"NEXTAUTH_SECRET":"${{ github.sha }}"');
  });

  test('keeps protected Bilan real tests outside general integration evidence', () => {
    const integration = workflow.jobs.integration;
    const bilanRuntime = workflow.jobs['bilan-runtime-real-db'];
    const commands = integration.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');
    const bilanRuntimeCommands = bilanRuntime.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(commands).toContain(
      "--testPathIgnorePatterns='/__tests__/lib/bilan-runtime/'",
    );
    expect(commands).not.toContain('npm run test:db-integration');
    expect(bilanRuntime.services.postgres.image).toBe('pgvector/pgvector:pg16');
    expect(bilanRuntimeCommands).toContain('npx prisma migrate deploy');
    expect(bilanRuntimeCommands).toContain(
      '__tests__/lib/bilan-runtime/bilan-schema.real.test.ts',
    );
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
