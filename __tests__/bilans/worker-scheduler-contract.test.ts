import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const source = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

describe('Canonical bilan worker scheduler', () => {
  test('is wired into server startup', () => {
    expect(source('instrumentation.ts')).toContain('startBilanWorkerScheduler');
  });

  test('drains both job types, gated by BILAN_WORKER_ENABLED, off by default', () => {
    const scheduler = source('lib/bilans/worker/scheduler.ts');
    expect(scheduler).toContain('BILAN_WORKER_ENABLED');
    expect(scheduler).toContain('drainScoreAttemptJobs');
    expect(scheduler).toContain('drainGenerateReportJobs');
    expect(scheduler).not.toMatch(/BILAN_WORKER_ENABLED_REQUIRED|CONFIGURATION_REQUIRED/);
  });

  test('does not duplicate the manual-only drain contract', () => {
    const submit = source('lib/bilans/api/submit-attempt.ts');
    expect(submit).not.toContain('startBilanWorkerScheduler');
  });
});
