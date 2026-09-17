/**
 * Self-service reads for students (§AI) and coaches (§AJ) against a real
 * Core v2 database: each actor reads exactly their own rows; nothing on these
 * paths takes an id; other roles are refused at the boundary; payloads carry
 * no secret and no other family's data.
 */
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { NO_PARAMS } from '@/lib/core-v2/http/staff-route';
import { setupServiceHarness, seedAcademicYear, seedCoach } from '../helpers/service-harness';
import * as studentMe from '@/app/api/v2/student/me/route';
import * as coachMe from '@/app/api/v2/coach/me/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;

function signInAs(user: { id: string; role: string } | null) {
  mockedAuth.mockResolvedValue(user ? { user: { id: user.id, role: user.role, email: 'x@synthetic.test' }, expires: '2099-01-01' } : null);
}

async function call(route: { GET: typeof studentMe.GET }, path: string) {
  const request = new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: { origin: 'http://localhost:3000' } });
  const response = await route.GET(request, NO_PARAMS);
  return { status: response.status, body: await response.json() };
}

async function seedFamilyWithTwoStudents() {
  const year = await seedAcademicYear(h.client, 2026);
  const parent = await h.client.user.create({ data: { role: 'PARENT', email: 'family@synthetic.test', firstName: 'Amel', lastName: 'Synthetic', accountStatus: 'ACTIVE' } });
  const household = await h.client.household.create({ data: { parents: { create: { userId: parent.id, isPrimaryContact: true } } } });
  const mk = async (first: string, grade: 'PREMIERE' | 'TERMINALE') => {
    const user = await h.client.user.create({ data: { role: 'ELEVE', firstName: first, lastName: 'Synthetic', accountStatus: 'ACTIVE', email: `${first.toLowerCase()}@synthetic.test`, password: 'change_me_hash' } });
    const student = await h.client.student.create({ data: { userId: user.id, householdId: household.id } });
    const enrollment = await h.client.studentAcademicYearEnrollment.create({
      data: { studentId: student.id, academicYearId: year.id, status: 'ACTIVE', gradeLevel: grade, academicTrack: 'EDS_GENERALE' },
    });
    return { user, student, enrollment };
  };
  return { year, parent, household, yasmine: await mk('Yasmine', 'PREMIERE'), ziad: await mk('Ziad', 'TERMINALE') };
}

describe('GET /api/v2/student/me', () => {
  test('a student reads their own enrollments only — the sibling in the same household is absent', async () => {
    const f = await seedFamilyWithTwoStudents();
    signInAs({ id: f.yasmine.user.id, role: 'ELEVE' });
    const r = await call(studentMe, '/api/v2/student/me');
    expect(r.status).toBe(200);
    expect(r.body.data.id).toBe(f.yasmine.student.id);
    expect(r.body.data.enrollments).toHaveLength(1);
    expect(r.body.data.enrollments[0]).toMatchObject({ gradeLevel: 'PREMIERE', status: 'ACTIVE', academicYear: { startYear: 2026 } });
    expect(r.body.data.parents.map((p: { firstName: string }) => p.firstName)).toEqual(['Amel']);
    const text = JSON.stringify(r.body);
    expect(text).not.toMatch(/Ziad|TERMINALE|"password"|sessionVersion|family@synthetic\.test/);
  });

  test('an id in the query string changes nothing; an ELEVE without a student row → 404; a PARENT → 403; anonymous → 401', async () => {
    const f = await seedFamilyWithTwoStudents();
    signInAs({ id: f.yasmine.user.id, role: 'ELEVE' });
    const forged = await call(studentMe, `/api/v2/student/me?id=${f.ziad.student.id}&studentId=${f.ziad.student.id}`);
    expect(forged.body.data.id).toBe(f.yasmine.student.id);

    const orphan = await h.client.user.create({ data: { role: 'ELEVE', email: 'orphan@synthetic.test', accountStatus: 'ACTIVE' } });
    signInAs({ id: orphan.id, role: 'ELEVE' });
    expect((await call(studentMe, '/api/v2/student/me')).status).toBe(404);

    signInAs({ id: f.parent.id, role: 'ELEVE' }); // session lies; Core v2 says PARENT
    const parent = await call(studentMe, '/api/v2/student/me');
    expect(parent.status).toBe(403);
    expect(parent.body.error.code).toBe('FORBIDDEN');

    signInAs(null);
    expect((await call(studentMe, '/api/v2/student/me')).status).toBe(401);
  });
});

describe('GET /api/v2/coach/me', () => {
  test('a coach reads their capabilities and their own assignments — another coach’s assignment on the same student is absent', async () => {
    const f = await seedFamilyWithTwoStudents();
    const mine = await seedCoach(h.client, 'coach-mine@synthetic.test');
    const other = await seedCoach(h.client, 'coach-other@synthetic.test');
    await h.client.coachCourseCapability.create({ data: { coachId: mine.coachId, courseKey: 'maths-premiere' } });
    const assignment = await h.client.coachStudentCourseAssignment.create({
      data: { coachId: mine.coachId, academicYearEnrollmentId: f.yasmine.enrollment.id, courseKey: 'maths-premiere' },
    });
    await h.client.planningSeries.create({
      data: { assignmentId: assignment.id, createdById: h.admin.userId, startDate: new Date('2026-09-15'), localStartTime: '18:00', localEndTime: '19:00', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', timezone: 'Africa/Tunis', modality: 'ONLINE' },
    });
    await h.client.coachStudentCourseAssignment.create({
      data: { coachId: other.coachId, academicYearEnrollmentId: f.yasmine.enrollment.id, courseKey: 'physique-premiere' },
    });

    signInAs({ id: mine.user.id, role: 'COACH' });
    const r = await call(coachMe, '/api/v2/coach/me');
    expect(r.status).toBe(200);
    expect(r.body.data.capabilities).toEqual(['maths-premiere']);
    expect(r.body.data.assignments).toHaveLength(1);
    expect(r.body.data.assignments[0]).toMatchObject({
      courseKey: 'maths-premiere',
      status: 'ACTIVE',
      student: { user: { firstName: 'Yasmine' } },
      enrollment: { gradeLevel: 'PREMIERE', academicYear: { startYear: 2026 } },
    });
    expect(r.body.data.assignments[0].planningSeries[0]).toMatchObject({ recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', localStartTime: '18:00' });
    const text = JSON.stringify(r.body);
    // No other coach's work, no family contact data, no secret.
    expect(text).not.toMatch(/physique-premiere|coach-other|family@synthetic\.test|yasmine@synthetic\.test|"password"|sessionVersion/);
  });

  test('a COACH without a profile → 404; an ELEVE → 403; the staff role is not enough either', async () => {
    const f = await seedFamilyWithTwoStudents();
    const noProfile = await h.client.user.create({ data: { role: 'COACH', email: 'no-profile@synthetic.test', accountStatus: 'ACTIVE' } });
    signInAs({ id: noProfile.id, role: 'COACH' });
    expect((await call(coachMe, '/api/v2/coach/me')).status).toBe(404);

    signInAs({ id: f.yasmine.user.id, role: 'COACH' });
    expect((await call(coachMe, '/api/v2/coach/me')).status).toBe(403);

    signInAs({ id: h.admin.userId, role: 'ADMIN' });
    expect((await call(coachMe, '/api/v2/coach/me')).status).toBe(403);
  });
});
