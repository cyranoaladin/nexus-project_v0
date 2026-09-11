/**
 * Core v2 staff API (§AD) against a real Core v2 database: the HTTP envelope,
 * session -> actor mapping, RBAC at the boundary, validation/conflict
 * mapping, the golden staff workflow through the routes, invitation delivery
 * (token never in a response), and the public activation endpoint.
 */
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/email/core-v2-invitation', () => ({
  deliverCoreV2Invitation: jest.fn(async () => ({ messageId: 'mocked' })),
}));

import { auth } from '@/auth';
import { deliverCoreV2Invitation } from '@/lib/email/core-v2-invitation';
import { disconnectCoreV2Client } from '@/lib/core-v2/client';
import { CORRELATION_HEADER } from '@/lib/core-v2/http/respond';
import { setupServiceHarness } from '../helpers/service-harness';
import { academicYearDates } from '../helpers/fixtures';

import * as academicYears from '@/app/api/v2/staff/academic-years/route';
import * as academicYearCurrent from '@/app/api/v2/staff/academic-years/[id]/current/route';
import * as households from '@/app/api/v2/staff/households/route';
import * as householdDetail from '@/app/api/v2/staff/households/[id]/route';
import * as householdParents from '@/app/api/v2/staff/households/[id]/parents/route';
import * as students from '@/app/api/v2/staff/students/route';
import * as enrollments from '@/app/api/v2/staff/enrollments/route';
import * as enrollmentApprove from '@/app/api/v2/staff/enrollments/[id]/approve/route';
import * as enrollmentCourses from '@/app/api/v2/staff/enrollments/[id]/courses/route';
import * as coachCapabilities from '@/app/api/v2/staff/coaches/[id]/capabilities/route';
import * as assignments from '@/app/api/v2/staff/assignments/route';
import * as planningSeries from '@/app/api/v2/staff/planning/series/route';
import * as accountInvite from '@/app/api/v2/staff/accounts/[id]/invite/route';
import * as accountSuspend from '@/app/api/v2/staff/accounts/[id]/suspend/route';
import * as duplicates from '@/app/api/v2/staff/duplicates/route';
import * as audit from '@/app/api/v2/staff/audit/route';
import * as activate from '@/app/api/v2/auth/activate/route';

// The public activation route is rate-limited; the Core v2 Jest project does
// not load jest.setup.js, so provide the in-memory backend explicitly (TEST_FIXTURE).
process.env.RATE_LIMIT_BACKEND ??= 'memory';
process.env.RATE_LIMIT_KEY_SECRET ??= 'change_me_rate_limit_key_secret_at_least_32_bytes';
process.env.RATE_LIMIT_KEY_NAMESPACE ??= 'core-v2-http-test';
process.env.RATE_LIMIT_TRUST_PROXY_HOPS ??= '1';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;
const mockedDeliver = deliverCoreV2Invitation as unknown as jest.Mock;

function signInAs(user: { id: string; role: string; email?: string } | null) {
  mockedAuth.mockResolvedValue(user ? { user: { id: user.id, role: user.role, email: user.email ?? 'x@synthetic.test' }, expires: '2099-01-01' } : null);
}

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function json(response: Response) {
  return { status: response.status, body: await response.json(), correlationId: response.headers.get(CORRELATION_HEADER) };
}

beforeEach(() => {
  mockedDeliver.mockClear();
  signInAs({ id: h.admin.userId, role: 'ADMIN', email: 'admin@synthetic.test' });
});

describe('boundary: authentication, actor mapping, RBAC, envelope', () => {
  test('no session → 401 with the envelope and a correlation id', async () => {
    signInAs(null);
    const r = await json(await households.GET(req('GET', '/api/v2/staff/households')));
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    expect(r.correlationId).toBeTruthy();
    expect(r.body.correlationId).toBe(r.correlationId);
  });

  test('a session whose user is not a Core v2 actor → 403 ACTOR_NOT_IN_CORE_V2 (no v1 fallback)', async () => {
    signInAs({ id: 'not-in-core-v2', role: 'ADMIN' });
    const r = await json(await households.GET(req('GET', '/api/v2/staff/households')));
    expect(r.status).toBe(403);
    expect(r.body.error.details).toMatchObject({ code: 'ACTOR_NOT_IN_CORE_V2' });
  });

  test('the Core v2 role is the authority, not the session claim: session says ADMIN, Core v2 says ASSISTANTE → AUDIT_READ refused', async () => {
    signInAs({ id: h.assistante.userId, role: 'ADMIN' });
    const r = await json(await audit.GET(req('GET', '/api/v2/staff/audit')));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
  });

  test('a suspended actor is refused even with a live session', async () => {
    await h.client.user.update({ where: { id: h.assistante.userId }, data: { accountStatus: 'SUSPENDED' } });
    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const r = await json(await households.GET(req('GET', '/api/v2/staff/households')));
    expect(r.status).toBe(403);
    expect(r.body.error.details).toMatchObject({ code: 'ACTOR_NOT_ACTIVE' });
  });

  test('invalid JSON → 400; schema violation → 400 with issues; a provided correlation id is echoed', async () => {
    const bad = await json(await households.POST(req('POST', '/api/v2/staff/households', undefined, { [CORRELATION_HEADER]: 'trace-1234567890' })));
    expect(bad.status).toBe(400);
    expect(bad.correlationId).toBe('trace-1234567890');
    const invalid = await json(await households.POST(req('POST', '/api/v2/staff/households', { parent: { firstName: 'A' } })));
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION');
    expect(invalid.body.error.details.issues.length).toBeGreaterThan(0);
  });

  test('Core v2 unconfigured → 503 CORE_V2_UNAVAILABLE, never a v1 fallback', async () => {
    const saved = process.env.CORE_V2_DATABASE_URL;
    await disconnectCoreV2Client();
    process.env.CORE_V2_DATABASE_URL = `postgresql://postgres:${'unused'}@127.0.0.1:1/does_not_exist`;
    try {
      const r = await json(await households.GET(req('GET', '/api/v2/staff/households')));
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe('CORE_V2_UNAVAILABLE');
    } finally {
      await disconnectCoreV2Client();
      process.env.CORE_V2_DATABASE_URL = saved;
    }
  });
});

describe('golden staff workflow through the HTTP surface', () => {
  test('year → household → parent → student → enrollment → approve → courses → coach → assignment → planning → invite → activate → suspend', async () => {
    const year = await json(await academicYears.POST(req('POST', '/api/v2/staff/academic-years', { startYear: 2026, ...academicYearDates(2026) })));
    expect(year.status).toBe(201);
    expect((await json(await academicYearCurrent.POST(req('POST', '/x'), params(year.body.data.id)))).body.data.status).toBe('CURRENT');

    const dup = await json(await duplicates.GET(req('GET', '/api/v2/staff/duplicates?email=Amel@Example.com&phone=%2B21620000001')));
    expect(dup.body.data).toEqual({ hardConflict: null, possibleMatches: [] });

    const created = await json(
      await households.POST(req('POST', '/api/v2/staff/households', { parent: { firstName: 'Amel', lastName: 'Synthetic', email: 'Amel@Example.com', phone: '+216 20 000 001' } })),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.parent).not.toHaveProperty('password');
    expect(created.body.data.parent).not.toHaveProperty('sessionVersion');
    expect(created.body.data.parent.email).toBe('amel@example.com');
    const householdId: string = created.body.data.household.id;
    const parentId: string = created.body.data.parent.id;

    const conflict = await json(
      await households.POST(req('POST', '/api/v2/staff/households', { parent: { firstName: 'B', lastName: 'C', email: 'AMEL@example.com' } })),
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('CONFLICT');

    const dupAfter = await json(await duplicates.GET(req('GET', '/api/v2/staff/duplicates?email=amel@example.com&firstName=amel&lastName=synthetic')));
    expect(dupAfter.body.data.hardConflict.id).toBe(parentId);
    expect(dupAfter.body.data.hardConflict).not.toHaveProperty('password');

    const second = await json(
      await householdParents.POST(req('POST', '/x', { parent: { firstName: 'Karim', lastName: 'Synthetic', email: 'karim@example.com' } }), params(householdId)),
    );
    expect(second.status).toBe(201);

    const student = await json(
      await students.POST(req('POST', '/api/v2/staff/students', { householdId, student: { firstName: 'Yasmine', lastName: 'Synthetic', birthDate: '2009-05-04' } })),
    );
    expect(student.status).toBe(201);
    const studentId: string = student.body.data.student.id;

    const enrollment = await json(
      await enrollments.POST(req('POST', '/api/v2/staff/enrollments', { studentId, academicYearId: year.body.data.id, academicMap: { gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' } })),
    );
    expect(enrollment.status).toBe(201);
    expect(enrollment.body.data.status).toBe('PENDING');
    const enrollmentId: string = enrollment.body.data.id;
    expect((await json(await enrollmentApprove.POST(req('POST', '/x'), params(enrollmentId)))).body.data.status).toBe('ACTIVE');
    expect((await json(await enrollmentApprove.POST(req('POST', '/x'), params(enrollmentId)))).status).toBe(409);

    const courses = await json(await enrollmentCourses.PUT(req('PUT', '/x', { courses: [{ courseKey: 'maths-premiere', kind: 'SPECIALTY' }] }), params(enrollmentId)));
    expect(courses.body.data.map((c: { courseKey: string }) => c.courseKey)).toEqual(['maths-premiere']);

    const coachUser = await h.client.user.create({ data: { role: 'COACH', email: 'coach@synthetic.test', accountStatus: 'ACTIVE', firstName: 'Coach' } });
    const coach = await h.client.coachProfile.create({ data: { userId: coachUser.id } });
    expect((await json(await coachCapabilities.PUT(req('PUT', '/x', { courseKey: 'maths-premiere', granted: true }), params(coach.id)))).status).toBe(200);
    const assignment = await json(await assignments.POST(req('POST', '/x', { coachId: coach.id, enrollmentId, courseKey: 'maths-premiere' })));
    expect(assignment.status).toBe(201);

    const series = await json(
      await planningSeries.POST(req('POST', '/x', { assignmentId: assignment.body.data.id, startDate: '2026-09-15', localStartTime: '18:00', localEndTime: '19:00', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', modality: 'ONLINE' })),
    );
    expect(series.status).toBe(201);
    expect(series.body.data.timezone).toBe(process.env.CORE_V2_ORGANIZATION_TIMEZONE);

    const detail = await json(await householdDetail.GET(req('GET', '/x'), params(householdId)));
    expect(detail.status).toBe(200);
    expect(detail.body.data.parents).toHaveLength(2);
    expect(detail.body.data.students[0].enrollments[0].assignments[0].planningSeries).toHaveLength(1);
    expect(JSON.stringify(detail.body)).not.toMatch(/"password"/);

    // Invitation: delivered through the outbox adapter, token absent from the API response.
    const invited = await json(await accountInvite.POST(req('POST', '/x'), params(parentId)));
    expect(invited.status).toBe(201);
    expect(JSON.stringify(invited.body)).not.toMatch(/rawToken|tokenHash/);
    expect(mockedDeliver).toHaveBeenCalledTimes(1);
    const delivery = mockedDeliver.mock.calls[0][0];
    expect(delivery).toMatchObject({ userId: parentId, role: 'PARENT', email: 'amel@example.com' });
    expect(delivery.rawToken.length).toBeGreaterThanOrEqual(40);

    // Public activation with that token, then replay refused, then login-ready account suspended by ADMIN.
    const activated = await json(await activate.POST(req('POST', '/api/v2/auth/activate', { token: delivery.rawToken, password: 'change_me_activation' })));
    expect(activated.status).toBe(200);
    expect(activated.body.data.user.accountStatus).toBe('ACTIVE');
    expect(activated.body.data.user).not.toHaveProperty('password');
    const replay = await json(await activate.POST(req('POST', '/api/v2/auth/activate', { token: delivery.rawToken, password: 'change_me_other' })));
    expect(replay.status).toBe(409);
    const unknown = await json(await activate.POST(req('POST', '/api/v2/auth/activate', { token: 'A'.repeat(43), password: 'change_me_other' })));
    expect([404, 409]).toContain(unknown.status);

    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE', email: 'assistante@synthetic.test' });
    expect((await json(await accountSuspend.POST(req('POST', '/x'), params(parentId)))).status).toBe(403);
    signInAs({ id: h.admin.userId, role: 'ADMIN', email: 'admin@synthetic.test' });
    expect((await json(await accountSuspend.POST(req('POST', '/x'), params(parentId)))).body.data.accountStatus).toBe('SUSPENDED');

    // Audit is readable by ADMIN, filterable, paginated, and carries the actor.
    const trail = await json(await audit.GET(req('GET', `/api/v2/staff/audit?subjectId=${parentId}&limit=2`)));
    expect(trail.status).toBe(200);
    expect(trail.body.data.items).toHaveLength(2);
    expect(trail.body.data.nextCursor).toBeTruthy();
    const page2 = await json(await audit.GET(req('GET', `/api/v2/staff/audit?subjectId=${parentId}&limit=2&cursor=${trail.body.data.nextCursor}`)));
    expect(page2.body.data.items.every((row: { subjectId: string }) => row.subjectId === parentId)).toBe(true);
  });

  test('search is server-side, paginated with a cursor, and matches name / email / normalized phone', async () => {
    for (let i = 0; i < 3; i += 1) {
      await households.POST(req('POST', '/x', { parent: { firstName: `Nour${i}`, lastName: 'Searchable', email: `nour${i}@example.com`, phone: `+216 2${i} 111 111` } }));
    }
    const page1 = await json(await households.GET(req('GET', '/api/v2/staff/households?q=searchable&limit=2')));
    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.nextCursor).toBeTruthy();
    const page2 = await json(await households.GET(req('GET', `/api/v2/staff/households?q=searchable&limit=2&cursor=${page1.body.data.nextCursor}`)));
    expect(page2.body.data.items).toHaveLength(1);
    expect(page2.body.data.nextCursor).toBeNull();
    const byPhone = await json(await households.GET(req('GET', '/api/v2/staff/households?q=%2B216%2021%20111%20111')));
    expect(byPhone.body.data.items).toHaveLength(1);
    expect(byPhone.body.data.items[0].parents[0].email).toBe('nour1@example.com');
    const tooBig = await json(await households.GET(req('GET', '/api/v2/staff/households?limit=1000')));
    expect(tooBig.status).toBe(400);
  });
});
