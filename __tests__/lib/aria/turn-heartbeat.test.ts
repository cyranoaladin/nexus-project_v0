import { startAriaTurnHeartbeat } from '@/lib/aria/application/conversation/turn-heartbeat';
import { ARIA_PERFORMANCE_BUDGETS } from '@/lib/aria/domain/observability/performance-budgets';

describe('ARIA Turn heartbeat', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renews at a bounded interval without writing per token', async () => {
    const heartbeat = jest.fn().mockResolvedValue({ disposition: 'RENEWED' });
    const abort = jest.fn();
    const running = startAriaTurnHeartbeat({
      heartbeat,
      abort,
      intervalMs: 5_000,
    });

    await jest.advanceTimersByTimeAsync(15_000);
    expect(heartbeat).toHaveBeenCalledTimes(3);
    expect(abort).not.toHaveBeenCalled();
    await running.stop();
  });

  it.each([
    ['CANCELLATION_REQUESTED', 'USER_CANCELLED'],
    ['LEASE_LOST', 'TURN_LEASE_LOST'],
  ] as const)('aborts execution on %s', async (disposition, reason) => {
    const heartbeat = jest.fn().mockResolvedValue({ disposition });
    const abort = jest.fn();
    const running = startAriaTurnHeartbeat({ heartbeat, abort, intervalMs: 10_000 });

    await jest.advanceTimersByTimeAsync(10_000);
    expect(abort).toHaveBeenCalledWith(reason);
    await running.stop();
  });

  it.each([249, 10_001, 500.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid heartbeat interval %s',
    (intervalMs) => {
      expect(() => startAriaTurnHeartbeat({
        heartbeat: jest.fn(), abort: jest.fn(), intervalMs,
      })).toThrow('ARIA_TURN_HEARTBEAT_INTERVAL_INVALID');
    },
  );

  it('aborts fail closed when the heartbeat persistence call fails', async () => {
    const abort = jest.fn();
    const running = startAriaTurnHeartbeat({
      heartbeat: jest.fn().mockRejectedValue(new Error('database unavailable')),
      abort,
      intervalMs: 5_000,
    });
    await jest.advanceTimersByTimeAsync(5_000);
    expect(abort).toHaveBeenCalledWith('TURN_HEARTBEAT_FAILED');
    await running.stop();
  });

  it('HEARTBEAT_COALESCES_TICKS_WHILE_RENEWAL_IS_IN_FLIGHT', async () => {
    let resolveRenewal: ((value: { disposition: 'RENEWED' }) => void) | undefined;
    const heartbeat = jest.fn(() => new Promise<{ disposition: 'RENEWED' }>((resolve) => {
      resolveRenewal = resolve;
    }));
    const running = startAriaTurnHeartbeat({
      heartbeat,
      abort: jest.fn(),
      intervalMs: 250,
    });

    await jest.advanceTimersByTimeAsync(1_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    resolveRenewal?.({ disposition: 'RENEWED' });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(250);
    expect(heartbeat).toHaveBeenCalledTimes(2);
    resolveRenewal?.({ disposition: 'RENEWED' });
    await running.stop();
  });

  it('HEARTBEAT_STOP_WAITS_FOR_THE_IN_FLIGHT_RENEWAL', async () => {
    let resolveRenewal: ((value: { disposition: 'RENEWED' }) => void) | undefined;
    const heartbeat = jest.fn(() => new Promise<{ disposition: 'RENEWED' }>((resolve) => {
      resolveRenewal = resolve;
    }));
    const running = startAriaTurnHeartbeat({
      heartbeat,
      abort: jest.fn(),
      intervalMs: 250,
    });
    await jest.advanceTimersByTimeAsync(250);

    let stopped = false;
    const stopping = running.stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    resolveRenewal?.({ disposition: 'RENEWED' });
    await stopping;
    expect(stopped).toBe(true);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);
  });

  it('HEARTBEAT_USES_THE_CANONICAL_DEFAULT_INTERVAL', async () => {
    const heartbeat = jest.fn().mockResolvedValue({ disposition: 'RENEWED' });
    const running = startAriaTurnHeartbeat({ heartbeat, abort: jest.fn() });

    await jest.advanceTimersByTimeAsync(ARIA_PERFORMANCE_BUDGETS.heartbeatIntervalMs - 1);
    expect(heartbeat).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    await running.stop();
  });
});
