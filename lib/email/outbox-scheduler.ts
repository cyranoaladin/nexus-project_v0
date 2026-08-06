import { drainEmailOutbox, maintainEmailOutbox } from '@/lib/email/outbox-worker';

type SchedulerState = {
  timer?: NodeJS.Timeout;
  draining?: Promise<unknown>;
  signalsBound?: boolean;
  lastMaintenanceAt?: number;
};
const globalState = globalThis as typeof globalThis & { __nexusEmailOutboxScheduler?: SchedulerState };

function state(): SchedulerState {
  globalState.__nexusEmailOutboxScheduler ??= {};
  return globalState.__nexusEmailOutboxScheduler;
}

function intervalMs(): number {
  const value = Number(process.env.EMAIL_OUTBOX_POLL_INTERVAL_MS || 5_000);
  if (!Number.isSafeInteger(value) || value < 250 || value > 60_000) throw new Error('EMAIL_OUTBOX_INTERVAL_INVALID');
  return value;
}

function maintenanceIntervalMs(): number {
  const value = Number(process.env.EMAIL_OUTBOX_MAINTENANCE_INTERVAL_MS || 60 * 60_000);
  if (!Number.isSafeInteger(value) || value < 60_000 || value > 24 * 60 * 60_000) {
    throw new Error('EMAIL_OUTBOX_MAINTENANCE_INTERVAL_INVALID');
  }
  return value;
}

export function assertEmailOutboxWorkerConfiguration(): void {
  const key = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY?.trim();
  if (!key || key.length < 32) throw new Error('EMAIL_OUTBOX_ENCRYPTION_KEY_INVALID');
  if (!process.env.SMTP_HOST?.trim()) throw new Error('SMTP_HOST_REQUIRED');
  const port = Number(process.env.SMTP_PORT || '587');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error('SMTP_PORT_INVALID');
  if (!(process.env.SMTP_FROM || process.env.EMAIL_FROM)?.trim()) throw new Error('SMTP_FROM_REQUIRED');
  intervalMs();
  maintenanceIntervalMs();
}

export function kickEmailOutboxDrain(): void {
  if (process.env.EMAIL_OUTBOX_WORKER_ENABLED !== 'true') return;
  const current = state();
  if (current.draining) return;
  current.draining = (async () => {
    const result = await drainEmailOutbox();
    console.info(JSON.stringify({ event: 'EMAIL_OUTBOX_DRAIN_METRICS', ...result }));
    const now = Date.now();
    if (!current.lastMaintenanceAt || now - current.lastMaintenanceAt >= maintenanceIntervalMs()) {
      const maintenance = await maintainEmailOutbox({ now: new Date(now) });
      current.lastMaintenanceAt = now;
      console.info(JSON.stringify({ event: 'EMAIL_OUTBOX_MAINTENANCE_METRICS', ...maintenance }));
      if (maintenance.failedFinal > 0 || maintenance.oldAmbiguous > 0) {
        console.error(JSON.stringify({
          event: 'EMAIL_OUTBOX_ATTENTION_REQUIRED',
          failedFinal: maintenance.failedFinal,
          oldAmbiguous: maintenance.oldAmbiguous,
        }));
      }
    }
  })().catch((error) => {
    console.error(JSON.stringify({
      event: 'EMAIL_OUTBOX_DRAIN_FAILED',
      code: error instanceof Error ? error.name : 'EMAIL_OUTBOX_DRAIN_FAILED',
    }));
  }).finally(() => { current.draining = undefined; });
}

export async function stopEmailOutboxScheduler(): Promise<void> {
  const current = state();
  if (current.timer) clearInterval(current.timer);
  current.timer = undefined;
  await current.draining;
}

export function startEmailOutboxScheduler(): void {
  const enabled = process.env.EMAIL_OUTBOX_WORKER_ENABLED;
  if (process.env.NODE_ENV === 'production' && enabled !== 'true') {
    throw new Error('EMAIL_OUTBOX_WORKER_CONFIGURATION_REQUIRED');
  }
  if (enabled !== 'true') return;
  assertEmailOutboxWorkerConfiguration();
  const current = state();
  if (!current.timer) {
    current.timer = setInterval(kickEmailOutboxDrain, intervalMs());
    current.timer.unref();
    kickEmailOutboxDrain();
  }
  if (!current.signalsBound) {
    current.signalsBound = true;
    process.once('SIGTERM', () => { void stopEmailOutboxScheduler(); });
    process.once('SIGINT', () => { void stopEmailOutboxScheduler(); });
  }
}
