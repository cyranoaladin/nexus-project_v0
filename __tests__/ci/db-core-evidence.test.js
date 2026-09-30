const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflow = yaml.load(fs.readFileSync(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8'));

describe('mandatory db-core evidence', () => {
  const steps = workflow.jobs['real-db-integration'].steps;
  const run = steps.find((step) => step.name === 'Run core real database suites (concurrency, schema, transactions)');
  const upload = steps.find((step) => step.name === 'Upload real database logs');

  it('captures a log and Jest result while preserving Jest exit status', () => {
    expect(run.id).toBe('db_core');
    expect(run.run).toContain('set -o pipefail');
    expect(run.run).toContain('npm run test:db:core -- --json --outputFile=db-core-jest-results.json');
    expect(run.run).toMatch(/2>&1\s*\|\s*tee\s+-a\s+db-core-jest\.log/);
  });

  it('uploads the mandatory log even when Jest fails, with exact run provenance', () => {
    expect(upload.if).toBe("always() && steps.db_core.outcome != 'skipped'");
    expect(upload.with.name).toContain('github.sha');
    expect(upload.with.name).toContain('github.run_id');
    expect(upload.with.name).toContain('github.run_attempt');
    expect(String(upload.with.path)).toContain('db-core-jest.log');
    expect(String(upload.with.path)).toContain('db-core-jest-results.json');
    expect(upload.with['if-no-files-found']).toBe('error');
  });
});
