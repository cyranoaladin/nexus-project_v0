import { CoreV2ConfigError } from '@/lib/core-v2/config';
import { assertAccountEmailHandoffSchema } from './email-handoff-schema';
import { registerProcessShutdownOnce } from '@/lib/runtime/process-shutdown-signals';
import { getAuthRolloutMode } from '@/lib/core-v2/auth/authority';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { assertAccountEmailHandoffConfiguration } from '@/lib/email/account-handoff-envelope';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { drainAccountEmailHandoffs } from './email-handoff-worker';
import { transferAccountEmailHandoff } from './email-handoff-destination';

type SchedulerState = { timer?: NodeJS.Timeout; draining?: Promise<void>; stopping?: boolean };
const globalState = globalThis as typeof globalThis & { __accountEmailHandoffScheduler?: SchedulerState };
function state(): SchedulerState { globalState.__accountEmailHandoffScheduler ??= {}; return globalState.__accountEmailHandoffScheduler; }
function intervalMs(): number {
  const encoded = process.env.CORE_V2_ACCOUNT_EMAIL_POLL_INTERVAL_MS?.trim();
  if (encoded === undefined) return 5_000;
  if (!/^\d+$/.test(encoded)) throw new Error('ACCOUNT_EMAIL_POLL_INTERVAL_INVALID');
  const value = Number(encoded);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) throw new Error('ACCOUNT_EMAIL_POLL_INTERVAL_INVALID');
  return value;
}

export function assertAccountEmailHandoffRuntimeConfiguration(): void {
  if (getAuthRolloutMode() === 'V1_ONLY') throw new CoreV2ConfigError('ACCOUNT_EMAIL_CORE_AUTH_DISABLED');
  assertAccountEmailHandoffConfiguration();
  intervalMs();
}

export function kickAccountEmailHandoffDrain(): void {
  if (getAuthRolloutMode() === 'V1_ONLY') return;
  const current = state();
  if (current.draining || current.stopping) return;
  current.draining = (async () => {
    const client = await requireCoreV2Client();
    const metrics = await drainAccountEmailHandoffs(client, { now: () => new Date(), transfer: transferAccountEmailHandoff });
    if (metrics.completed > 0) kickEmailOutboxDrain();
    console.info(JSON.stringify({ event: 'ACCOUNT_EMAIL_HANDOFF_METRICS', ...metrics }));
    if (metrics.failedFinal > 0) console.error(JSON.stringify({ event: 'ACCOUNT_EMAIL_HANDOFF_ATTENTION_REQUIRED', failedFinal: metrics.failedFinal }));
  })().catch(() => {
    console.error(JSON.stringify({ event: 'ACCOUNT_EMAIL_HANDOFF_DRAIN_FAILED', code: 'ACCOUNT_EMAIL_HANDOFF_DRAIN_FAILED' }));
  }).finally(() => { current.draining = undefined; });
}

export async function stopAccountEmailHandoffScheduler(): Promise<void> {
  const current = state();
  current.stopping = true;
  if (current.timer) clearInterval(current.timer);
  current.timer = undefined;
  await current.draining;
}

/** Active automatically with Core credential authority; no silent opt-out flag. */
export async function startAccountEmailHandoffScheduler(): Promise<void> {
  if (getAuthRolloutMode() === 'V1_ONLY') return;
  assertAccountEmailHandoffRuntimeConfiguration();
  const client = await requireCoreV2Client();
  await assertAccountEmailHandoffSchema(client);
  const current = state();
  current.stopping = false;
  if (!current.timer) {
    current.timer = setInterval(kickAccountEmailHandoffDrain, intervalMs());
    current.timer.unref?.();
    kickAccountEmailHandoffDrain();
  }
  registerProcessShutdownOnce('account-email-handoff-scheduler', () => { void stopAccountEmailHandoffScheduler(); });
}
