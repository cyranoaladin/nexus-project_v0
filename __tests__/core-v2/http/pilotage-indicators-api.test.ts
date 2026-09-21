/**
 * Jalon B operational indicators, at the HTTP boundary this time (not the
 * query function directly): a refusal obtained by calling a function proves
 * the function refuses — it says nothing about whether the route in front of
 * it is actually wired to the session and to that same function. This suite
 * proves the route: unauthenticated → 401, PARENT/ELEVE/COACH → 403 with no
 * data leaked in the refusal body, ADMIN/ASSISTANTE → 200 with the exact
 * envelope the browser client (components/dashboard/core-v2/api.ts) expects.
 */
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { CORRELATION_HEADER } from '@/lib/core-v2/http/respond';
import { NO_PARAMS } from '@/lib/core-v2/http/staff-route';
import { approveEnrollment, assignCoach, createAnnualEnrollment, createHousehold, createStudent, setCoachCapability, setCourseEnrollments } from '@/lib/core-v2/services';
import { setupServiceHarness, seedAcademicYear, seedCoach } from '../helpers/service-harness';

import * as enrollmentsPending from '@/app/api/v2/staff/enrollments/pending/route';
import * as assignmentsNeeded from '@/app/api/v2/staff/assignments/needed/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;

function signInAs(user: { id: string; role: string; email?: string } | null) {
  mockedAuth.mockResolvedValue(user ? { user: { id: user.id, role: user.role, email: user.email ?? 'x@synthetic.test' }, expires: '2099-01-01' } : null);
}

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: { origin: 'http://localhost:3000', ...headers } });
}

async function json(response: Response) {
  return { status: response.status, body: await response.json(), correlationId: response.headers.get(CORRELATION_HEADER) };
}

beforeEach(() => {
  signInAs({ id: h.admin.userId, role: 'ADMIN' });
});

describe('GET /api/v2/staff/enrollments/pending', () => {
  test('unauthenticated → 401', async () => {
    signInAs(null);
    const r = await json(await enrollmentsPending.GET(req('/api/v2/staff/enrollments/pending'), NO_PARAMS));
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });

  test.each(['PARENT', 'ELEVE', 'COACH'] as const)('%s is refused with no data in the response body', async (role) => {
    const outsiderEmail = `pilotage-outsider-${role.toLowerCase()}@synthetic.test`;
    const outsider = await h.client.user.create({ data: { role, email: outsiderEmail, accountStatus: 'ACTIVE' } });
    signInAs({ id: outsider.id, role });
    const r = await json(await enrollmentsPending.GET(req('/api/v2/staff/enrollments/pending'), NO_PARAMS));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
    expect(r.body.data).toBeUndefined();
    expect(JSON.stringify(r.body)).not.toMatch(/@synthetic\.test/);
  });

  test('ADMIN and ASSISTANTE both read the same envelope: totalCount, items, nextCursor', async () => {
    const year = await seedAcademicYear(h.client, 2026, 'CURRENT');
    const ctx = h.ctx();
    const { household } = await createHousehold(h.client, ctx, { parent: { firstName: 'Amel', lastName: 'Synthetic', email: 'amel-http@synthetic.test' } });
    const { student } = await createStudent(h.client, ctx, { householdId: household.id, student: { firstName: 'Yasmine', lastName: 'Synthetic' } });
    await createAnnualEnrollment(h.client, ctx, { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } });

    const admin = await json(await enrollmentsPending.GET(req('/api/v2/staff/enrollments/pending'), NO_PARAMS));
    expect(admin.status).toBe(200);
    expect(admin.body.data.totalCount).toBe(1);
    expect(admin.body.data.items[0].household.primaryContactName).toBe('Amel Synthetic');
    expect(admin.body.data.nextCursor).toBeNull();

    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const assistante = await json(await enrollmentsPending.GET(req('/api/v2/staff/enrollments/pending'), NO_PARAMS));
    expect(assistante.status).toBe(200);
    expect(assistante.body.data.totalCount).toBe(1);
  });
});

describe('GET /api/v2/staff/assignments/needed', () => {
  test('unauthenticated → 401', async () => {
    signInAs(null);
    const r = await json(await assignmentsNeeded.GET(req('/api/v2/staff/assignments/needed'), NO_PARAMS));
    expect(r.status).toBe(401);
  });

  test.each(['PARENT', 'ELEVE', 'COACH'] as const)('%s is refused with no data in the response body', async (role) => {
    const outsider = await h.client.user.create({ data: { role, email: `outsider2-${role.toLowerCase()}@synthetic.test`, accountStatus: 'ACTIVE' } });
    signInAs({ id: outsider.id, role });
    const r = await json(await assignmentsNeeded.GET(req('/api/v2/staff/assignments/needed'), NO_PARAMS));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
    expect(r.body.data).toBeUndefined();
  });

  test('reflects a real unassigned course through the route, with the exact same shape the browser client expects', async () => {
    const year = await seedAcademicYear(h.client, 2026, 'CURRENT');
    const ctx = h.ctx();
    const { coachId } = await seedCoach(h.client, 'coach-http@synthetic.test');
    await setCoachCapability(h.client, ctx, { coachId, courseKey: 'maths-premiere', granted: true });
    const { household } = await createHousehold(h.client, ctx, { parent: { firstName: 'Nadia', lastName: 'Synthetic', email: 'nadia-http@synthetic.test' } });
    const { student } = await createStudent(h.client, ctx, { householdId: household.id, student: { firstName: 'Karim', lastName: 'Synthetic' } });
    const enrollment = await createAnnualEnrollment(h.client, ctx, { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' } });
    await approveEnrollment(h.client, ctx, enrollment.id);
    await setCourseEnrollments(h.client, ctx, { enrollmentId: enrollment.id, courses: [{ courseKey: 'maths-premiere', kind: 'SPECIALTY' }] });

    const before = await json(await assignmentsNeeded.GET(req('/api/v2/staff/assignments/needed'), NO_PARAMS));
    expect(before.body.data.totalCount).toBe(1);
    expect(before.body.data.items[0]).toMatchObject({ courseKey: 'maths-premiere', household: { primaryContactName: 'Nadia Synthetic' } });

    await assignCoach(h.client, ctx, { coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' });
    const after = await json(await assignmentsNeeded.GET(req('/api/v2/staff/assignments/needed'), NO_PARAMS));
    expect(after.body.data.totalCount).toBe(0);
  });
});
