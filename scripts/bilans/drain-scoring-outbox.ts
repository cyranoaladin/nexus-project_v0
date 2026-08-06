import { drainScoreAttemptJobs } from '../../lib/bilans/worker/drain-outbox';

function parseLimit(argv: readonly string[]): number {
  const index = argv.indexOf('--limit');
  if (index < 0) return 10;
  const value = Number(argv[index + 1]);
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new Error('Usage: drain-scoring-outbox.ts [--limit 1..100]');
  }
  return value;
}

drainScoreAttemptJobs({ limit: parseLimit(process.argv.slice(2)) })
  .then((result) => {
    console.info(JSON.stringify({ event: 'A87_MANUAL_DRAIN_RESULT', ...result }));
    process.exitCode = result.failed === 0 ? 0 : 1;
  })
  .catch(() => {
    console.error(JSON.stringify({ event: 'A87_MANUAL_DRAIN_FAILED' }));
    process.exitCode = 1;
  });
