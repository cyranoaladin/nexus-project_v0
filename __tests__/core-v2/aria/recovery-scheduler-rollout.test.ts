jest.mock('@/lib/core-v2/client', () => ({ requireCoreV2Client: jest.fn() }));
jest.mock('@/lib/core-v2/aria/recovery-worker', () => ({ drainCoreV2AriaRecoveryOutbox: jest.fn() }));
jest.mock('@/lib/runtime/process-shutdown-signals', () => ({ registerProcessShutdownOnce: jest.fn() }));

import { requireCoreV2Client } from '@/lib/core-v2/client';
import { drainCoreV2AriaRecoveryOutbox } from '@/lib/core-v2/aria/recovery-worker';
import { kickCoreV2AriaRecoveryDrain, startCoreV2AriaRecoveryScheduler, stopCoreV2AriaRecoveryScheduler } from '@/lib/core-v2/aria/recovery-scheduler';

const mockedClient = requireCoreV2Client as jest.Mock;
const mockedDrain = drainCoreV2AriaRecoveryOutbox as jest.Mock;

describe('Core v2 ARIA recovery during conversation rollout disablement', () => {
  const previousConversation = process.env.CORE_V2_ARIA_CONVERSATION_ENABLED;
  const previousWorker = process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CORE_V2_ARIA_CONVERSATION_ENABLED = 'false';
    process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED = 'true';
    mockedClient.mockResolvedValue({});
    mockedDrain.mockResolvedValue({ claimed: 0 });
  });

  afterEach(async () => {
    await stopCoreV2AriaRecoveryScheduler();
    if (previousConversation === undefined) delete process.env.CORE_V2_ARIA_CONVERSATION_ENABLED;
    else process.env.CORE_V2_ARIA_CONVERSATION_ENABLED = previousConversation;
    if (previousWorker === undefined) delete process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED;
    else process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED = previousWorker;
  });

  test('a manual drain still processes existing Turns', async () => {
    kickCoreV2AriaRecoveryDrain();
    await stopCoreV2AriaRecoveryScheduler();
    expect(mockedDrain).toHaveBeenCalledTimes(1);
  });

  test('startup begins recovery even while new conversations are disabled', async () => {
    startCoreV2AriaRecoveryScheduler();
    await stopCoreV2AriaRecoveryScheduler();
    expect(mockedDrain).toHaveBeenCalledTimes(1);
  });

  test('the recovery-worker flag still disables startup and drains', async () => {
    process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED = 'false';
    startCoreV2AriaRecoveryScheduler();
    kickCoreV2AriaRecoveryDrain();
    await stopCoreV2AriaRecoveryScheduler();
    expect(mockedDrain).not.toHaveBeenCalled();
  });
});
