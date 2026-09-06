import { drainWhatsAppInvitations } from './invitation-worker';
import { assertWhatsAppOutboxEncryptionConfiguration } from './invitation-outbox';
import { getMetaWhatsAppConfig } from './meta-provider';

type SchedulerState = { timer?: NodeJS.Timeout; draining?: Promise<unknown>; signalsBound?: boolean };
const globals = globalThis as typeof globalThis & { __nexusWhatsAppOutboxScheduler?: SchedulerState };
function state(): SchedulerState { return globals.__nexusWhatsAppOutboxScheduler ??= {}; }
function intervalMs(): number {
  const value = Number(process.env.WHATSAPP_OUTBOX_POLL_INTERVAL_MS ?? '5000');
  if (!Number.isSafeInteger(value) || value < 1000 || value > 60000) throw new Error('WHATSAPP_OUTBOX_INTERVAL_INVALID');
  return value;
}

/** Safe after commit: never starts a network send unless the capability is opted in. */
export function kickParentWhatsAppOutboxDrain(): void {
  if (process.env.WHATSAPP_OUTBOX_WORKER_ENABLED !== 'true') return;
  const current = state();
  if (current.draining) return;
  current.draining = drainWhatsAppInvitations()
    .catch(() => { console.error('WHATSAPP_OUTBOX_DRAIN_FAILED'); })
    .finally(() => { current.draining = undefined; });
}

export async function stopParentWhatsAppOutboxScheduler(): Promise<void> {
  const current = state();
  if (current.timer) clearInterval(current.timer);
  current.timer = undefined;
  await current.draining;
}

/** Singleton per process; atomic DB claims coordinate multiple app processes. */
export function startParentWhatsAppOutboxScheduler(): void {
  if (process.env.WHATSAPP_OUTBOX_WORKER_ENABLED !== 'true') return;
  assertWhatsAppOutboxEncryptionConfiguration();
  if (!getMetaWhatsAppConfig('ACTIVATION') || !getMetaWhatsAppConfig('RECOVERY')
    || (process.env.WHATSAPP_META_APP_SECRET?.trim().length ?? 0) < 32
    || (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim().length ?? 0) < 16) {
    throw new Error('WHATSAPP_SERVICE_UNAVAILABLE');
  }
  const interval = intervalMs();
  const current = state();
  if (!current.timer) {
    current.timer = setInterval(kickParentWhatsAppOutboxDrain, interval);
    current.timer.unref?.();
    kickParentWhatsAppOutboxDrain();
  }
  if (!current.signalsBound) {
    current.signalsBound = true;
    process.once('SIGTERM', () => { void stopParentWhatsAppOutboxScheduler(); });
    process.once('SIGINT', () => { void stopParentWhatsAppOutboxScheduler(); });
  }
}
