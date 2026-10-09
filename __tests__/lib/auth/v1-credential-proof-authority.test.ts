const mockMode = jest.fn();
const mockOwned = jest.fn();
const mockEmailAuthority = jest.fn();
jest.mock('@/lib/core-v2/auth/authority', () => ({
  getAuthRolloutMode: (...args: unknown[]) => mockMode(...args),
  isIdentityOwnedByCoreV2: (...args: unknown[]) => mockOwned(...args),
  resolveCredentialAuthority: (...args: unknown[]) => mockEmailAuthority(...args),
}));
import { canApplyV1CredentialProof } from '@/lib/auth/password-reset-authority';
const input = { userId: 'synthetic-parent', email: 'guardian@example.test' };
beforeEach(() => {
  jest.clearAllMocks(); mockMode.mockReturnValue('V1_ONLY');
  mockOwned.mockResolvedValue(false); mockEmailAuthority.mockResolvedValue('V1');
});
test('V1_ONLY never opens Core-v2', async () => {
  expect(await canApplyV1CredentialProof(input)).toBe(true);
  expect(mockOwned).not.toHaveBeenCalled(); expect(mockEmailAuthority).not.toHaveBeenCalled();
});
test('V2_ONLY never authorizes a V1 proof, even for an absent Core identity', async () => {
  mockMode.mockReturnValue('V2_ONLY');
  expect(await canApplyV1CredentialProof(input)).toBe(false);
  expect(mockOwned).not.toHaveBeenCalled(); expect(mockEmailAuthority).not.toHaveBeenCalled();
});
test('HYBRID refuses a Core-owned ID without applying an email fallback', async () => {
  mockMode.mockReturnValue('HYBRID'); mockOwned.mockResolvedValue(true);
  expect(await canApplyV1CredentialProof(input)).toBe(false);
  expect(mockEmailAuthority).not.toHaveBeenCalled();
});
test('HYBRID also refuses a Core-owned email with a different identity ID', async () => {
  mockMode.mockReturnValue('HYBRID'); mockEmailAuthority.mockResolvedValue('CORE_V2');
  expect(await canApplyV1CredentialProof(input)).toBe(false);
  expect(mockOwned).toHaveBeenCalledWith(input.userId);
  expect(mockEmailAuthority).toHaveBeenCalledWith(input.email);
});
test('HYBRID accepts a proof only when both relevant identity resolutions remain V1', async () => {
  mockMode.mockReturnValue('HYBRID'); expect(await canApplyV1CredentialProof(input)).toBe(true);
});
test('phone proof resolution uses its verified identity ID, without trusting a contact email', async () => {
  mockMode.mockReturnValue('HYBRID'); expect(await canApplyV1CredentialProof({ userId: input.userId })).toBe(true);
  expect(mockOwned).toHaveBeenCalledWith(input.userId); expect(mockEmailAuthority).not.toHaveBeenCalled();
});
test.each(['id', 'email'] as const)('an unavailable %s authority propagates refusal without fallback', async (lookup) => {
  mockMode.mockReturnValue('HYBRID');
  (lookup === 'id' ? mockOwned : mockEmailAuthority).mockRejectedValue(new Error('synthetic unavailable'));
  await expect(canApplyV1CredentialProof(input)).rejects.toThrow('synthetic unavailable');
});
