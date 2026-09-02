import { prisma } from '@/lib/prisma';
import { startEmailOutboxScheduler } from '@/lib/email/outbox-scheduler';
import { startBilanWorkerScheduler } from '@/lib/bilans/worker/scheduler';
import { startAriaTurnRecoveryScheduler } from '@/lib/aria/infrastructure/jobs/recovery-scheduler';
import { register } from '@/instrumentation';

jest.mock('@/lib/npc/storage-root', () => ({ assertNpcStorageReady: jest.fn() }));
jest.mock('@/lib/env-validation', () => ({ validateEnv: jest.fn() }));
jest.mock('@/lib/config', () => ({ loadConfigSnapshot: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/documents/storage-health', () => ({
  ensureDocumentStorageReady: jest.fn(() => ({ dataOutsideRoot: [] })),
}));
jest.mock('@/lib/prisma', () => ({ prisma: { $connect: jest.fn() } }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ startEmailOutboxScheduler: jest.fn() }));
jest.mock('@/lib/bilans/worker/scheduler', () => ({ startBilanWorkerScheduler: jest.fn() }));
jest.mock('@/lib/aria/infrastructure/jobs/recovery-scheduler', () => ({
  startAriaTurnRecoveryScheduler: jest.fn(),
}));

const connect = prisma.$connect as jest.MockedFunction<typeof prisma.$connect>;

describe('ARIA worker startup database readiness', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnvironment,
      NEXT_RUNTIME: 'nodejs',
      NEXT_PHASE: 'phase-production-server',
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
    jest.restoreAllMocks();
  });

  it('awaits the shared Prisma readiness boundary before starting any scheduler', async () => {
    let release: (() => void) | undefined;
    connect.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));

    const startup = register();
    for (let index = 0; index < 20 && connect.mock.calls.length === 0; index += 1) {
      await Promise.resolve();
    }
    expect(connect).toHaveBeenCalledTimes(1);
    expect(startEmailOutboxScheduler).not.toHaveBeenCalled();
    expect(startBilanWorkerScheduler).not.toHaveBeenCalled();
    expect(startAriaTurnRecoveryScheduler).not.toHaveBeenCalled();

    release?.();
    await startup;
    expect(startEmailOutboxScheduler).toHaveBeenCalledTimes(1);
    expect(startBilanWorkerScheduler).toHaveBeenCalledTimes(1);
    expect(startAriaTurnRecoveryScheduler).toHaveBeenCalledTimes(1);
  });

  it('fails closed with a bounded marker before schedulers when Prisma is unavailable', async () => {
    connect.mockRejectedValue(new Error('/private/db/path account@example.invalid secret-fragment'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = jest.spyOn(process, 'exit').mockImplementation(((status?: string | number | null) => {
      throw new Error(`EXIT:${status}`);
    }) as never);

    await expect(register()).rejects.toThrow('EXIT:1');
    expect(error).toHaveBeenCalledWith('DATABASE_STARTUP_PREFLIGHT_FAILED');
    expect(JSON.stringify(error.mock.calls)).not.toMatch(
      /private\/db|account@example|secret-fragment/,
    );
    expect(startEmailOutboxScheduler).not.toHaveBeenCalled();
    expect(startBilanWorkerScheduler).not.toHaveBeenCalled();
    expect(startAriaTurnRecoveryScheduler).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
