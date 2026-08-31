import {
  assertAriaTurnRecoveryWorkerConfiguration,
  createAriaTurnRecoveryScheduler,
} from '@/lib/aria/infrastructure/jobs/recovery-scheduler';

describe('ARIA Turn recovery scheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fails closed when production Turn writes have no recovery worker', () => {
    expect(() => assertAriaTurnRecoveryWorkerConfiguration({
      NODE_ENV: 'production',
      ARIA_TURN_RECOVERY_WORKER_ENABLED: 'false',
    })).toThrow('ARIA_TURN_RECOVERY_WORKER_CONFIGURATION_REQUIRED');
  });

  it.each(['not-a-number', '249', '60001', '1.5'])(
    'rejects an unsafe recovery interval %s',
    (interval) => {
      expect(() => assertAriaTurnRecoveryWorkerConfiguration({
        NODE_ENV: 'test',
        ARIA_TURN_RECOVERY_WORKER_ENABLED: 'true',
        ARIA_TURN_RECOVERY_POLL_INTERVAL_MS: interval,
      })).toThrow('ARIA_TURN_RECOVERY_INTERVAL_INVALID');
    },
  );

  it('accepts disabled non-production recovery and the process defaults', () => {
    expect(() => assertAriaTurnRecoveryWorkerConfiguration({
      NODE_ENV: 'test',
      ARIA_TURN_RECOVERY_WORKER_ENABLED: 'false',
    })).not.toThrow();
    expect(() => assertAriaTurnRecoveryWorkerConfiguration()).not.toThrow();
  });

  it('drains immediately and periodically, then stops and restarts cleanly', async () => {
    const drain = jest.fn().mockResolvedValue({ claimed: 0, recovered: 0, rescheduled: 0 });
    const scheduler = createAriaTurnRecoveryScheduler({
      drain,
      environment: {
        NODE_ENV: 'test',
        ARIA_TURN_RECOVERY_WORKER_ENABLED: 'true',
        ARIA_TURN_RECOVERY_POLL_INTERVAL_MS: '500',
      },
    });

    scheduler.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(drain).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1_500);
    expect(drain).toHaveBeenCalledTimes(4);

    await scheduler.stop();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(drain).toHaveBeenCalledTimes(4);

    scheduler.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(drain).toHaveBeenCalledTimes(5);
    await scheduler.stop();
  });

  it('uses the bounded default interval and ignores duplicate starts', async () => {
    const drain = jest.fn().mockResolvedValue({ claimed: 0, recovered: 0, rescheduled: 0 });
    const scheduler = createAriaTurnRecoveryScheduler({
      drain,
      environment: {
        NODE_ENV: 'test',
        ARIA_TURN_RECOVERY_WORKER_ENABLED: 'true',
      },
    });

    scheduler.start();
    scheduler.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(drain).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(999);
    expect(drain).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(drain).toHaveBeenCalledTimes(2);
    await scheduler.stop();
  });

  it('keeps a disabled scheduler inert with default dependencies', async () => {
    const scheduler = createAriaTurnRecoveryScheduler({
      environment: {
        NODE_ENV: 'test',
        ARIA_TURN_RECOVERY_WORKER_ENABLED: 'false',
      },
    });

    scheduler.start();
    scheduler.kick();
    await scheduler.stop();
  });

  it('constructs the default process scheduler without starting external work', async () => {
    const scheduler = createAriaTurnRecoveryScheduler();

    await scheduler.stop();
  });

  it('coalesces ticks while one drain is still active', async () => {
    let release: (() => void) | undefined;
    const drain = jest.fn(async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return {
        claimed: 0, recovered: 0, rescheduled: 0,
        alreadyTerminal: 0, leaseLost: 0, retried: 0,
      };
    });
    const scheduler = createAriaTurnRecoveryScheduler({
      drain,
      environment: {
        NODE_ENV: 'test',
        ARIA_TURN_RECOVERY_WORKER_ENABLED: 'true',
        ARIA_TURN_RECOVERY_POLL_INTERVAL_MS: '250',
      },
    });
    scheduler.start();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(drain).toHaveBeenCalledTimes(1);
    release?.();
    await Promise.resolve();
    await scheduler.stop();
  });

  it('reports a failed drain with a bounded code and remains schedulable', async () => {
    const drain = jest.fn()
      .mockRejectedValueOnce(new Error('/private/path provider payload'))
      .mockResolvedValue({
        claimed: 0, recovered: 0, rescheduled: 0,
        alreadyTerminal: 0, leaseLost: 0, retried: 0,
      });
    const log = { info: jest.fn(), error: jest.fn() };
    const scheduler = createAriaTurnRecoveryScheduler({
      drain,
      log,
      environment: {
        NODE_ENV: 'test',
        ARIA_TURN_RECOVERY_WORKER_ENABLED: 'true',
        ARIA_TURN_RECOVERY_POLL_INTERVAL_MS: '250',
      },
    });
    scheduler.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(log.error).toHaveBeenCalledWith({
      event: 'ARIA_TURN_RECOVERY_DRAIN_FAILED',
      failureCode: 'RECOVERY_DRAIN_FAILED',
    });
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('/private/path');
    await jest.advanceTimersByTimeAsync(250);
    expect(drain).toHaveBeenCalledTimes(2);
    await scheduler.stop();
  });
});
