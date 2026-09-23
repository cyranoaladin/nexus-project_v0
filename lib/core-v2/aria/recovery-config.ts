export const CORE_V2_ARIA_CONVERSATION_ENABLED = 'CORE_V2_ARIA_CONVERSATION_ENABLED';
export const CORE_V2_ARIA_RECOVERY_WORKER_ENABLED = 'CORE_V2_ARIA_RECOVERY_WORKER_ENABLED';
export const CORE_V2_ARIA_RECOVERY_POLL_INTERVAL_MS = 'CORE_V2_ARIA_RECOVERY_POLL_INTERVAL_MS';

export class CoreV2AriaRecoveryConfigError extends Error {}

function enabled(name: string, env: Record<string, string | undefined>): boolean {
  return ['1', 'true', 'on'].includes((env[name] ?? '').trim().toLowerCase());
}

export function isCoreV2AriaConversationEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return enabled(CORE_V2_ARIA_CONVERSATION_ENABLED, env);
}

export function isCoreV2AriaRecoveryWorkerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return enabled(CORE_V2_ARIA_RECOVERY_WORKER_ENABLED, env);
}

export function assertCoreV2AriaRecoveryConfiguration(env: Record<string, string | undefined> = process.env): void {
  if (isCoreV2AriaConversationEnabled(env) && !isCoreV2AriaRecoveryWorkerEnabled(env)) {
    throw new CoreV2AriaRecoveryConfigError(
      `${CORE_V2_ARIA_RECOVERY_WORKER_ENABLED} must be enabled when ${CORE_V2_ARIA_CONVERSATION_ENABLED} is enabled.`,
    );
  }
}

export function getCoreV2AriaRecoveryPollIntervalMs(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env[CORE_V2_ARIA_RECOVERY_POLL_INTERVAL_MS] ?? 1_000);
  if (!Number.isSafeInteger(value) || value < 250 || value > 60_000) {
    throw new CoreV2AriaRecoveryConfigError(`${CORE_V2_ARIA_RECOVERY_POLL_INTERVAL_MS} must be an integer between 250 and 60000.`);
  }
  return value;
}
