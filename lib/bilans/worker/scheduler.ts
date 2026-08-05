import { drainGenerateReportJobs, drainScoreAttemptJobs } from './drain-outbox';

type SchedulerState = {
  timer?: NodeJS.Timeout;
  draining?: Promise<unknown>;
  signalsBound?: boolean;
};
const globalState = globalThis as typeof globalThis & { __nexusBilanWorkerScheduler?: SchedulerState };

function state(): SchedulerState {
  globalState.__nexusBilanWorkerScheduler ??= {};
  return globalState.__nexusBilanWorkerScheduler;
}

function intervalMs(): number {
  const value = Number(process.env.BILAN_WORKER_POLL_INTERVAL_MS || 5_000);
  if (!Number.isSafeInteger(value) || value < 250 || value > 60_000) throw new Error('BILAN_WORKER_INTERVAL_INVALID');
  return value;
}

/**
 * Score jobs run first, then report-generation jobs -- a freshly SCORED
 * attempt should get its GENERATE_REPORT job picked up on the very next
 * tick rather than waiting a full extra interval.
 */
export function kickBilanWorkerDrain(): void {
  if (process.env.BILAN_WORKER_ENABLED !== 'true') return;
  const current = state();
  if (current.draining) return;
  current.draining = (async () => {
    const scored = await drainScoreAttemptJobs();
    console.info(JSON.stringify({ event: 'BILAN_WORKER_SCORE_DRAIN_METRICS', ...scored }));
    const generated = await drainGenerateReportJobs();
    console.info(JSON.stringify({ event: 'BILAN_WORKER_GENERATE_REPORT_DRAIN_METRICS', ...generated }));
  })().catch((error) => {
    console.error(JSON.stringify({
      event: 'BILAN_WORKER_DRAIN_FAILED',
      code: error instanceof Error ? error.name : 'BILAN_WORKER_DRAIN_FAILED',
    }));
  }).finally(() => { current.draining = undefined; });
}

export async function stopBilanWorkerScheduler(): Promise<void> {
  const current = state();
  if (current.timer) clearInterval(current.timer);
  current.timer = undefined;
  await current.draining;
}

export function startBilanWorkerScheduler(): void {
  if (process.env.BILAN_WORKER_ENABLED !== 'true') return;
  const current = state();
  if (!current.timer) {
    current.timer = setInterval(kickBilanWorkerDrain, intervalMs());
    current.timer.unref();
    kickBilanWorkerDrain();
  }
  if (!current.signalsBound) {
    current.signalsBound = true;
    process.once('SIGTERM', () => { void stopBilanWorkerScheduler(); });
    process.once('SIGINT', () => { void stopBilanWorkerScheduler(); });
  }
}
