jest.mock('@/lib/aria/infrastructure/jobs/fenced-claim', () => ({
  claimAriaTurnRecoveryJobs: jest.fn(),
}));

import { drainAriaTurnRecoveryOutbox } from '@/lib/aria/infrastructure/jobs/recovery-worker';
import { claimAriaTurnRecoveryJobs } from '@/lib/aria/infrastructure/jobs/fenced-claim';

const claim = claimAriaTurnRecoveryJobs as jest.MockedFunction<typeof claimAriaTurnRecoveryJobs>;
const now = new Date('2026-08-31T08:00:00.000Z');

function job(payload: unknown = { turnId: 'turn-1' }) {
  return {
    id: 'job-1', aggregateId: 'turn-1', payload,
  } as never;
}

function dependencies(input: Readonly<{
  turns?: readonly Record<string, unknown>[];
  lockedJobs?: readonly Record<string, unknown>[];
  retryCount?: number;
  transactionFailure?: Error;
}> = {}) {
  const transaction = {
    $queryRaw: jest.fn()
      .mockResolvedValueOnce(input.turns ?? [])
      .mockResolvedValueOnce(input.lockedJobs ?? [{
        id: 'job-1', status: 'LEASED', leaseOwner: 'worker-1',
      }]),
    ariaConversationTurn: { update: jest.fn().mockResolvedValue({}) },
    jobOutbox: { update: jest.fn().mockResolvedValue({}) },
  };
  const database = {
    $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) => {
      if (input.transactionFailure) throw input.transactionFailure;
      return callback(transaction);
    }),
    jobOutbox: {
      updateMany: jest.fn().mockResolvedValue({ count: input.retryCount ?? 1 }),
    },
  };
  const log = { info: jest.fn(), error: jest.fn() };
  return { database, transaction, log };
}

describe('ARIA Turn recovery worker boundaries', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { leaseDurationMs: 4_999 },
    { leaseDurationMs: 300_001 },
    { retryDelayMs: 249 },
    { retryDelayMs: 60_001 },
  ])('rejects invalid bounded worker policy %p', async (options) => {
    const deps = dependencies();
    await expect(drainAriaTurnRecoveryOutbox(options, deps as never))
      .rejects.toThrow('ARIA_TURN_RECOVERY_POLICY_INVALID');
    expect(claim).not.toHaveBeenCalled();
  });

  it('creates bounded default claim ownership without processing an empty queue', async () => {
    claim.mockResolvedValueOnce([]);
    const deps = dependencies();
    await expect(drainAriaTurnRecoveryOutbox({}, deps as never)).resolves.toEqual({
      claimed: 0, recovered: 0, rescheduled: 0, alreadyTerminal: 0, leaseLost: 0, retried: 0,
    });
    expect(claim).toHaveBeenCalledWith(deps.database, expect.objectContaining({
      limit: 20,
      owner: expect.stringMatching(/^aria-recovery-\d+-[0-9a-f-]{36}$/),
      now: expect.any(Date),
      leaseExpiresAt: expect.any(Date),
    }));
  });

  it.each([
    ['RECOVERY_PAYLOAD_INVALID', {}, undefined],
    ['RECOVERY_JOB_IDENTITY_MISMATCH', { turnId: 'turn-other' }, undefined],
    ['RECOVERY_OPERATION_FAILED', { turnId: 'turn-1' }, new Error('/private/database')],
  ])('reschedules bounded recovery failure %s', async (failureCode, payload, failure) => {
    claim.mockResolvedValueOnce([job(payload)]);
    const deps = dependencies({ transactionFailure: failure });
    const result = await drainAriaTurnRecoveryOutbox({ owner: 'worker-1', now }, deps as never);
    expect(result).toMatchObject({ claimed: 1, retried: 1, leaseLost: 0 });
    expect(deps.database.jobOutbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastError: failureCode, status: 'RETRY_SCHEDULED' }),
    }));
    expect(deps.log.error).toHaveBeenCalledWith(expect.objectContaining({
      failureCode, retryScheduled: true,
    }));
    expect(JSON.stringify(deps.log.error.mock.calls)).not.toContain('/private/database');
  });

  it('counts a failed retry CAS as lease loss', async () => {
    claim.mockResolvedValueOnce([job({})]);
    const deps = dependencies({ retryCount: 0 });
    await expect(drainAriaTurnRecoveryOutbox({ owner: 'worker-1', now }, deps as never))
      .resolves.toMatchObject({ retried: 0, leaseLost: 1 });
    expect(deps.log.error).toHaveBeenCalledWith(expect.objectContaining({
      retryScheduled: false,
    }));
  });

  it('does not mutate a Turn after the job lease is lost', async () => {
    claim.mockResolvedValueOnce([job()]);
    const deps = dependencies({
      turns: [{ id: 'turn-1', status: 'RUNNING' }],
      lockedJobs: [{ id: 'job-1', status: 'LEASED', leaseOwner: 'other-worker' }],
    });
    await expect(drainAriaTurnRecoveryOutbox({ owner: 'worker-1', now }, deps as never))
      .resolves.toMatchObject({ leaseLost: 1 });
    expect(deps.transaction.ariaConversationTurn.update).not.toHaveBeenCalled();
    expect(deps.transaction.jobOutbox.update).not.toHaveBeenCalled();
  });

  it.each([
    ['missing Turn', []],
    ['already completed Turn', [{ id: 'turn-1', status: 'COMPLETED' }]],
  ])('completes a watchdog for an %s', async (_label, turns) => {
    claim.mockResolvedValueOnce([job()]);
    const deps = dependencies({ turns });
    await expect(drainAriaTurnRecoveryOutbox({ owner: 'worker-1', now }, deps as never))
      .resolves.toMatchObject({ alreadyTerminal: 1 });
    expect(deps.transaction.jobOutbox.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED', completedAt: now }),
    }));
  });

  it('reschedules a fresh running Turn at its canonical lease expiry', async () => {
    const leaseExpiresAt = new Date(now.getTime() + 10_000);
    claim.mockResolvedValueOnce([job()]);
    const deps = dependencies({ turns: [{
      id: 'turn-1', status: 'RUNNING', cancellationRequestedAt: null, leaseExpiresAt,
    }] });
    await expect(drainAriaTurnRecoveryOutbox({ owner: 'worker-1', now }, deps as never))
      .resolves.toMatchObject({ rescheduled: 1 });
    expect(deps.transaction.jobOutbox.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDING', availableAt: leaseExpiresAt }),
    }));
  });

  it('recovers invalid execution metadata without copying it into the terminal audit', async () => {
    claim.mockResolvedValueOnce([job()]);
    const deps = dependencies({ turns: [{
      id: 'turn-1', status: 'PENDING', executionMetadata: ['private'],
      cancellationRequestedAt: null, leaseExpiresAt: null,
    }] });
    await expect(drainAriaTurnRecoveryOutbox({ owner: 'worker-1', now }, deps as never))
      .resolves.toMatchObject({ recovered: 1 });
    expect(deps.transaction.ariaConversationTurn.update).toHaveBeenCalledWith({
      where: { id: 'turn-1' },
      data: expect.objectContaining({
        status: 'ERROR',
        executionMetadata: {
          reasonCode: 'EXECUTION_INTERRUPTED', recoveredAt: now.toISOString(),
        },
      }),
    });
  });
});
