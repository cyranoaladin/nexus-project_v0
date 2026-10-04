import { randomBytes } from 'node:crypto';
import { openAccountEmailHandoff, sealAccountEmailHandoff } from '@/lib/email/account-handoff-envelope';

const names = ['EMAIL_OUTBOX_ENCRYPTION_KEY', 'ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_CURRENT_KEY_ID', 'ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_KEYS'] as const;
const saved = names.map(name => process.env[name]);
const input = { purpose: 'PASSWORD_RESET' as const, userId: 'synthetic-user', issuanceId: 'synthetic-issuance',
  role: 'PARENT' as const, email: 'synthetic@example.test', displayName: 'Synthetic Parent',
  rawToken: randomBytes(32).toString('base64url'), expiresAt: '2099-01-01T00:00:00.000Z' };
beforeEach(() => {
  process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  delete process.env.ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_CURRENT_KEY_ID;
  delete process.env.ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_KEYS;
});
afterAll(() => names.forEach((name, index) => {
  if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index];
}));

test('encrypts recipient/proof and authenticates the exact issuance identity', () => {
  const envelope = sealAccountEmailHandoff(input);
  expect(JSON.stringify(envelope).includes(input.rawToken)).toBe(false);
  expect(JSON.stringify(envelope).includes(input.email)).toBe(false);
  const opened = openAccountEmailHandoff(envelope, input.issuanceId);
  expect(opened.rawToken === input.rawToken && opened.email === input.email).toBe(true);
  expect(() => openAccountEmailHandoff(envelope, 'another-issuance')).toThrow('ACCOUNT_EMAIL_HANDOFF_INVALID');
});

test('uses a new nonce for repeated sealing of the same proof', () => {
  expect(sealAccountEmailHandoff(input).iv !== sealAccountEmailHandoff(input).iv).toBe(true);
});

test('refuses tampering, unknown keys and unsupported versions', () => {
  const envelope = sealAccountEmailHandoff(input);
  expect(() => openAccountEmailHandoff({ ...envelope, tag: randomBytes(16).toString('base64url') }, input.issuanceId)).toThrow('ACCOUNT_EMAIL_HANDOFF_INVALID');
  expect(() => openAccountEmailHandoff({ ...envelope, keyVersion: 'missing' }, input.issuanceId)).toThrow('ACCOUNT_EMAIL_HANDOFF_INVALID');
  expect(() => openAccountEmailHandoff({ ...envelope, schemaVersion: 'unknown' }, input.issuanceId)).toThrow('ACCOUNT_EMAIL_HANDOFF_INVALID');
});

test('rotation writes the current key while retained v1 envelopes remain readable', () => {
  const oldKey = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY!;
  const old = sealAccountEmailHandoff(input);
  process.env.ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_CURRENT_KEY_ID = 'v2';
  process.env.ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_KEYS = JSON.stringify({ v1: oldKey, v2: randomBytes(32).toString('hex') });
  expect(sealAccountEmailHandoff(input).keyVersion).toBe('v2');
  expect(openAccountEmailHandoff(old, input.issuanceId).rawToken === input.rawToken).toBe(true);
  process.env.ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_KEYS = JSON.stringify({ v2: randomBytes(32).toString('hex') });
  expect(() => openAccountEmailHandoff(old, input.issuanceId)).toThrow('ACCOUNT_EMAIL_HANDOFF_INVALID');
});

test('partial keyring configuration fails closed rather than falling back', () => {
  process.env.ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_CURRENT_KEY_ID = 'v2';
  expect(() => sealAccountEmailHandoff(input)).toThrow('ACCOUNT_EMAIL_HANDOFF_KEY_INVALID');
});

test('missing or short legacy encryption key refuses issuance', () => {
  delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
  expect(() => sealAccountEmailHandoff(input)).toThrow('ACCOUNT_EMAIL_HANDOFF_KEY_INVALID');
  process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = 'synthetic-short';
  expect(() => sealAccountEmailHandoff(input)).toThrow('ACCOUNT_EMAIL_HANDOFF_KEY_INVALID');
});
