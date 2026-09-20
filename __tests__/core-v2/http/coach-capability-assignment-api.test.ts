/**
 * Full HTTP-boundary proof that a refused assignment is refused BECAUSE of
 * the missing coach capability, and that granting it through the real
 * configuration route (not a direct table write) flips the same request to
 * a success — go-live mission §5: "le cas navigateur/API décrit comme «
 * couple invalide → 404 » reste un test de refus utile, mais ne suffit pas
 * à attribuer le refus à l'habilitation." Every step here is a real HTTP
 * call through the exported route modules (NextRequest in, NextResponse
 * out) — the service-level test in staff-indicators.test.ts proves the
 * same rule at the function boundary; this proves the ROUTE actually wires
 * to it, with real bodies, real status codes, and a real re-read.
 */
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { CORRELATION_HEADER } from '@/lib/core-v2/http/respond';
import { NO_PARAMS } from '@/lib/core-v2/http/staff-route';
import { approveEnrollment, createAnnualEnrollment, createHousehold, createStudent, setCourseEnrollments } from '@/lib/core-v2/services';
import { setupServiceHarness, seedAcademicYear, seedCoach } from '../helpers/service-harness';

import * as assignments from '@/app/api/v2/staff/assignments/route';
import * as coachCapabilities from '@/app/api/v2/staff/coaches/[id]/capabilities/route';
import * as coaches from '@/app/api/v2/staff/coaches/route';
import * as assignmentsNeeded from '@/app/api/v2/staff/assignments/needed/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;

function signInAs(user: { id: string; role: string }) {
  mockedAuth.mockResolvedValue({ user: { id: user.id, role: user.role, email: 'x@synthetic.test' }, expires: '2099-01-01' });
}

function req(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function json(response: Response) {
  return { status: response.status, body: await response.json(), correlationId: response.headers.get(CORRELATION_HEADER) };
}

beforeEach(() => {
  signInAs({ id: h.admin.userId, role: 'ADMIN' });
});

describe('assignment refusal is attributable to the missing capability, and granting it through the real route flips the same request to success', () => {
  test('A→F: refused without the capability, admitted after granting it through /staff/coaches/{id}/capabilities, never by touching the database directly', async () => {
    const { client } = h;
    const ctx = h.ctx();

    // A. Setup through the canonical services (not the thing under test): an
    // existing coach with NO capability, an ACTIVE enrollment with an
    // explicit course choice, no assignment yet.
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    const { coachId } = await seedCoach(client, 'coach-http-cap@synthetic.test');
    const { household } = await createHousehold(client, ctx, { parent: { firstName: 'Http', lastName: 'CapSynthetic', email: 'parent-http-cap@synthetic.test' } });
    const { student } = await createStudent(client, ctx, { householdId: household.id, student: { firstName: 'Eleve', lastName: 'HttpCap' } });
    const enrollment = await createAnnualEnrollment(client, ctx, { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' } });
    await approveEnrollment(client, ctx, enrollment.id);
    await setCourseEnrollments(client, ctx, { enrollmentId: enrollment.id, courses: [{ courseKey: 'maths-premiere', kind: 'SPECIALTY' }] });

    const coachBefore = await json(await coaches.GET(req('GET', '/api/v2/staff/coaches?limit=100'), NO_PARAMS));
    const coachRowBefore = coachBefore.body.data.items.find((c: { id: string }) => c.id === coachId);
    expect(coachRowBefore.capabilities).not.toContain('maths-premiere');

    // B/C. A real assignment request with valid, correct ids — refused, and the reason is INVALID_STATE (capability), not a 404/lookup failure.
    const refused = await json(
      await assignments.POST(req('POST', '/api/v2/staff/assignments', { coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' }), NO_PARAMS),
    );
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('INVALID_STATE');
    expect(refused.body.error.message).toMatch(/no capability/i);
    expect(await client.coachStudentCourseAssignment.count({ where: { coachId, academicYearEnrollmentId: enrollment.id, courseKey: 'maths-premiere' } })).toBe(0);

    // The indicator still reports this course as unassigned — the refusal left no trace of a partial write.
    const needed = await json(await assignmentsNeeded.GET(req('GET', '/api/v2/staff/assignments/needed'), NO_PARAMS));
    expect(needed.body.data.items.some((i: { enrollment: { id: string }; courseKey: string }) => i.enrollment.id === enrollment.id && i.courseKey === 'maths-premiere')).toBe(true);

    // D. Grant the capability through the real configuration route (the one
    // CoachCapabilitiesPanel calls) — never a direct `client.coachCourseCapability.create(...)`.
    const granted = await json(await coachCapabilities.PUT(req('PUT', '/x', { courseKey: 'maths-premiere', granted: true }), params(coachId)));
    expect(granted.status).toBe(200);

    // E. "Reload": re-read the coach through the same GET the panel uses, confirming the new value is now visible from a fresh read.
    const coachAfterGrant = await json(await coaches.GET(req('GET', '/api/v2/staff/coaches?limit=100'), NO_PARAMS));
    const coachRowAfterGrant = coachAfterGrant.body.data.items.find((c: { id: string }) => c.id === coachId);
    expect(coachRowAfterGrant.capabilities).toContain('maths-premiere');

    // F. The exact same assignment request, unchanged, now succeeds.
    const admitted = await json(
      await assignments.POST(req('POST', '/api/v2/staff/assignments', { coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' }), NO_PARAMS),
    );
    expect(admitted.status).toBe(201);
    expect(admitted.body.data.status).toBe('ACTIVE');
    expect(await client.coachStudentCourseAssignment.count({ where: { coachId, academicYearEnrollmentId: enrollment.id, courseKey: 'maths-premiere' } })).toBe(1);

    const neededAfter = await json(await assignmentsNeeded.GET(req('GET', '/api/v2/staff/assignments/needed'), NO_PARAMS));
    expect(neededAfter.body.data.items.some((i: { enrollment: { id: string }; courseKey: string }) => i.enrollment.id === enrollment.id && i.courseKey === 'maths-premiere')).toBe(false);
  });

  test('ASSISTANTE can grant the capability too (COACH_CAPABILITY_MANAGE is not ADMIN-only), and the refusal reason is unchanged for her', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    const { coachId } = await seedCoach(client, 'coach-http-cap-2@synthetic.test');
    const { household } = await createHousehold(client, ctx, { parent: { firstName: 'Http2', lastName: 'CapSynthetic', email: 'parent-http-cap-2@synthetic.test' } });
    const { student } = await createStudent(client, ctx, { householdId: household.id, student: { firstName: 'Eleve2', lastName: 'HttpCap' } });
    const enrollment = await createAnnualEnrollment(client, ctx, { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } });
    await approveEnrollment(client, ctx, enrollment.id);
    await setCourseEnrollments(client, ctx, { enrollmentId: enrollment.id, courses: [{ courseKey: 'anglais-seconde', kind: 'OPTION' }] });

    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const refused = await json(
      await assignments.POST(req('POST', '/api/v2/staff/assignments', { coachId, enrollmentId: enrollment.id, courseKey: 'anglais-seconde' }), NO_PARAMS),
    );
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('INVALID_STATE');

    const granted = await json(await coachCapabilities.PUT(req('PUT', '/x', { courseKey: 'anglais-seconde', granted: true }), params(coachId)));
    expect(granted.status).toBe(200);

    const admitted = await json(
      await assignments.POST(req('POST', '/api/v2/staff/assignments', { coachId, enrollmentId: enrollment.id, courseKey: 'anglais-seconde' }), NO_PARAMS),
    );
    expect(admitted.status).toBe(201);
  });
});
