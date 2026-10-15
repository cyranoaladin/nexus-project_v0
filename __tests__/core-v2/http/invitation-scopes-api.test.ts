import { NextRequest } from 'next/server';
const mockAuth = jest.fn();
jest.mock('@/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
import { GET, PUT } from '@/app/api/v2/staff/households/[id]/invitation-scopes/route';
import { setupServiceHarness, seedAcademicYear } from '../helpers/service-harness';
const h = setupServiceHarness();
let householdId: string;
let academicYearId: string;
beforeEach(async () => {
  householdId = (await h.client.household.create({ data: {} })).id;
  academicYearId = (await seedAcademicYear(h.client, 2026)).id;
});
const params = () => ({ params: Promise.resolve({ id: householdId }) });
function request(method = 'GET', extra: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost:3000/api/v2/staff/households/${householdId}/invitation-scopes`, {
    method, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    ...(method === 'PUT' ? { body: JSON.stringify({ staffUserId: h.assistante.userId, academicYearId,
      expectedRevision: 0, active: true, ...extra }) } : {}),
  });
}
function signIn(userId: string, role = 'ADMIN') {
  mockAuth.mockResolvedValue({ user: { id: userId, role, email: 'actor@example.test' }, expires: '2099-01-01' });
}
test('ADMIN assigns and revokes exactly one household/year with revision conflicts and an audit trail', async () => {
  signIn(h.admin.userId);
  const initial = await GET(request(), params());
  expect(initial.status).toBe(200);
  expect((await initial.json()).data).toMatchObject({ householdId, grants: [],
    assistants: [expect.objectContaining({ id: h.assistante.userId })],
    years: [expect.objectContaining({ id: academicYearId })] });
  expect((await PUT(request('PUT'), params())).status).toBe(200);
  expect((await PUT(request('PUT'), params())).status).toBe(409);
  expect((await PUT(request('PUT', { expectedRevision: 1, active: false }), params())).status).toBe(200);
  expect(await h.client.invitationScopeGrant.findMany()).toEqual([expect.objectContaining({
    householdId, academicYearId, staffUserId: h.assistante.userId, revision: 2, revokedAt: expect.any(Date) })]);
  expect(await h.client.auditEvent.findMany({ where: { subjectType: 'InvitationScopeGrant' } })).toHaveLength(2);
});
test.each(['ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'] as const)('%s cannot enumerate or grant assignments, even with a forged ADMIN session role', async role => {
  const userId = role === 'ASSISTANTE' ? h.assistante.userId :
    (await h.client.user.create({ data: { role, accountStatus: 'ACTIVE' } })).id;
  signIn(userId, 'ADMIN');
  const before = await h.client.auditEvent.findMany();
  expect((await GET(request(), params())).status).toBe(403);
  expect((await PUT(request('PUT'), params())).status).toBe(403);
  expect(await h.client.invitationScopeGrant.count()).toBe(0);
  expect(await h.client.auditEvent.findMany()).toEqual(before);
});
test('anonymous and suspended identities never gain authority', async () => {
  mockAuth.mockResolvedValue(null);
  expect((await GET(request(), params())).status).toBe(401);
  expect((await PUT(request('PUT'), params())).status).toBe(401);
  await h.client.user.update({ where: { id: h.admin.userId }, data: { accountStatus: 'SUSPENDED' } });
  signIn(h.admin.userId);
  expect((await GET(request(), params())).status).toBe(403);
  expect((await PUT(request('PUT'), params())).status).toBe(403);
  expect(await h.client.invitationScopeGrant.count()).toBe(0);
});
test('a client cannot replace the household in the route or supply an issuer', async () => {
  signIn(h.admin.userId);
  for (const extra of [{ householdId: 'forged-household' }, { issuerId: h.assistante.userId }]) {
    expect((await PUT(request('PUT', extra), params())).status).toBe(400);
  }
  expect(await h.client.invitationScopeGrant.count()).toBe(0);
});
test('concurrent grant revisions have one effect; replay cannot increase revision', async () => {
  signIn(h.admin.userId);
  const responses = await Promise.all([PUT(request('PUT'), params()), PUT(request('PUT'), params())]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  expect(await h.client.invitationScopeGrant.count()).toBe(1);
  expect(await h.client.auditEvent.count({ where: { subjectType: 'InvitationScopeGrant' } })).toBe(1);
});
