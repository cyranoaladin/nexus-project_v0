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
      chat: false,
      trajectory: false,
      assessments: false,
      resources: false,
      nextSession: false,
      conversationHistory: false,
    });
    // No grant yet: nothing commercially available, even though academically relevant.
    expect(cockpit.curriculum.availableCourseKeys).toEqual([]);
  });

  test('a global grant unlocks the enrolled matching-feature course without making an unenrolled option actionable', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    const admin = await h.client.user.create({ data: { role: 'ADMIN', email: 'admin-grant@synthetic.test', accountStatus: 'ACTIVE' } });
    await h.client.studentCourseEnrollment.create({
      data: {
        academicYearEnrollmentId: f.enrollment.id,
        courseKey: 'eds-nsi-terminale',
        kind: 'SPECIALTY',
      },
    });
    await grantCoreV2AriaAccess(h.client, { userId: admin.id, role: 'ADMIN' }, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
      source: 'qualification pilote',
    });

    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(200);
    expect(r.body.data.curriculum.availableCourseKeys).toContain('maths-terminale-eds');
    expect(r.body.data.curriculum.lockedCourseKeys).toContain('nsi-terminale-eds');
    expect(r.body.data.curriculum.availableCourseKeys).not.toContain('maths-complementaires-terminale');
    expect(r.body.data.curriculum.courses).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        course: expect.objectContaining({ key: 'maths-complementaires-terminale' }),
      }),
    ]));
  });

  test('an enrolled but unpinned option stays visible and locked without a grant', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    await h.client.studentCourseEnrollment.create({
      data: {
        academicYearEnrollmentId: f.enrollment.id,
        courseKey: 'opt-maths-complementaires-terminale',
        kind: 'OPTION',
      },
    });

    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(200);
    expect(r.body.data.curriculum.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        course: expect.objectContaining({ key: 'maths-complementaires-terminale' }),
        access: expect.objectContaining({
          academicallyRelevant: true,
          commerciallyEntitled: false,
          selectedForAria: false,
        }),
      }),
    ]));
    expect(r.body.data.curriculum.lockedCourseKeys).toContain(
      'maths-complementaires-terminale',
    );
  });

  test('a scoped grant never unlocks another academically relevant course of the same feature', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    const admin = await h.client.user.create({ data: { role: 'ADMIN', email: 'admin-scoped@synthetic.test', accountStatus: 'ACTIVE' } });
    await grantCoreV2AriaAccess(h.client, { userId: admin.id, role: 'ADMIN' }, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
      courseScopes: ['maths-terminale-eds'],
    });

    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(200);
    expect(r.body.data.curriculum.availableCourseKeys).toContain('maths-terminale-eds');
    expect(r.body.data.curriculum.lockedCourseKeys).toContain('philosophie-terminale');
  });

  test('two scoped grants of the same feature contribute their union', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    const admin = await h.client.user.create({ data: { role: 'ADMIN', email: 'admin-union@synthetic.test', accountStatus: 'ACTIVE' } });
    const actor = { userId: admin.id, role: 'ADMIN' } as const;
    await grantCoreV2AriaAccess(h.client, actor, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
      courseScopes: ['maths-terminale-eds'],
    });
    await grantCoreV2AriaAccess(h.client, actor, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
      courseScopes: ['philosophie-terminale'],
    });

    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(200);
    expect(r.body.data.curriculum.availableCourseKeys).toEqual(
      expect.arrayContaining(['maths-terminale-eds', 'philosophie-terminale']),
    );
    expect(r.body.data.curriculum.lockedCourseKeys).toContain('histoire-geo-terminale');
  });

  test('a scope carried by the wrong feature never unlocks the course', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    const admin = await h.client.user.create({ data: { role: 'ADMIN', email: 'admin-wrong-feature@synthetic.test', accountStatus: 'ACTIVE' } });
    await grantCoreV2AriaAccess(h.client, { userId: admin.id, role: 'ADMIN' }, {
      studentId: f.student.id,
      featureKey: 'aria_nsi',
      courseScopes: ['maths-terminale-eds'],
    });

    const r = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(r.status).toBe(200);
    expect(r.body.data.curriculum.lockedCourseKeys).toContain('maths-terminale-eds');
  });

  test('ARIA access tiers default to AUTONOMIE and persist every explicit Core v2 tier', async () => {
    const f = await seedCoreV2OnlyStudent();
    const admin = await h.client.user.create({ data: { role: 'ADMIN', email: 'admin-tiers@synthetic.test', accountStatus: 'ACTIVE' } });
    const actor = { userId: admin.id, role: 'ADMIN' } as const;

    const defaultGrant = await grantCoreV2AriaAccess(h.client, actor, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
      source: 'default-tier',
    });
    const autonomieGrant = await grantCoreV2AriaAccess(h.client, actor, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
      ariaTier: 'ARIA_AUTONOMIE',
      source: 'autonomie-tier',
    });
    const suiviGrant = await grantCoreV2AriaAccess(h.client, actor, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
      ariaTier: 'ARIA_SUIVI',
      source: 'suivi-tier',
    });
    const accompagneeGrant = await grantCoreV2AriaAccess(h.client, actor, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
      ariaTier: 'ARIA_ACCOMPAGNEE',
      source: 'accompagnee-tier',
    });

    expect(defaultGrant.ariaTier).toBe('ARIA_AUTONOMIE');
    expect(autonomieGrant.ariaTier).toBe('ARIA_AUTONOMIE');
    expect(suiviGrant.ariaTier).toBe('ARIA_SUIVI');
    expect(accompagneeGrant.ariaTier).toBe('ARIA_ACCOMPAGNEE');

    const persisted = await h.client.ariaAccessGrant.findMany({
      where: { id: { in: [defaultGrant.id, autonomieGrant.id, suiviGrant.id, accompagneeGrant.id] } },
      orderBy: { source: 'asc' },
      select: { source: true, ariaTier: true },
    });
    expect(persisted).toEqual([
      { source: 'accompagnee-tier', ariaTier: 'ARIA_ACCOMPAGNEE' },
      { source: 'autonomie-tier', ariaTier: 'ARIA_AUTONOMIE' },
      { source: 'default-tier', ariaTier: 'ARIA_AUTONOMIE' },
      { source: 'suivi-tier', ariaTier: 'ARIA_SUIVI' },
    ]);
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
  test('an actually enrolled specialty can be pinned and persists across reload', async () => {
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

  test('an enrolled non-Maths specialty with an exact canonical mapping can be pinned', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    await h.client.studentCourseEnrollment.create({
      data: {
        academicYearEnrollmentId: f.enrollment.id,
        courseKey: 'eds-physique-chimie-terminale',
        kind: 'SPECIALTY',
      },
    });

    const r = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', {
      pinnedCourseKeys: ['physique-chimie-terminale-eds'],
    });

    expect(r.status).toBe(200);
    expect(r.body.data.ariaProfile.pinnedCourseKeys).toEqual([
      'physique-chimie-terminale-eds',
    ]);
  });

  test('HGGSP stays fail-closed because the ARIA catalogue has no exact HGGSP identity', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    await h.client.studentCourseEnrollment.create({
      data: {
        academicYearEnrollmentId: f.enrollment.id,
        courseKey: 'eds-hggsp-terminale',
        kind: 'SPECIALTY',
      },
    });

    const r = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', {
      pinnedCourseKeys: ['histoire-geo-terminale-eds'],
    });

    expect(r.status).toBe(400);
  });

  test('pinning a course outside the student\'s real schooling is refused', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    // nsi-terminale-eds is academically real, but this student has no NSI enrollment.
    const r = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', { pinnedCourseKeys: ['nsi-terminale-eds'] });
    expect(r.status).toBe(400);
  });

  test('unenrolled maths expertes cannot be pinned even though the catalogue allows it for Terminale', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });

    const r = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', {
      pinnedCourseKeys: ['maths-expertes-terminale'],
    });

    expect(r.status).toBe(400);
  });

  test('unenrolled maths complémentaires cannot be pinned even though the catalogue allows it for Terminale', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });

    const r = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', {
      pinnedCourseKeys: ['maths-complementaires-terminale'],
    });

    expect(r.status).toBe(400);
  });

  test('an actually enrolled option can be pinned', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    await h.client.studentCourseEnrollment.create({
      data: {
        academicYearEnrollmentId: f.enrollment.id,
        courseKey: 'opt-maths-expertes-terminale',
        kind: 'OPTION',
      },
    });

    const r = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', {
      pinnedCourseKeys: ['maths-expertes-terminale'],
    });

    expect(r.status).toBe(200);
    expect(r.body.data.ariaProfile.pinnedCourseKeys).toEqual(['maths-expertes-terminale']);
  });

  test('a valid core course can be pinned without inventing a StudentCourseEnrollment', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });

    const r = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', {
      pinnedCourseKeys: ['philosophie-terminale'],
    });

    expect(r.status).toBe(200);
    expect(r.body.data.ariaProfile.pinnedCourseKeys).toEqual(['philosophie-terminale']);
  });

  test('a course from another grade cannot be pinned', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });

    const r = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', {
      pinnedCourseKeys: ['maths-premiere-eds'],
    });

    expect(r.status).toBe(400);
  });

  test('a pin becomes stale when its StudentCourseEnrollment is removed and is filtered from profile and cockpit reads', async () => {
    const f = await seedCoreV2OnlyStudent();
    signInAs({ id: f.user.id, role: 'ELEVE' });
    await grantCoreV2AriaAccess(h.client, h.admin, {
      studentId: f.student.id,
      featureKey: 'aria_maths',
    });
    const optionEnrollment = await h.client.studentCourseEnrollment.create({
      data: {
        academicYearEnrollmentId: f.enrollment.id,
        courseKey: 'opt-maths-expertes-terminale',
        kind: 'OPTION',
      },
    });
    const saved = await callPut(profileRoute, '/api/v2/aria/cockpit/profile', {
      pinnedCourseKeys: ['maths-expertes-terminale'],
      completeOnboarding: true,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.ariaProfile.pinnedCourseKeys).toEqual(['maths-expertes-terminale']);

    await h.client.studentCourseEnrollment.delete({ where: { id: optionEnrollment.id } });

    const profile = await callGet(profileRoute, '/api/v2/aria/cockpit/profile');
    expect(profile.status).toBe(200);
    expect(profile.body.data.ariaProfile.pinnedCourseKeys).toEqual([]);
    expect(profile.body.data.setupState).toBe('NO_COURSE_SELECTED');

    const cockpit = await callGet(cockpitRoute, '/api/v2/aria/cockpit');
    expect(cockpit.status).toBe(200);
    expect(cockpit.body.data.profile.pinnedCourseKeys).toEqual([]);
    expect(cockpit.body.data.curriculum.pinnedCourseKeys).toEqual([]);
    expect(cockpit.body.data.curriculum.availableCourseKeys).not.toContain('maths-expertes-terminale');
    expect(cockpit.body.data.curriculum.courses).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        course: expect.objectContaining({ key: 'maths-expertes-terminale' }),
      }),
    ]));
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
