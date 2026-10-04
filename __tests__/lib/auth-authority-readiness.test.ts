const mockCoreClient = jest.fn();
const mockProbe = jest.fn();
jest.mock('@/lib/core-v2/client', () => ({ requireCoreV2Client: () => mockCoreClient() }));
import { assertAuthRolloutStartup, checkAuthAuthorityReadiness } from '@/lib/auth/auth-rollout-startup';

const originalMode = process.env.CORE_V2_AUTH_MODE;
const originalKeys = process.env.CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS;
const originalTtl = process.env.CORE_V2_PASSWORD_RESET_TTL_MINUTES;
beforeEach(() => { jest.clearAllMocks(); mockCoreClient.mockResolvedValue({ $queryRaw: mockProbe }); mockProbe.mockResolvedValue([{ value: 1 }]); });
afterEach(() => {
  for (const [name, value] of [['CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS', originalKeys], ['CORE_V2_PASSWORD_RESET_TTL_MINUTES', originalTtl]] as const) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  if (originalMode === undefined) delete process.env.CORE_V2_AUTH_MODE;
  else process.env.CORE_V2_AUTH_MODE = originalMode;
});
test('V1_ONLY does not open the Core database', async () => {
  process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
  expect(await checkAuthAuthorityReadiness()).toEqual({ mode: 'V1_ONLY', coreV2: 'not-applicable' });
  expect(mockCoreClient).not.toHaveBeenCalled();
});
test.each(['HYBRID', 'V2_ONLY'])('%s probes the selected authority on every check', async mode => {
  process.env.CORE_V2_AUTH_MODE = mode;
  expect(await checkAuthAuthorityReadiness()).toEqual({ mode, coreV2: 'ready' });
  await checkAuthAuthorityReadiness();
  expect(mockProbe).toHaveBeenCalledTimes(2);
});
test('an unavailable authority never becomes V1', async () => {
  process.env.CORE_V2_AUTH_MODE = 'HYBRID';
  mockProbe.mockRejectedValue(new Error('SYNTHETIC_AUTHORITY_UNAVAILABLE'));
  await expect(checkAuthAuthorityReadiness()).rejects.toThrow('SYNTHETIC_AUTHORITY_UNAVAILABLE');
});

test('Core readiness refuses missing dedicated account-token keys before a database probe', async () => {
  process.env.CORE_V2_AUTH_MODE = 'HYBRID';
  delete process.env.CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS;
  await expect(checkAuthAuthorityReadiness()).rejects.toThrow('CORE_V2_ACCOUNT_TOKEN_KEYS_REQUIRED');
  expect(mockProbe).not.toHaveBeenCalled();
});
test('Core startup refuses missing account-token keys instead of opening a broken public reset flow', async () => {
  process.env.CORE_V2_AUTH_MODE = 'HYBRID';
  process.env.CORE_V2_PASSWORD_RESET_TTL_MINUTES = '60';
  delete process.env.CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS;
  await expect(assertAuthRolloutStartup()).rejects.toThrow('CORE_V2_ACCOUNT_TOKEN_KEYS_REQUIRED');
});
test('V1_ONLY startup does not require Core account-token configuration', async () => {
  process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
  delete process.env.CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS;
  expect(await assertAuthRolloutStartup()).toBe('V1_ONLY');
  expect(mockCoreClient).not.toHaveBeenCalled();
});
