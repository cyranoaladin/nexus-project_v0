import { registerProcessShutdownOnce } from '@/lib/runtime/process-shutdown-signals';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { assertCoreV2AriaRecoveryConfiguration, getCoreV2AriaRecoveryPollIntervalMs, isCoreV2AriaConversationEnabled, isCoreV2AriaRecoveryWorkerEnabled } from './recovery-config';
import { drainCoreV2AriaRecoveryOutbox } from './recovery-worker';

type SchedulerState = { timer?: NodeJS.Timeout; draining?: Promise<unknown> };
const globalState = globalThis as typeof globalThis & { __coreV2AriaRecoveryScheduler?: SchedulerState };
function state(): SchedulerState { globalState.__coreV2AriaRecoveryScheduler ??= {}; return globalState.__coreV2AriaRecoveryScheduler; }

export function kickCoreV2AriaRecoveryDrain(): void {
  if (!isCoreV2AriaConversationEnabled() || !isCoreV2AriaRecoveryWorkerEnabled()) return;
  const current = state();
  if (current.draining) return;
  current.draining = (async () => {
    const client = await requireCoreV2Client();
    const metrics = await drainCoreV2AriaRecoveryOutbox({}, client);
    console.info(JSON.stringify({ event: 'CORE_V2_ARIA_RECOVERY_DRAIN_METRICS', ...metrics }));
  })().catch((error: unknown) => {
    console.error(JSON.stringify({ event: 'CORE_V2_ARIA_RECOVERY_DRAIN_FAILED', code: error instanceof Error ? error.name : 'CORE_V2_ARIA_RECOVERY_DRAIN_FAILED' }));
  }).finally(() => { current.draining = undefined; });
}

export async function stopCoreV2AriaRecoveryScheduler(): Promise<void> {
  const current = state();
  if (current.timer) clearInterval(current.timer);
  current.timer = undefined;
  await current.draining;
}

export function startCoreV2AriaRecoveryScheduler(): void {
  assertCoreV2AriaRecoveryConfiguration();
  if (!isCoreV2AriaConversationEnabled() || !isCoreV2AriaRecoveryWorkerEnabled()) return;
  const current = state();
  if (!current.timer) {
    current.timer = setInterval(kickCoreV2AriaRecoveryDrain, getCoreV2AriaRecoveryPollIntervalMs());
    current.timer.unref?.();
    kickCoreV2AriaRecoveryDrain();
  }
  registerProcessShutdownOnce('core-v2-aria-recovery-scheduler', () => { void stopCoreV2AriaRecoveryScheduler(); });
}
