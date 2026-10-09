jest.mock('@/lib/core-v2/accounts/email-handoff-schema', () => ({ assertAccountEmailHandoffSchema: jest.fn(async () => undefined) }));
import { assertAccountEmailHandoffSchema } from '@/lib/core-v2/accounts/email-handoff-schema';
jest.mock('@/lib/core-v2/auth/authority', () => ({ getAuthRolloutMode: jest.fn() }));
jest.mock('@/lib/core-v2/client', () => ({ requireCoreV2Client: jest.fn() }));
jest.mock('@/lib/core-v2/accounts/email-handoff-worker', () => ({ drainAccountEmailHandoffs: jest.fn() }));
jest.mock('@/lib/core-v2/accounts/email-handoff-destination', () => ({ transferAccountEmailHandoff: jest.fn() }));
jest.mock('@/lib/email/account-handoff-envelope', () => ({ assertAccountEmailHandoffConfiguration: jest.fn() }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
import { getAuthRolloutMode } from '@/lib/core-v2/auth/authority';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { drainAccountEmailHandoffs } from '@/lib/core-v2/accounts/email-handoff-worker';
import { assertAccountEmailHandoffConfiguration } from '@/lib/email/account-handoff-envelope';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { startAccountEmailHandoffScheduler, stopAccountEmailHandoffScheduler, kickAccountEmailHandoffDrain } from '@/lib/core-v2/accounts/email-handoff-scheduler';

const originalInterval = process.env.CORE_V2_ACCOUNT_EMAIL_POLL_INTERVAL_MS;
beforeEach(async () => {
  await stopAccountEmailHandoffScheduler();
  jest.clearAllMocks();
  delete process.env.CORE_V2_ACCOUNT_EMAIL_POLL_INTERVAL_MS;
  jest.mocked(getAuthRolloutMode).mockReturnValue('HYBRID');
  jest.mocked(requireCoreV2Client).mockResolvedValue({} as Awaited<ReturnType<typeof requireCoreV2Client>>);
  jest.mocked(drainAccountEmailHandoffs).mockResolvedValue({ claimed: 1, completed: 1, discarded: 0, retried: 0, leaseLost: 0, failedFinal: 0 });
});
afterEach(async () => { await stopAccountEmailHandoffScheduler(); });
afterAll(() => {
  if (originalInterval === undefined) delete process.env.CORE_V2_ACCOUNT_EMAIL_POLL_INTERVAL_MS;
  else process.env.CORE_V2_ACCOUNT_EMAIL_POLL_INTERVAL_MS = originalInterval;
});

test('V1-only startup does not open Core or start an account handoff drain', async () => {
  jest.mocked(getAuthRolloutMode).mockReturnValue('V1_ONLY');
  await startAccountEmailHandoffScheduler();
  kickAccountEmailHandoffDrain();
  await stopAccountEmailHandoffScheduler();
  expect(requireCoreV2Client).not.toHaveBeenCalled();
  expect(drainAccountEmailHandoffs).not.toHaveBeenCalled();
});

test('startup drains once and triggers the sender only after a completed handoff', async () => {
  await startAccountEmailHandoffScheduler();
  kickAccountEmailHandoffDrain();
  await stopAccountEmailHandoffScheduler();
  expect(drainAccountEmailHandoffs).toHaveBeenCalledTimes(1);
  expect(kickEmailOutboxDrain).toHaveBeenCalledTimes(1);
});

test('configuration failure prevents Core startup rather than creating an inactive recovery path', async () => {
  jest.mocked(assertAccountEmailHandoffConfiguration).mockImplementationOnce(() => { throw new Error('ACCOUNT_EMAIL_HANDOFF_KEY_INVALID'); });
  await expect(startAccountEmailHandoffScheduler()).rejects.toThrow('ACCOUNT_EMAIL_HANDOFF_KEY_INVALID');
  expect(requireCoreV2Client).not.toHaveBeenCalled();
});

test('a retry without destination acknowledgment does not trigger the sender', async () => {
  jest.mocked(drainAccountEmailHandoffs).mockResolvedValueOnce({ claimed: 1, completed: 0, discarded: 0, retried: 1, leaseLost: 0, failedFinal: 0 });
  await startAccountEmailHandoffScheduler();
  await stopAccountEmailHandoffScheduler();
  expect(drainAccountEmailHandoffs).toHaveBeenCalledTimes(1);
  expect(kickEmailOutboxDrain).not.toHaveBeenCalled();
});


test('a missing or incomplete schema expansion prevents recovery startup', async () => {
  jest.mocked(assertAccountEmailHandoffSchema).mockRejectedValueOnce(new Error('ACCOUNT_EMAIL_HANDOFF_SCHEMA_UNAVAILABLE'));
  await expect(startAccountEmailHandoffScheduler()).rejects.toThrow('ACCOUNT_EMAIL_HANDOFF_SCHEMA_UNAVAILABLE');
  expect(drainAccountEmailHandoffs).not.toHaveBeenCalled();
});
