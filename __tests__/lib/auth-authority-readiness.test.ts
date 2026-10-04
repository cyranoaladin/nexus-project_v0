const mockCoreClient = jest.fn();
const mockProbe = jest.fn();
jest.mock('@/lib/core-v2/client', () => ({ requireCoreV2Client: () => mockCoreClient() }));
import { checkAuthAuthorityReadiness } from '@/lib/auth/auth-rollout-startup';

const originalMode = process.env.CORE_V2_AUTH_MODE;
beforeEach(() => { jest.clearAllMocks(); mockCoreClient.mockResolvedValue({ $queryRaw: mockProbe }); mockProbe.mockResolvedValue([{ value: 1 }]); });
afterEach(() => {
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
