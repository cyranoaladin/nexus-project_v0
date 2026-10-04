import { createHmac, randomBytes } from 'node:crypto';
import {
  ACCOUNT_TOKEN_CURRENT_KEY_ENV as currentName, ACCOUNT_TOKEN_KEYS_ENV as keysName,
  accountTokenDigest, assertAccountTokenConfiguration, createAccountToken,
} from '@/lib/core-v2/account-token';

const original = { current: process.env[currentName], keys: process.env[keysName] };
let key: string;
beforeEach(() => {
  key = randomBytes(32).toString('hex');
  process.env[currentName] = 'primary';
  process.env[keysName] = JSON.stringify({ primary: key });
});
afterEach(() => {
  for (const [name, value] of [[currentName, original.current], [keysName, original.keys]] as const) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

test.each(['ACTIVATION', 'PASSWORD_RESET'] as const)('%s digest matches the independent HMAC/domain contract', purpose => {
  const issued = createAccountToken(purpose);
  const expected = createHmac('sha256', Buffer.from(key, 'hex'))
    .update(`nexus-core-v2-account-token\0v1\0${purpose}\0${issued.rawToken}`).digest('hex');
  expect(issued.tokenHash).toBe(`v1:primary:${expected}`);
  expect(accountTokenDigest(issued.rawToken, purpose)).toBe(issued.tokenHash);
  const other = purpose === 'ACTIVATION' ? 'PASSWORD_RESET' : 'ACTIVATION';
  expect(accountTokenDigest(issued.rawToken, other)).not.toBe(issued.tokenHash);
});

test.each([
  '', 'A'.repeat(43), `v2:primary:${'A'.repeat(43)}`, `v1:PRIMARY:${'A'.repeat(43)}`,
  `v1:primary:${'A'.repeat(42)}`, `v1:primary:${'A'.repeat(44)}`, `v1:primary:${'A'.repeat(42)}B`,
  `v1:primary:${'A'.repeat(43)}\0`, `v1:prımary:${'A'.repeat(43)}`, 'v1:' + 'p'.repeat(25) + ':' + 'A'.repeat(43),
])('malformed/version/legacy token refuses before reading secret configuration (%#)', rawToken => {
  delete process.env[keysName];
  expect(accountTokenDigest(rawToken, 'ACTIVATION')).toBeNull();
});

test('an unknown key-id is refused with a configured keyring', () => {
  expect(accountTokenDigest(`v1:retired:${'A'.repeat(43)}`, 'ACTIVATION')).toBeNull();
});

test.each([
  undefined, '', 'null', '[]', '{}', '{', JSON.stringify({ primary: 'short' }),
  JSON.stringify({ primary: 'x'.repeat(64) }), JSON.stringify({ primary: 'a'.repeat(65) }),
  JSON.stringify({ primary: 42 }), JSON.stringify({ PRIMARY: 'a'.repeat(64) }), ' '.repeat(4097),
])('invalid or missing configuration cannot issue a token (%#)', encoded => {
  if (encoded === undefined) delete process.env[keysName]; else process.env[keysName] = encoded;
  expect(() => createAccountToken('ACTIVATION')).toThrow(/^CORE_V2_ACCOUNT_TOKEN_/);
});

test('configuration errors never echo key material', () => {
  process.env[keysName] = JSON.stringify({ primary: key, secondary: key });
  try { assertAccountTokenConfiguration(); throw new Error('CONFIGURATION_WAS_ACCEPTED'); }
  catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('CORE_V2_ACCOUNT_TOKEN_KEY_REUSED');
    expect((error as Error).message.includes(key)).toBe(false);
  }
});

test('a key reused from the session secret is refused', () => {
  const prior = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = key;
  try { expect(() => assertAccountTokenConfiguration()).toThrow('CORE_V2_ACCOUNT_TOKEN_KEY_NOT_DEDICATED'); }
  finally { if (prior === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = prior; }
});

test('a current key-id absent from verification keys is refused', () => {
  process.env[currentName] = 'missing';
  expect(() => assertAccountTokenConfiguration()).toThrow('CORE_V2_ACCOUNT_TOKEN_CURRENT_KEY_ABSENT');
});
