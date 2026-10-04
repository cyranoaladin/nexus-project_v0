/** @jest-environment node */
jest.mock('@/lib/core-v2/client', () => ({ requireCoreV2Client: jest.fn() }));

import { randomUUID } from 'node:crypto';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import {
  resolveCredentialAuthority, isIdentityOwnedByCoreV2, authenticateCoreV2,
  revokeCoreV2UserSessions, validateCoreV2Session,
} from '@/lib/core-v2/auth/authority';
import { getAuthRolloutMode } from '@/lib/core-v2/auth/rollout';

const initialMode = process.env.CORE_V2_AUTH_MODE;
afterEach(() => {
  if (initialMode === undefined) delete process.env.CORE_V2_AUTH_MODE;
  else process.env.CORE_V2_AUTH_MODE = initialMode;
  jest.resetAllMocks();
});

test.each([
  ['resolution', () => resolveCredentialAuthority('synthetic@example.test')],
  ['ownership', () => isIdentityOwnedByCoreV2('synthetic-user')],
  ['authentication', () => authenticateCoreV2('synthetic@example.test', randomUUID())],
  ['revocation', () => revokeCoreV2UserSessions('synthetic-user')],
  ['session validation', () => validateCoreV2Session({ userId: 'synthetic-user', role: 'PARENT', sessionVersion: 1 })],
] as const)('%s refuses without propagating driver diagnostics', async (_name, operation) => {
  process.env.CORE_V2_AUTH_MODE = 'HYBRID';
  const privateDiagnostic = randomUUID();
  jest.mocked(requireCoreV2Client).mockRejectedValue(new Error(privateDiagnostic));
  let refused = false;
  try { await operation(); } catch (error) {
    refused = true;
    expect(error instanceof Error).toBe(true);
    if (!(error instanceof Error)) throw new Error('EXPECTED_CONTROLLED_ERROR');
    expect(error.name).toBe('CoreV2AuthorityUnavailableError');
    expect(error.message.includes(privateDiagnostic)).toBe(false);
    expect(JSON.stringify(error).includes(privateDiagnostic)).toBe(false);
  }
  expect(refused).toBe(true);
});

test('a malformed rollout mode is refused without echoing its value', () => {
  const invalidMode = randomUUID();
  let refused = false;
  try { getAuthRolloutMode({ CORE_V2_AUTH_MODE: invalidMode }); } catch (error) {
    refused = true;
    expect(error instanceof Error).toBe(true);
    if (!(error instanceof Error)) throw new Error('EXPECTED_CONTROLLED_ERROR');
    expect(error.message.includes(invalidMode)).toBe(false);
  }
  expect(refused).toBe(true);
});
