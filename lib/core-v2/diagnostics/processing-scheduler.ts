/**
 * The actual consumer of the diagnostic-submission-processing queue
 * (mission §5: "le consommateur doit être réellement actif et supervisé
 * dans l'environnement livré") — same shape as
 * lib/bilans/worker/scheduler.ts: an interval poll, a global guard
 * against overlapping drain cycles, opt-in via an env flag (never enabled
 * by inferring NODE_ENV), and a clean shutdown hook.
 */
import { registerProcessShutdownOnce } from '@/lib/runtime/process-shutdown-signals';
import { requireCoreV2Client } from '../client';
import { drainDiagnosticSubmissionProcessingQueue } from '../services/diagnostic-processing';

type SchedulerState = {
  timer?: NodeJS.Timeout;
  draining?: Promise<unknown>;
};
const globalState = globalThis as typeof globalThis & { __nexusDiagnosticProcessingScheduler?: SchedulerState };

function state(): SchedulerState {
  globalState.__nexusDiagnosticProcessingScheduler ??= {};
  return globalState.__nexusDiagnosticProcessingScheduler;
}

function intervalMs(): number {
  const value = Number(process.env.DIAGNOSTIC_PROCESSING_WORKER_POLL_INTERVAL_MS || 5_000);
  if (!Number.isSafeInteger(value) || value < 250 || value > 60_000) throw new Error('DIAGNOSTIC_PROCESSING_WORKER_INTERVAL_INVALID');
  return value;
}

function isWorkerEnabled(): boolean {
  const val = (process.env.DIAGNOSTIC_PROCESSING_WORKER_ENABLED || '').trim().toLowerCase();
  return ['true', 'on', '1'].includes(val);
}

export function kickDiagnosticProcessingDrain(): void {
  if (!isWorkerEnabled()) return;
  const current = state();
  if (current.draining) return;
  current.draining = (async () => {
    const client = await requireCoreV2Client();
    const metrics = await drainDiagnosticSubmissionProcessingQueue(client);
    console.info(JSON.stringify({ event: 'DIAGNOSTIC_PROCESSING_WORKER_DRAIN_METRICS', ...metrics }));
  })().catch((error) => {
    console.error(JSON.stringify({
      event: 'DIAGNOSTIC_PROCESSING_WORKER_DRAIN_FAILED',
      code: error instanceof Error ? error.name : 'DIAGNOSTIC_PROCESSING_WORKER_DRAIN_FAILED',
    }));
  }).finally(() => { current.draining = undefined; });
}

export async function stopDiagnosticProcessingScheduler(): Promise<void> {
  const current = state();
  if (current.timer) clearInterval(current.timer);
  current.timer = undefined;
  await current.draining;
}

export function startDiagnosticProcessingScheduler(): void {
  if (!isWorkerEnabled()) return;
  const current = state();
  if (!current.timer) {
    current.timer = setInterval(kickDiagnosticProcessingDrain, intervalMs());
    current.timer.unref?.();
    kickDiagnosticProcessingDrain();
  }
  registerProcessShutdownOnce('diagnostic-processing-scheduler', () => { void stopDiagnosticProcessingScheduler(); });
}
