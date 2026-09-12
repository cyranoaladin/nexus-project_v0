/**
 * Parent self-service API (§AH) against a real Core v2 database: a parent
 * reads exactly their own household; there is no id to tamper with; staff
 * and non-members are refused at the boundary; the payload carries no secret.
 */
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { NO_PARAMS } from '@/lib/core-v2/http/staff-route';
import { setupServiceHarness, seedAcademicYear } from '../helpers/service-harness';
import * as ownHousehold from '@/app/api/v2/parent/household/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;

function signInAs(user: { id: string; role: string } | null) {
  mockedAuth.mockResolvedValue(user ? { user: { id: user.id, role: user.role, email: 'x@synthetic.test' }, expires: '2099-01-01' } : null);
}

async function call() {
  const request = new NextRequest('http://localhost:3000/api/v2/parent/household', { method: 'GET', headers: { origin: 'http://localhost:3000' } });
  const response = await ownHousehold.GET(request, NO_PARAMS);
  return { status: response.status, body: await response.json() };
}

async function seedFamily(parentEmail: string, childFirstName: string) {
  const parent = await h.client.user.create({ data: { role: 'PARENT', email: parentEmail, firstName: 'Parent', lastName: childFirstName, accountStatus: 'ACTIVE', password: 'change_me_hash' } });
  const household = await h.client.household.create({ data: { parents: { create: { userId: parent.id, isPrimaryContact: true } } } });
  const child = await h.client.user.create({ data: { role: 'ELEVE', firstName: childFirstName, lastName: 'Synthetic', accountStatus: 'PENDING_ACTIVATION' } });
  const student = await h.client.student.create({ data: { userId: child.id, householdId: household.id } });
  return { parent, household, student };
}

test('a parent reads their own household — and only theirs — with no secret in the payload', async () => {
  const year = await seedAcademicYear(h.client, 2026);
  const mine = await seedFamily('mine@synthetic.test', 'Yasmine');
  const other = await seedFamily('other@synthetic.test', 'Ziad');
  await h.client.studentAcademicYearEnrollment.create({
    data: { studentId: mine.student.id, academicYearId: year.id, status: 'ACTIVE', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' },
  });

  signInAs({ id: mine.parent.id, role: 'PARENT' });
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body.data.id).toBe(mine.household.id);
  expect(r.body.data.students.map((s: { user: { firstName: string } }) => s.user.firstName)).toEqual(['Yasmine']);
  expect(r.body.data.students[0].enrollments[0]).toMatchObject({ status: 'ACTIVE', academicYear: { startYear: 2026 } });
  expect(JSON.stringify(r.body)).not.toMatch(/"password"|sessionVersion|Ziad/);

  signInAs({ id: other.parent.id, role: 'PARENT' });
  const o = await call();
  expect(o.body.data.id).toBe(other.household.id);
  expect(JSON.stringify(o.body)).not.toMatch(/Yasmine/);
});

test('the route accepts no household id: a query-string id is ignored, the actor decides', async () => {
  const mine = await seedFamily('mine@synthetic.test', 'Yasmine');
  const other = await seedFamily('other@synthetic.test', 'Ziad');
  signInAs({ id: mine.parent.id, role: 'PARENT' });
  const request = new NextRequest(`http://localhost:3000/api/v2/parent/household?id=${other.household.id}&householdId=${other.household.id}`, { headers: { origin: 'http://localhost:3000' } });
  const body = await (await ownHousehold.GET(request, NO_PARAMS)).json();
  expect(body.data.id).toBe(mine.household.id);
});

test('a PARENT account attached to no household → 404 NOT_FOUND', async () => {
  signInAs({ id: h.parentActor.userId, role: 'PARENT' });
  const r = await call();
  expect(r.status).toBe(404);
  expect(r.body.error.code).toBe('NOT_FOUND');
});

test('staff and unauthenticated callers are refused at the boundary (Core v2 role is the authority)', async () => {
  signInAs({ id: h.admin.userId, role: 'PARENT' }); // session lies; Core v2 says ADMIN
  const staff = await call();
  expect(staff.status).toBe(403);
  expect(staff.body.error.code).toBe('FORBIDDEN');

  signInAs(null);
  expect((await call()).status).toBe(401);
});
