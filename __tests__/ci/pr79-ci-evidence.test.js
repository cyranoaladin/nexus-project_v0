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
  // Gate des parcours authentifiés (playwright.auth.config.ts) : requis
  // depuis #134 — c'est l'angle mort par lequel les défauts d'enchaînement
  // passaient malgré des CI vertes.
  'e2e-auth',
  'security',
  'build',
  'documents',
  'bilan-runtime-real-db',
];
const ariaQualificationJobs = [
  'aria-jest',
  'aria-postgres',
  'aria-static',
  'aria-coverage',
  'aria-browser',
  'aria-evidence',
];
const requiredJobs = [
  'dependency-integrity',
  ...independentEvidenceJobs,
  ...ariaQualificationJobs,
];

function jobSource(job) {
  return JSON.stringify(job);
}

describe('PR #79 complete CI evidence workflow', () => {
  test('contains no active revoked dependency scanner exception', () => {
    expect(fs.existsSync(path.join(
      process.cwd(),
      'security/brace-expansion-backport-attestation.json',
    ))).toBe(false);
    expect(fs.existsSync(path.join(
      process.cwd(),
      'scripts/security/validate-brace-expansion-attestation.mjs',
    ))).toBe(false);
    expect(workflowSource).not.toContain('brace-expansion-backport-attestation');
    expect(workflowSource).not.toContain('validate-brace-expansion-attestation');
  });

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

    // Production audit step must call the canonical wrapper with exact flags
    const prodStep = gate.steps.find((step) => step.name === 'Audit production dependencies');
    expect(prodStep).toBeTruthy();
    expect(prodStep.run).toContain('node scripts/security/run-npm-audit.mjs');
    expect(prodStep.run).toContain('--output=npm-audit-production.json');
    expect(prodStep.run).toContain('--omit=dev');
    expect(prodStep.run).toContain('--audit-level=high');

    // Full audit step must call the canonical wrapper with exact flags
    const fullStep = gate.steps.find((step) => step.name === 'Audit all dependencies without exceptions');
    expect(fullStep).toBeTruthy();
    expect(fullStep.run).toContain('node scripts/security/run-npm-audit.mjs');
    expect(fullStep.run).toContain('--output=npm-audit-full.json');
    expect(fullStep.run).toContain('--audit-level=high');

    // Fail-closed guards
    expect(runCommands).not.toMatch(/(?:npm audit|run-npm-audit)[^\n]*\|\|\s*true/);
    expect(runCommands).not.toMatch(/--audit-level=(?:low|moderate)/);
    expect(runCommands).not.toMatch(/--audit-level\s+(?:low|moderate)/);
  });

  test('keeps the full npm audit blocking with no advisory exception path', () => {
    const gate = workflow.jobs['dependency-integrity'];
    const source = jobSource(gate);
    const fullAuditRun = gate.steps.find(
      (step) => step.name === 'Audit all dependencies without exceptions',
    ).run;

    expect(fullAuditRun).toContain('node scripts/security/run-npm-audit.mjs');
    expect(fullAuditRun).toContain('--audit-level=high');
    expect(fullAuditRun).toContain('--output=npm-audit-full.json');
    expect(fullAuditRun).not.toContain('validate-brace-expansion-attestation');
    expect(fullAuditRun).not.toContain('--attestation');
    expect(fullAuditRun).not.toContain('set +e');
    expect(fullAuditRun).not.toMatch(/audit_code|FULL_AUDIT_EXIT_CODE/);
    expect(source).toContain('npm-audit-production.json');
    expect(source).toContain('npm-audit-full.json');
    expect(
      gate.steps.find((step) => step.name === 'Upload dependency evidence').if,
    ).toBe('always()');
    expect(fullAuditRun).not.toMatch(/exit\s+0\s*(?:#.*)?$/m);
  });

  test('keeps OSV blocking with no advisory exception path', () => {
    const security = workflow.jobs.security;
    const source = jobSource(security);
    const osvRun = security.steps.find((step) => step.name === 'Run OSV Scanner').run;

    expect(osvRun).toContain('./osv-scanner --lockfile=package-lock.json');
    expect(osvRun).not.toContain('validate-brace-expansion-attestation');
    expect(osvRun).not.toContain('--attestation');
    expect(osvRun).not.toContain('set +e');
    expect(osvRun).not.toMatch(/osv_code|OSV_EXIT_CODE/);
    expect(source).toContain('osv-report.json');
    expect(
      security.steps.find((step) => step.name === 'Upload OSV report').if,
    ).toBe('always()');
  });

  test('audits traces and the exact standalone artifact before upload', () => {
    const build = workflow.jobs.build;
    const upload = build.steps.find((step) => step.name === 'Upload build artifacts');
    const sizeReport = build.steps.find((step) => step.name === 'Check build size');
    const commands = build.steps
      .filter((step) => typeof step.run === 'string')
      .map((step) => step.run)
      .join('\n');

    expect(commands).toContain('npm run artifact:traces');
    expect(commands).toContain('npm run artifact:audit');
    expect(commands.indexOf('npm run artifact:audit')).toBeLessThan(
      commands.indexOf('node .next/standalone/server.js'),
    );
    expect(new Set(String(upload.with.path).trim().split(/\s+/))).toEqual(
      new Set(['.next/standalone/', 'release-manifest.json']),
    );
    expect(upload.with['include-hidden-files']).toBe(true);
    expect(upload.with['if-no-files-found']).toBe('error');
    expect(sizeReport.run).toContain('du -sh .next/standalone/');
    expect(sizeReport.run).not.toContain('du -sh .next/ ');
  });

  test('makes CI Success fail closed for every required result', () => {
    const aggregate = workflow.jobs['ci-success'];
    const aggregateSource = jobSource(aggregate);
    const assertionStep = aggregate.steps.find(
      (step) => step.run === 'node scripts/github/assert-ci-needs.mjs',
    );

    expect(aggregate.if).toBe('${{ always() }}');
    expect(new Set(aggregate.needs)).toEqual(new Set(requiredJobs));
    expect(assertionStep).toBeTruthy();
    expect(assertionStep.env.CI_NEEDS_JSON).toBe('${{ toJSON(needs) }}');
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
