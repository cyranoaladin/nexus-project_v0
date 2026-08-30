import { logger } from '@/lib/logger';
import { drainAriaTurnRecoveryOutbox } from './recovery-worker';

type Environment = Readonly<Record<string, string | undefined>>;

export interface AriaTurnRecoveryScheduler {
  start(): void;
  stop(): Promise<void>;
  kick(): void;
}

function pollIntervalMs(environment: Environment): number {
  const value = Number(environment.ARIA_TURN_RECOVERY_POLL_INTERVAL_MS ?? '1000');
  if (!Number.isSafeInteger(value) || value < 250 || value > 60_000) {
    throw new Error('ARIA_TURN_RECOVERY_INTERVAL_INVALID');
  }
  return value;
}

export function assertAriaTurnRecoveryWorkerConfiguration(environment: Environment = process.env): void {
  if (
    environment.NODE_ENV === 'production'
    && environment.ARIA_TURN_RECOVERY_WORKER_ENABLED !== 'true'
  ) {
    throw new Error('ARIA_TURN_RECOVERY_WORKER_CONFIGURATION_REQUIRED');
  }
  if (environment.ARIA_TURN_RECOVERY_WORKER_ENABLED === 'true') pollIntervalMs(environment);
}

export function createAriaTurnRecoveryScheduler(input: Readonly<{
  drain?: typeof drainAriaTurnRecoveryOutbox;
  environment?: Environment;
  log?: Pick<typeof logger, 'info' | 'error'>;
}> = {}): AriaTurnRecoveryScheduler {
  const drain = input.drain ?? drainAriaTurnRecoveryOutbox;
  const environment = input.environment ?? process.env;
  const log = input.log ?? logger;
  let timer: ReturnType<typeof setInterval> | undefined;
  let draining: Promise<unknown> | undefined;

  const kick = () => {
    if (environment.ARIA_TURN_RECOVERY_WORKER_ENABLED !== 'true' || draining) return;
    draining = drain().then((metrics) => {
      log.info({ event: 'ARIA_TURN_RECOVERY_DRAIN_METRICS', ...metrics });
    }).catch(() => {
      log.error({ event: 'ARIA_TURN_RECOVERY_DRAIN_FAILED', failureCode: 'RECOVERY_DRAIN_FAILED' });
    }).finally(() => {
      draining = undefined;
    });
  };

  return {
    start() {
      assertAriaTurnRecoveryWorkerConfiguration(environment);
      if (environment.ARIA_TURN_RECOVERY_WORKER_ENABLED !== 'true' || timer) return;
      timer = setInterval(kick, pollIntervalMs(environment));
      timer.unref?.();
      kick();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      await draining;
    },
    kick,
  };
}

const globalSchedulers = globalThis as typeof globalThis & {
  __nexusAriaTurnRecoveryScheduler?: AriaTurnRecoveryScheduler;
};

function singletonScheduler(): AriaTurnRecoveryScheduler {
  globalSchedulers.__nexusAriaTurnRecoveryScheduler ??= createAriaTurnRecoveryScheduler();
  return globalSchedulers.__nexusAriaTurnRecoveryScheduler;
}

export function startAriaTurnRecoveryScheduler(): void {
  singletonScheduler().start();
}

export function kickAriaTurnRecoveryDrain(): void {
  singletonScheduler().kick();
}

export function stopAriaTurnRecoveryScheduler(): Promise<void> {
  return singletonScheduler().stop();
}
