import { NextRequest } from 'next/server';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/core-v2/accounts/invitation-runtime', () => ({ assertAccountInvitationRuntimeConfiguration: jest.fn() }));
jest.mock('@/lib/core-v2/accounts/email-handoff-scheduler', () => ({ kickAccountEmailHandoffDrain: jest.fn() }));
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { setupV1Fixture } from '../helpers/v1-provisioning-fixture';
import { ariaHttpCookie } from '../helpers/aria-http-cookie';
import { requestAccountInvitation } from '@/lib/core-v2/services';
import { POST as invite } from '@/app/api/v2/staff/accounts/[id]/invite/route';
import { POST as resend } from '@/app/api/v2/staff/accounts/[id]/resend-invitation/route';
const f = setupV1Fixture();
const snapshotSql = `SELECT table_name, (xpath('/row/fingerprint/text()', query_to_xml(format('SELECT md5(coalesce(string_agg(row_to_json(t)::text, %L ORDER BY row_to_json(t)::text), %L)) AS fingerprint FROM %I t', '', '', table_name), false, true, '')))[1]::text AS fingerprint FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
async function snapshots() { return Promise.all([f.h.client.$queryRawUnsafe(snapshotSql), prisma.$queryRawUnsafe(snapshotSql)]); }
async function prepare(operation: 'INVITE' | 'RESEND') {
  const target = await f.coreUser('PARENT', 'http-original-session');
  if (operation === 'RESEND') await requestAccountInvitation(f.h.client, f.h.ctx(), target.id);
  jest.mocked(auth).mockResolvedValue({ user: { id: f.h.admin.userId, role: 'ADMIN', email: 'actor@synthetic.test', authority: 'V1' }, expires: '2099-01-01' } as Awaited<ReturnType<typeof auth>>);
  const cookie = await ariaHttpCookie(f.h.admin.userId);
  return { target, cookie, route: operation === 'INVITE' ? invite : resend };
}
function request(cookie: Record<string, string>) {
  return new NextRequest('http://localhost:3000/api/v2/staff/accounts/target/invite', {
    method: 'POST', headers: { origin: 'http://localhost:3000', ...cookie },
  });
}
test.each(['INVITE', 'RESEND'] as const)('%s preserves a fresh original V1 session while queueing no Core credential', async operation => {
  const a = await prepare(operation);
  expect((await a.route(request(a.cookie), { params: Promise.resolve({ id: a.target.id }) })).status).toBe(201);
  expect(await f.h.client.user.findUniqueOrThrow({ where: { id: a.target.id } })).toMatchObject({ password: null, sessionVersion: 0 });
  expect(await prisma.v1AccountInvitationIssuance.count()).toBe(0);
});
test.each(['INVITE', 'RESEND'] as const)('%s refuses a missing private request cookie without any database change', async operation => {
  const a = await prepare(operation); const before = await snapshots();
  expect((await a.route(request({}), { params: Promise.resolve({ id: a.target.id }) })).status).toBe(403);
  expect(await snapshots()).toEqual(before);
});
describe.each(['INVITE', 'RESEND'] as const)('%s original authority', operation => {
  test.each(['reset', 'role', 'disabled', 'merged', 'pin'] as const)('does not adopt a newer V1 identity after %s', async change => {
    const a = await prepare(operation);
    await prisma.user.update({ where: { id: f.h.admin.userId }, data: change === 'reset' ? { sessionVersion: { increment: 1 } }
      : change === 'role' ? { role: 'PARENT' } : change === 'disabled' ? { disabledAt: new Date() }
        : change === 'merged' ? { mergedIntoUserId: f.h.assistante.userId } : { pinHash: 'synthetic-reset-code' } });
    const before = await snapshots();
    const response = await a.route(request(a.cookie), { params: Promise.resolve({ id: a.target.id }) });
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ error: { message: 'Invitation operation unavailable.' } });
    expect(await snapshots()).toEqual(before);
  });
});
test.each(['INVITE', 'RESEND'] as const)('%s projects its authorized recipient without another lookup after commit', async operation => {
  const a = await prepare(operation);
  const lookup = jest.spyOn(f.h.client.user, 'findUniqueOrThrow').mockRejectedValue(new Error('SYNTHETIC_POST_COMMIT_LOOKUP'));
  try {
    const response = await a.route(request(a.cookie), { params: Promise.resolve({ id: a.target.id }) });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { user: { id: a.target.id, role: 'PARENT' } } });
    expect(lookup).not.toHaveBeenCalled();
  } finally { lookup.mockRestore(); }
});

test.each(['reset', 'expiry'] as const)('the original HTTP authority is rechecked after waiting for the Core lock: %s', async change => {
  const a = await prepare('INVITE');
  if (change === 'expiry') jest.mocked(auth).mockResolvedValue({ user: { id: f.h.admin.userId, role: 'ADMIN',
    email: 'actor@synthetic.test', authority: 'V1' }, expires: new Date(Date.now() + 1500).toISOString() } as Awaited<ReturnType<typeof auth>>);
  let unlock!: () => void; let acquired!: () => void;
  const acquiredPromise = new Promise<void>(resolve => { acquired = resolve; });
  const hold = new Promise<void>(resolve => { unlock = resolve; });
  const locker = f.h.client.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242, 1026)`;
    acquired(); await hold;
  });
  let pending: Promise<Response> | undefined;
  try {
    await acquiredPromise;
    pending = a.route(request(a.cookie), { params: Promise.resolve({ id: a.target.id }) });
    const deadline = Date.now() + 2000;
    let waiting = false;
    while (Date.now() < deadline) {
      const rows = await f.h.client.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS(
        SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event = 'advisory') AS waiting`;
      if (rows[0]?.waiting) { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(waiting).toBe(true);
    if (change === 'reset') await prisma.user.update({ where: { id: f.h.admin.userId }, data: { sessionVersion: { increment: 1 } } });
    else await new Promise(resolve => setTimeout(resolve, 1600));
    const before = await snapshots(); unlock(); await locker;
    const response = await pending;
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { message: 'Invitation operation unavailable.' } });
    expect(await snapshots()).toEqual(before);
  } finally { unlock(); await locker; await pending; }
});
