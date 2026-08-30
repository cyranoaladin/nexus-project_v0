export type AriaTurnHeartbeatDisposition =
  | 'RENEWED'
  | 'CANCELLATION_REQUESTED'
  | 'LEASE_LOST';

export interface RunningAriaTurnHeartbeat {
  stop(): Promise<void>;
}

export function startAriaTurnHeartbeat(input: Readonly<{
  heartbeat: () => Promise<Readonly<{ disposition: AriaTurnHeartbeatDisposition }>>;
  abort: (reason: 'USER_CANCELLED' | 'TURN_LEASE_LOST' | 'TURN_HEARTBEAT_FAILED') => void;
  intervalMs?: number;
}>): RunningAriaTurnHeartbeat {
  const intervalMs = input.intervalMs ?? ARIA_PERFORMANCE_BUDGETS.heartbeatIntervalMs;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 250 || intervalMs > 10_000) {
    throw new Error('ARIA_TURN_HEARTBEAT_INTERVAL_INVALID');
  }
  let inFlight: Promise<void> | undefined;
  let stopped = false;
  const tick = () => {
    if (stopped || inFlight) return;
    inFlight = input.heartbeat().then((result) => {
      if (result.disposition === 'CANCELLATION_REQUESTED') input.abort('USER_CANCELLED');
      else if (result.disposition === 'LEASE_LOST') input.abort('TURN_LEASE_LOST');
    }).catch(() => {
      input.abort('TURN_HEARTBEAT_FAILED');
    }).finally(() => {
      inFlight = undefined;
    });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    },
  };
}
import { ARIA_PERFORMANCE_BUDGETS } from '../../domain/observability/performance-budgets';
