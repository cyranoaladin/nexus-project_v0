import { NextRequest } from 'next/server';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
import { auth } from '@/auth';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import { setupServiceHarness } from '../helpers/service-harness';
import { GET } from '@/app/api/v2/self/membership/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;
const savedUrl = process.env.CORE_V2_DATABASE_URL;
const request = () => new NextRequest(`http://localhost/api/v2/self/membership?userId=${h.parentActor.userId}&role=ADMIN`);
function session(id: string, role = 'PARENT', authority = 'V1') {
  mockedAuth.mockResolvedValue({ user: { id, role, authority, email: 'synthetic@example.test' }, expires: '2099-01-01' });
}
async function snapshot() {
  return h.client.$queryRawUnsafe(`SELECT table_name, (xpath('/row/fingerprint/text()', query_to_xml(format('SELECT md5(coalesce(string_agg(row_to_json(t)::text, %L ORDER BY row_to_json(t)::text), %L)) AS fingerprint FROM %I t', '', '', table_name), false, true, '')))[1]::text AS fingerprint FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
}
async function response() {
  const r = await GET(request());
  expect(r.headers.get('cache-control')).toBe('private, no-store, max-age=0');
  expect(r.headers.get('vary')).toBe('Cookie');
  return { status: r.status, body: await r.json() };
}
beforeEach(() => session(h.parentActor.userId));
afterEach(async () => { await disconnectCoreV2Client(); process.env.CORE_V2_DATABASE_URL = savedUrl; });

test('a missing canonical session is refused privately without Core writes', async () => {
  const before = await snapshot();
  mockedAuth.mockResolvedValue(null);
  expect(await response()).toMatchObject({ status: 401, body: { ok: false, error: { code: 'UNAUTHENTICATED' } } });
  expect(await snapshot()).toEqual(before);
});
test('another credential authority is refused, without consulting Core', async () => {
  session(h.parentActor.userId, 'PARENT', 'CORE_V2');
  const read = jest.spyOn((await requireCoreV2Client()).user, 'findUnique');
  expect((await response()).status).toBe(401);
  expect(read).not.toHaveBeenCalled(); read.mockRestore();
});
test.each(['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'] as const)('own metadata for %s ignores client identifiers and exposes only the stored Core role', async role => {
  const user = role === 'ADMIN' ? { id: h.admin.userId } : await h.client.user.create({ data: { role, accountStatus: 'ACTIVE' } });
  session(user.id, role === 'ADMIN' ? 'COACH' : role);
  const before = await snapshot();
  expect(await response()).toMatchObject({ status: 200, body: { ok: true, data: { state: 'ACTIVE', role } } });
  expect((await response()).body.data).toEqual({ state: 'ACTIVE', role });
  expect(await snapshot()).toEqual(before);
});
test.each(['PENDING_ACTIVATION', 'SUSPENDED', 'DISABLED'] as const)('inactive %s reveals no detailed state or business role and performs no writes', async accountStatus => {
  await h.client.user.update({ where: { id: h.parentActor.userId }, data: { accountStatus } });
  const before = await snapshot();
  expect((await response()).body.data).toEqual({ state: 'INACTIVE' });
  expect(await snapshot()).toEqual(before);
});
test('a non-member is distinct from a broken configured Core database', async () => {
  session('absent-immutable-v1-id');
  expect((await response()).body.data).toEqual({ state: 'NOT_MEMBER' });
  const read = jest.spyOn((await requireCoreV2Client()).user, 'findUnique').mockRejectedValueOnce(new Error('private database payload'));
  expect(await response()).toMatchObject({ status: 503, body: { ok: false, error: { code: 'CORE_V2_UNAVAILABLE' } } });
  read.mockRestore();
});
test('absent configuration is NOT_ENABLED; an empty configured value fails closed', async () => {
  await disconnectCoreV2Client(); delete process.env.CORE_V2_DATABASE_URL;
  expect((await response()).body.data).toEqual({ state: 'NOT_ENABLED' });
  process.env.CORE_V2_DATABASE_URL = '';
  expect((await response()).status).toBe(503);
});
test('a V1 database collision and an unavailable target fail closed with a constant response', async () => {
  await disconnectCoreV2Client();
  process.env.CORE_V2_DATABASE_URL = process.env.DATABASE_URL;
  const wrong = await response();
  expect(wrong.status).toBe(503);
  await disconnectCoreV2Client();
  process.env.CORE_V2_DATABASE_URL = 'postgresql://postgres@127.0.0.1:1/unavailable';
  const unavailable = await response();
  expect(unavailable.status).toBe(503);
  expect(unavailable.body.error).toEqual(wrong.body.error);
  expect(JSON.stringify(unavailable.body)).not.toContain('postgresql');
});
