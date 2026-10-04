import { NextRequest } from 'next/server';
const mockAuth = jest.fn();
jest.mock('@/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
import { POST as verify } from '@/app/api/v2/staff/households/[id]/parents/[parentUserId]/verify/route';
import { POST as revoke } from '@/app/api/v2/staff/households/[id]/parents/[parentUserId]/revoke/route';
import { setupServiceHarness } from '../helpers/service-harness';
const h = setupServiceHarness();

async function fixture() {
  const household = await h.client.household.create({ data: { parents: { create: { userId: h.parentActor.userId } } } });
  return { household, params: { params: Promise.resolve({ id: household.id, parentUserId: h.parentActor.userId }) } };
}
function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/v2/staff/households/fixture/parents/fixture/verify', {
    method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}
function signIn(userId: string, role = 'ADMIN') {
  mockAuth.mockResolvedValue({ user: { id: userId, role, email: 'actor@example.test' }, expires: '2099-01-01' });
}

test('ADMIN verifies and revokes through native API with revision conflicts and durable audit', async () => {
  const { params } = await fixture();signIn(h.admin.userId);
  expect((await verify(request({ expectedRevision: 0, evidenceDigest: 'a'.repeat(64) }), params)).status).toBe(200);
  expect((await verify(request({ expectedRevision: 0, evidenceDigest: 'a'.repeat(64) }), params)).status).toBe(409);
  expect((await revoke(request({ expectedRevision: 1 }), params)).status).toBe(200);
  const membership = await h.client.householdParent.findUniqueOrThrow({ where: { userId: h.parentActor.userId } });
  expect(membership).toMatchObject({ verificationStatus: 'REVOKED', revision: 2, isPrimaryContact: false });
  expect(await h.client.auditEvent.count()).toBe(2);
});
test('a parent cannot gain staff authority by forging the session role', async () => {
  const { params } = await fixture();signIn(h.parentActor.userId);
  expect((await verify(request({ expectedRevision: 0, evidenceDigest: 'a'.repeat(64) }), params)).status).toBe(403);
  expect((await revoke(request({ expectedRevision: 0 }), params)).status).toBe(403);
  expect(await h.client.auditEvent.count()).toBe(0);
});
test('invalid evidence or an unauthenticated request cannot mutate membership', async () => {
  const { params } = await fixture();signIn(h.admin.userId);
  expect((await verify(request({ expectedRevision: 0, evidenceDigest: 'not-a-proof' }), params)).status).toBe(400);
  mockAuth.mockResolvedValue(null);
  expect((await verify(request({ expectedRevision: 0, evidenceDigest: 'a'.repeat(64) }), params)).status).toBe(401);
  expect(await h.client.auditEvent.count()).toBe(0);
});
