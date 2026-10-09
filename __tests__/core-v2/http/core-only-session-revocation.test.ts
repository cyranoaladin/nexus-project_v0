jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
import { randomBytes } from 'node:crypto';
import type { JWT } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { validateSessionToken } from '@/lib/auth/session-revocation';
import { createHousehold, inviteAccount, activateAccount } from '@/lib/core-v2/services';
import { POST } from '@/app/api/auth/sessions/revoke/route';
import { setupServiceHarness } from '../helpers/service-harness';
import { assertDisposablePostgresUrl } from '../../helpers/disposable-postgres';
const h = setupServiceHarness();
const previousMode = process.env.CORE_V2_AUTH_MODE;
beforeAll(() => { assertDisposablePostgresUrl(process.env.DATABASE_URL ?? ''); });
afterAll(async () => {
  if (previousMode === undefined) delete process.env.CORE_V2_AUTH_MODE; else process.env.CORE_V2_AUTH_MODE = previousMode;
  await prisma.$disconnect();
});

test.each(['HYBRID', 'V2_ONLY'])('a Core-only account revokes its prior validated claims in %s', async mode => {
  process.env.CORE_V2_AUTH_MODE = mode;
  const { parent } = await createHousehold(h.client, h.ctx(), { parent: { firstName: 'Synthetic', lastName: 'Core-only', email: 'core-only-revoke@example.test' } });
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const active = await activateAccount(h.client, { rawToken: issued.rawToken, password: randomBytes(32).toString('base64url') + 'Aa1!' });
  const claims: JWT = { id: parent.id, role: 'PARENT', authority: 'CORE_V2', sessionVersion: active.sessionVersion };
  expect(await prisma.user.count({ where: { id: parent.id } })).toBe(0);
  expect((await validateSessionToken(claims)) !== null).toBe(true);
  (auth as jest.Mock).mockImplementation(async () => await validateSessionToken(claims) ? { user: { id: parent.id, role: 'PARENT' } } : null);
  const invoke = () => POST(new NextRequest('http://localhost:3000/api/auth/sessions/revoke', { method: 'POST' }));
  expect((await invoke()).status).toBe(200);
  expect((await h.client.user.findUniqueOrThrow({ where: { id: parent.id } })).sessionVersion).toBe(active.sessionVersion + 1);
  expect(await validateSessionToken(claims)).toBeNull();
  expect((await invoke()).status).toBe(401);
});
