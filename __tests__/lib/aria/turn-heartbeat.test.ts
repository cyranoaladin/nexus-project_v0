import { startAriaTurnHeartbeat } from '@/lib/aria/application/conversation/turn-heartbeat';

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

  it('rejects an interval above the ten-second safety bound', () => {
    expect(() => startAriaTurnHeartbeat({
      heartbeat: jest.fn(), abort: jest.fn(), intervalMs: 10_001,
    })).toThrow('ARIA_TURN_HEARTBEAT_INTERVAL_INVALID');
  });

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
});
