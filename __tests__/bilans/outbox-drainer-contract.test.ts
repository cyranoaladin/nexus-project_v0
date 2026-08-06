import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

describe('Canonical scoring outbox drainer boundary', () => {
  test('keeps scoring asynchronous and exposes a manual-only entrypoint', () => {
    const submit = readFileSync(resolve(ROOT, 'lib/bilans/api/submit-attempt.ts'), 'utf8');
    const script = readFileSync(resolve(ROOT, 'scripts/bilans/drain-scoring-outbox.ts'), 'utf8');

    expect(submit).not.toContain('processScoreAttemptJob');
    expect(submit).not.toContain('drainScoreAttemptJobs');
    expect(script).toContain('drainScoreAttemptJobs');
    expect(script).not.toMatch(/cron|setInterval|setTimeout/);
  });

  test('exposes an equivalent manual-only entrypoint for report generation, so a stopped scheduler never strands attempts at SCORED', () => {
    const script = readFileSync(resolve(ROOT, 'scripts/bilans/drain-report-generation-outbox.ts'), 'utf8');

    expect(script).toContain('drainGenerateReportJobs');
    expect(script).not.toContain('drainScoreAttemptJobs');
    expect(script).not.toMatch(/cron|setInterval|setTimeout/);
  });

  test('documents the exact manual commands without enabling a scheduler', () => {
    const operations = readFileSync(resolve(ROOT, 'ops/bilans/drainage-outbox.md'), 'utf8');

    expect(operations).toContain('scripts/bilans/drain-scoring-outbox.ts');
    expect(operations).toContain('scripts/bilans/drain-report-generation-outbox.ts');
    expect(operations).toContain('--limit');
    expect(operations).toContain('Aucun daemon');
  });
});
