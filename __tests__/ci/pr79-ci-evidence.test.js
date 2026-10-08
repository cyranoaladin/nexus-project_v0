const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflowPath = path.join(process.cwd(), '.github/workflows/ci.yml');
const workflowSource = fs.readFileSync(workflowPath, 'utf8');
const workflow = yaml.load(workflowSource);

// The database image is pinned by digest and owned by the container image
// registry. Asserting a literal tag here would both fail and re-create a second
// place that decides which image CI runs.
const containerImages = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), '.github/governance/container-images.json'),
    'utf8',
  ),
);

function registeredImage(logicalName) {
  const image = containerImages.images.find(
    (candidate) => candidate.logicalName === logicalName,
  );
  if (!image) throw new Error(`Unregistered container image: ${logicalName}`);
  return `${image.repository}@${image.digest}`;
}

const POSTGRES_PG16 = registeredImage('ci-postgres-pgvector-pg16');

const independentEvidenceJobs = [
  'lint',
  'typecheck',
  'unit',
  'integration',
  'real-db-integration',
  // Core v2 foundation (feat/core-v2-greenfield-foundation §23): its own
  // disposable Postgres lane, proves the greenfield baseline/client/
  // repository layer independently of the legacy real-db-integration suite.
  'core-v2-foundation',
  'e2e',
  // Gate des parcours authentifiés (playwright.auth.config.ts) : requis
  // depuis #134 — c'est l'angle mort par lequel les défauts d'enchaînement
  // passaient malgré des CI vertes. Split into two parallel jobs
  // (AUTH_E2E_JOB_TIME_BUDGET_EXCEEDED — the combined job outgrew its
  // 30-minute budget as e2e/auth gained coverage).
  'e2e-auth-chromium',
  'e2e-auth-cross-browser',
  'build',
  // Explicit DISABLED delivery mode must prove a production standalone build
  // independently of the legacy JITSI Production Build lane.
  'preview-video-disabled',
  'documents',
  'bilan-runtime-real-db',
  // Real Nginx SSE streaming: proves the repository's own proxy configuration
  // streams incrementally rather than only that it parses. `nginx -t` would
  // have accepted the buffering regression this gate exists to catch.
  'nginx-sse-streaming',
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
  'security',
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

  test('Security Scan waits for exact-run build evidence but still executes when an upstream job fails', () => {
    const security = workflow.jobs.security;
    expect(security.needs).toEqual(['dependency-integrity', 'build']);
    expect(security.if).toBe('${{ always() }}');
    const verification = security.steps.find((step) => step.name === 'Verify runtime evidence job');
    expect(verification.run).toContain('needs.dependency-integrity.result');
  });

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
    const fullStep = gate.steps.find((step) =>
      step.name === 'Audit all dependencies at the canonical threshold (HIGH/CRITICAL fail closed)');
    expect(fullStep).toBeTruthy();
    expect(fullStep.run).toContain('node scripts/security/run-npm-audit.mjs');
    expect(fullStep.run).toContain('--output=npm-audit-full.json');
    expect(fullStep.run).toContain('--audit-level=high');

    // Fail-closed guards
    expect(runCommands).not.toMatch(/(?:npm audit|run-npm-audit)[^\n]*\|\|\s*true/);
    expect(runCommands).not.toMatch(/--audit-level=(?:low|moderate)/);
    expect(runCommands).not.toMatch(/--audit-level\s+(?:low|moderate)/);
  });

  test('keeps the full npm audit blocking: HIGH/CRITICAL fail closed, no standing exception', () => {
    const gate = workflow.jobs['dependency-integrity'];
    const source = jobSource(gate);
    const fullAuditRun = gate.steps.find(
      (step) => step.name === 'Audit all dependencies at the canonical threshold (HIGH/CRITICAL fail closed)',
    ).run;

    expect(fullAuditRun).toContain('node scripts/security/run-npm-audit.mjs');
    expect(fullAuditRun).toContain('--audit-level=high');
    expect(fullAuditRun).toContain('--output=npm-audit-full.json');
    expect(fullAuditRun).not.toContain('validate-brace-expansion-attestation');
    expect(fullAuditRun).not.toContain('--attestation');
    expect(fullAuditRun).toContain('elif [ "$audit_code" -eq 1 ]');
    // OSV_THRESHOLD_AWARE_FAIL_CLOSED: a HIGH/CRITICAL finding is a hard stop,
    // not a policy-waived exception — the obsolete dev-tooling policy is removed.
    expect(fullAuditRun).toContain('exit 1');
    expect(fullAuditRun).not.toContain('--mode current-npm-audit');
    expect(fullAuditRun).not.toContain('current-dev-tooling-osv-exception.json');
    expect(fullAuditRun).not.toContain('|| true');
    expect(source).toContain('npm-audit-production.json');
    expect(source).toContain('npm-audit-full.json');
    expect(
      gate.steps.find((step) => step.name === 'Upload dependency evidence').if,
    ).toBe('always()');
    expect(fullAuditRun).not.toMatch(/exit\s+0\s*(?:#.*)?$/m);
  });

  test('keeps OSV blocking, with only exact findings allowed after physical runtime proof', () => {
    const security = workflow.jobs.security;
    const source = jobSource(security);
    const osvRun = security.steps.find((step) => step.name === 'Run OSV Scanner').run;

    expect(osvRun).toContain('./osv-scanner --lockfile=package-lock.json');
    expect(osvRun).not.toContain('validate-brace-expansion-attestation');
    expect(osvRun).not.toContain('--attestation');
    expect(security.steps.find((step) => step.name === 'Run OSV Scanner').id).toBe('osv_scan');
    expect(osvRun).toContain('osv_code');
    // OSV_THRESHOLD_AWARE_FAIL_CLOSED: a single tri-state gate replaces the clean/
    // exception branches. It fails closed on anything but CLEAN / BOUNDED_BELOW_THRESHOLD.
    const gateStep = security.steps.find((step) =>
      step.name === 'Validate OSV findings (threshold-aware, fail closed)');
    expect(gateStep).toBeTruthy();
    expect(gateStep.run).toContain('scripts/security/osv-threshold-gate.mjs');
    expect(gateStep.run).toContain('--baseline security/osv-below-threshold-baseline.json');
    expect(gateStep.run).toContain('--scanner-exit');
    expect(gateStep.run).toContain('--production-tree');
    expect(gateStep.run).not.toContain('|| true');
    expect(gateStep.run).not.toContain('continue-on-error');
    // The obsolete braces/http-cache-semantics exception and its validator are gone.
    expect(security.steps.find((step) => step.name === 'Validate exact temporary OSV exception')).toBeUndefined();
    expect(security.steps.find((step) => step.name === 'Validate clean OSV result')).toBeUndefined();
    expect(source).not.toContain('current-dev-tooling-osv-exception.json');
    // Only the production-tree evidence is downloaded now (no standalone needed by the gate).
    expect(security.steps.filter((step) => step.uses?.startsWith('actions/download-artifact@'))
      .map((step) => step.with.name)).toEqual(['dependency-integrity-evidence']);
    expect(source).toContain('osv-report.json');
    expect(source).toContain('osv-gate-normalized.txt');
    expect(
      security.steps.find((step) => step.name?.startsWith('Upload OSV report')).if,
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
      new Set(['.next/standalone/', 'release-manifest.json', 'security/sbom/runtime.cdx.json']),
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

    expect(realDb.services.postgres.image).toBe(POSTGRES_PG16);
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
    expect(bilanRuntime.services.postgres.image).toBe(POSTGRES_PG16);
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
