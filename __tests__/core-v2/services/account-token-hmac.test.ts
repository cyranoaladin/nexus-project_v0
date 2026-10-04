import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  activateAccount, createHousehold, inspectInvitation, inspectPasswordReset, inviteAccount, requestPasswordReset,
} from '@/lib/core-v2/services';
import { createServiceContext } from '@/lib/core-v2/services/context';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();
const now = () => new Date('2026-10-03T08:00:00.000Z');
const ctx = () => createServiceContext(h.admin, { now });
const currentName = 'CORE_V2_ACCOUNT_TOKEN_HMAC_CURRENT_KEY_ID';
const keysName = 'CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS';
const original = { current: process.env[currentName], keys: process.env[keysName] };
let primary: string;
let secondary: string;

beforeEach(() => {
  primary = randomBytes(32).toString('hex');
  secondary = randomBytes(32).toString('hex');
  process.env[currentName] = 'primary';
  process.env[keysName] = JSON.stringify({ primary });
});
afterEach(() => {
  for (const [name, value] of [[currentName, original.current], [keysName, original.keys]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function parent(email = 'hmac-primary@example.test') {
  return (await createHousehold(h.client, ctx(), {
    parent: { firstName: 'Synthetic', lastName: 'Hmac', email },
  })).parent;
}

test('activation uses a dedicated versioned HMAC and preserves 256 bits of CSPRNG entropy', async () => {
  const user = await parent();
  const issued = await inviteAccount(h.client, ctx(), user.id);
  expect(/^v1:primary:[A-Za-z0-9_-]{43}$/.test(issued.rawToken)).toBe(true);
  expect(Buffer.from(issued.rawToken.split(':')[2]!, 'base64url').byteLength).toBe(32);
  const expected = createHmac('sha256', Buffer.from(primary, 'hex'))
    .update(`nexus-core-v2-account-token\0v1\0ACTIVATION\0${issued.rawToken}`).digest('hex');
  expect(issued.invitation.tokenHash).toBe(`v1:primary:${expected}`);
  expect(JSON.stringify({ invitation: issued.invitation, audit: await h.client.auditEvent.findMany() })
    .includes(issued.rawToken)).toBe(false);
});

test('legacy SHA proof is retained in storage but cannot inspect or activate an account', async () => {
  const user = await parent();
  const rawToken = randomBytes(32).toString('base64url');
  const invitation = await h.client.invitation.create({ data: {
    userId: user.id, purpose: 'ACTIVATION', tokenHash: createHash('sha256').update(rawToken).digest('hex'),
    expiresAt: new Date(now().getTime() + 60_000),
  } });
  expect(await inspectInvitation(h.client, rawToken, now)).toBeNull();
  await expect(activateAccount(h.client, {
    rawToken, password: randomBytes(20).toString('hex').concat('-Aa1!'),
  }, { now })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await h.client.invitation.findUniqueOrThrow({ where: { id: invitation.id } }))
    .toMatchObject({ consumedAt: null, revokedAt: null });
  expect(await h.client.user.findUniqueOrThrow({ where: { id: user.id } }))
    .toMatchObject({ accountStatus: 'PENDING_ACTIVATION', password: null, sessionVersion: 0 });
});

test('reset HMAC is independently verifiable and cannot be used as an activation proof', async () => {
  const user = await parent();
  const activation = await inviteAccount(h.client, ctx(), user.id);
  await activateAccount(h.client, {
    rawToken: activation.rawToken, password: randomBytes(20).toString('hex').concat('-Aa1!'),
  }, { now });
  const reset = await requestPasswordReset(h.client, { email: user.email! }, { now });
  if (!reset) throw new Error('SYNTHETIC_ACCOUNT_NOT_ELIGIBLE');
  const expected = createHmac('sha256', Buffer.from(primary, 'hex'))
    .update(`nexus-core-v2-account-token\0v1\0PASSWORD_RESET\0${reset.rawToken}`).digest('hex');
  expect(reset.tokenHash).toBe(`v1:primary:${expected}`);
  expect(await inspectPasswordReset(h.client, reset.rawToken, now)).toBe(true);
  expect(await inspectInvitation(h.client, reset.rawToken, now)).toBeNull();
  expect(JSON.stringify(await h.client.invitation.findMany()).includes(reset.rawToken)).toBe(false);
  expect(JSON.stringify(await h.client.auditEvent.findMany()).includes(reset.rawToken)).toBe(false);
});

test('malformed and retired activation proofs are refused before a database lookup', async () => {
  const lookup = jest.spyOn(h.client.invitation, 'findUnique');
  try {
    for (const raw of ['malformed', `v1:retired:${randomBytes(32).toString('base64url')}`]) {
      expect(await inspectInvitation(h.client, raw, now)).toBeNull();
    }
    expect(lookup).not.toHaveBeenCalled();
  } finally {
    lookup.mockRestore();
  }
});

test('missing dedicated key refuses issuance atomically', async () => {
  const user = await parent();
  delete process.env[keysName];
  await expect(inviteAccount(h.client, ctx(), user.id)).rejects.toThrow('CORE_V2_ACCOUNT_TOKEN_KEYS_REQUIRED');
  expect(await h.client.invitation.count({ where: { userId: user.id } })).toBe(0);
  expect(await h.client.auditEvent.count({ where: { action: 'account.invited' } })).toBe(0);
});

test('rotation keeps the previous key valid until explicit retirement without falling back to SHA', async () => {
  const first = await parent();
  const old = await inviteAccount(h.client, ctx(), first.id);
  process.env[keysName] = JSON.stringify({ primary, secondary });
  process.env[currentName] = 'secondary';
  const next = await inviteAccount(h.client, ctx(), (await parent('hmac-secondary@example.test')).id);
  expect(/^v1:secondary:/.test(next.rawToken)).toBe(true);
  expect(await inspectInvitation(h.client, old.rawToken, now)).not.toBeNull();
  expect(await inspectInvitation(h.client, next.rawToken, now)).not.toBeNull();
  process.env[keysName] = JSON.stringify({ secondary });
  expect(await inspectInvitation(h.client, old.rawToken, now)).toBeNull();
  expect(await inspectInvitation(h.client, next.rawToken, now)).not.toBeNull();
  await expect(activateAccount(h.client, {
    rawToken: old.rawToken, password: randomBytes(20).toString('hex').concat('-Aa1!'),
  }, { now })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await h.client.user.findUniqueOrThrow({ where: { id: first.id } }))
    .toMatchObject({ accountStatus: 'PENDING_ACTIVATION', password: null, sessionVersion: 0 });
});
