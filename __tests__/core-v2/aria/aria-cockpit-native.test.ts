/**
 * PR B — TDD for the Core v2-native ARIA surface (/api/v2/aria/**).
 * Reproduces the exact preview incident (a Core v2-only ELEVE, no legacy
 * User/Student row at all) and proves: 200, correct identity/curriculum,
 * persistent profile, real entitlement gating via AriaAccessGrant (never
 * "Student exists = authorized"), no cross-student leak, fail-closed on a
 * missing student. This module never imports the legacy database, so "no
 * V1 fallback" is structural, not just behavioral.
 */
import { NextRequest } from 'next/server';
import { setupServiceHarness, seedAcademicYear } from '../helpers/service-harness';
import { NO_PARAMS } from '@/lib/core-v2/http/staff-route';
import * as cockpitRoute from '@/app/api/v2/aria/cockpit/route';
import * as profileRoute from '@/app/api/v2/aria/cockpit/profile/route';
import { grantCoreV2AriaAccess, revokeCoreV2AriaAccess } from '@/lib/core-v2/aria/access-grants';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
import { auth } from '@/auth';
const mockedAuth = auth as unknown as jest.Mock;

const h = setupServiceHarness();

function signInAs(user: { id: string; role: string } | null) {
  mockedAuth.mockResolvedValue(user ? { user: { id: user.id, role: user.role, email: 'x@synthetic.test' }, expires: '2099-01-01' } : null);
}

async function callGet(route: { GET: (req: NextRequest, ctx: typeof NO_PARAMS) => Promise<Response> }, path: string) {
  const request = new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: { origin: 'http://localhost:3000' } });
  const response = await route.GET(request, NO_PARAMS);
  return { status: response.status, body: await response.json() };
}

async function callPut(route: { PUT: (req: NextRequest, ctx: typeof NO_PARAMS) => Promise<Response> }, path: string, payload: unknown) {
  const request = new NextRequest(`http://localhost:3000${path}`, {
    method: 'PUT',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const response = await route.PUT(request, NO_PARAMS);
  return { status: response.status, body: await response.json() };
}

async function seedCoreV2OnlyStudent(overrides: {
  email?: string;
  year?: Awaited<ReturnType<typeof seedAcademicYear>>;
  firstName?: string;
  gradeLevel?: 'PREMIERE' | 'TERMINALE';
} = {}) {
  const year = overrides.year ?? (await seedAcademicYear(h.client, 2026, 'CURRENT'));
  const gradeLevel = overrides.gradeLevel ?? 'TERMINALE';
  const user = await h.client.user.create({
    data: {
      role: 'ELEVE',
      email: overrides.email ?? 'lea.corev2only@synthetic.test',
      firstName: overrides.firstName ?? 'Léa',
      lastName: 'Synthetic',
      accountStatus: 'ACTIVE',
    },
  });
  const household = await h.client.household.create({ data: {} });
  const student = await h.client.student.create({ data: { userId: user.id, householdId: household.id } });
  const enrollment = await h.client.studentAcademicYearEnrollment.create({
    data: { studentId: student.id, academicYearId: year.id, status: 'ACTIVE', gradeLevel, academicTrack: 'EDS_GENERALE' },
  });
  const courseKey = gradeLevel === 'TERMINALE' ? 'eds-maths-terminale' : 'eds-maths-premiere';
  await h.client.studentCourseEnrollment.create({
    data: { academicYearEnrollmentId: enrollment.id, courseKey, kind: 'SPECIALTY' },
  });
  return { year, user, household, student, enrollment };
}

describe('GET /api/v2/aria/cockpit — Core v2-only identity', () => {
  test('200, real identity and curriculum, honest unavailable capabilities, locked courses (no grant)', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(200);
    const cockpit = r.body.data;
    expect(cockpit.student.firstName).toBe('Léa');
    expect(cockpit.student.gradeLevel).toBe('TERMINALE');
    expect(cockpit.curriculum.academicProfile.specialties).toEqual(['MATHEMATIQUES']);
    expect(cockpit.capabilities).toEqual({
      trajectory: false,
      assessments: false,
      resources: false,
      nextSession: false,
      conversationHistory: false,
    });
    // No grant yet: nothing commercially available, even though academically relevant.
    expect(cockpit.curriculum.availableCourseKeys).toEqual([]);
  });

  test('a valid AriaAccessGrant makes the matching feature available', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    const admin = await h.client.user.create({ data: { role: 'ADMIN', email: 'admin-grant@synthetic.test', accountStatus: 'ACTIVE' } });
    await grantCoreV2AriaAccess(h.client, { userId: admin.id, role: 'ADMIN' }, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
      source: 'qualification pilote',
    });

    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(200);
    expect(r.body.data.curriculum.availableCourseKeys.length).toBeGreaterThan(0);
  });

  test('a revoked grant no longer authorizes', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    const admin = await h.client.user.create({ data: { role: 'ADMIN', email: 'admin-revoke@synthetic.test', accountStatus: 'ACTIVE' } });
    const grant = await grantCoreV2AriaAccess(h.client, { userId: admin.id, role: 'ADMIN' }, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
    });
    await revokeCoreV2AriaAccess(h.client, { userId: admin.id, role: 'ADMIN' }, grant.id);

    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.body.data.curriculum.availableCourseKeys).toEqual([]);
  });

  test('a non-ADMIN cannot grant access', async () => {
    const f = await seedCoreV2OnlyStudent();
    const assistante = await h.client.user.create({ data: { role: 'ASSISTANTE', email: 'assistante-grant@synthetic.test', accountStatus: 'ACTIVE' } });
    await expect(
      grantCoreV2AriaAccess(h.client, { userId: assistante.id, role: 'ASSISTANTE' }, { studentId: f.student.id, featureKey: 'aria_maths' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('no Core v2 student -> 404, never a generic 500', async () => {
    const orphan = await h.client.user.create({ data: { role: 'ELEVE', email: 'orphan-cockpit-v2@synthetic.test', accountStatus: 'ACTIVE' } });
    signInAs({ id: orphan.id, role: 'ELEVE' });
    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
  });

  test('another student is never returned — the actor is always self, never a client-supplied id', async () => {
    const a = await seedCoreV2OnlyStudent({ email: 'a@synthetic.test', firstName: 'Amel', gradeLevel: 'TERMINALE' });
    const b = await seedCoreV2OnlyStudent({ year: a.year, email: 'b@synthetic.test', firstName: 'Bilel', gradeLevel: 'PREMIERE' });
    signInAs({ id: a.user.id, role: 'ELEVE' });
    const r = await callGet(cockpitRoute, `/api/v2/aria/cockpit?studentId=${b.student.id}`);
    expect(r.body.data.student.firstName).toBe('Amel');
    expect(r.body.data.student.gradeLevel).toBe('TERMINALE');
  });

  test('wrong role (ASSISTANTE) is refused', async () => {
    const staff = await h.client.user.create({ data: { role: 'ASSISTANTE', email: 'staff-cockpit@synthetic.test', accountStatus: 'ACTIVE' } });
    signInAs({ id: staff.id, role: 'ASSISTANTE' });
    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(403);
  });

  test('anonymous is refused', async () => {
    signInAs(null);
    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(401);
  });
});

describe('GET/PUT /api/v2/aria/cockpit/profile — Core v2-only identity', () => {
  test('default profile, update persists across reload, pinning validated against real schooling', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });

    const initial = await callGet(profileRoute, '/api/v2/aria/cockpit/profile');
    expect(initial.body.data.ariaProfile.onboardingCompletedAt).toBeNull();

    const update = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', {
      pinnedCourseKeys: ['maths-terminale-eds'],
      weeklyGoalMinutes: 240,
      completeOnboarding: true,
    });
    expect(update.status).toBe(200);
    expect(update.body.data.ariaProfile.pinnedCourseKeys).toEqual(['maths-terminale-eds']);
    expect(update.body.data.ariaProfile.onboardingCompletedAt).not.toBeNull();

    const reread = await callGet(profileRoute, '/api/v2/aria/cockpit/profile');
    expect(reread.body.data.ariaProfile.pinnedCourseKeys).toEqual(['maths-terminale-eds']);
    expect(reread.body.data.ariaProfile.onboardingCompletedAt).not.toBeNull();
  });

  test('pinning a course outside the student\'s real schooling is refused', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    // nsi-terminale-eds is academically real, but this student has no NSI enrollment.
    const r = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', { pinnedCourseKeys: ['nsi-terminale-eds'] });
    expect(r.status).toBe(400);
  });

  test('another Core v2 student cannot read or overwrite this profile', async () => {
    const a = await seedCoreV2OnlyStudent({ email: 'profile-a@synthetic.test' });
    signInAs({ id: a.user.id, role: 'ELEVE' });
    await callPut(profileRoute, '/api/v2/aria/cockpit/profile', { weeklyGoalMinutes: 300 });

    const b = await seedCoreV2OnlyStudent({ year: a.year, email: 'profile-b@synthetic.test' });
    signInAs({ id: b.user.id, role: 'ELEVE' });
    const r = await callGet(profileRoute, '/api/v2/aria/cockpit/profile');
    expect(r.body.data.ariaProfile.weeklyGoalMinutes).toBe(180);
  });
});
