import { listAriaCurriculumForActor } from '@/lib/aria/application/curriculum/public';
import { loadAriaAuthorizationStudent } from '@/lib/aria/application/conversation/load-authorization-student';

jest.mock('@/lib/aria/application/conversation/load-authorization-student', () => ({
  loadAriaAuthorizationStudent: jest.fn(),
}));

const now = new Date('2026-08-30T12:00:00.000Z');

function studentFixture(ariaProfile: Record<string, unknown> | null = null) {
  return {
    id: 'student-1',
    userId: 'student-user-1',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    academicEnrollments: [
      { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
      { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
    user: {
      entitlements: [{
        id: 'entitlement-global',
        productCode: 'ARIA_ACCESS',
        status: 'ACTIVE',
        startsAt: new Date('2026-08-01T00:00:00.000Z'),
        endsAt: new Date('2026-09-30T00:00:00.000Z'),
        ariaScopes: [{ kind: 'GLOBAL', courseKey: null }],
      }],
    },
    ariaConversations: [],
    ariaProfile,
  };
}

async function listCurriculum() {
  return listAriaCurriculumForActor({
    actor: { userId: 'student-user-1', role: 'ELEVE' },
    now,
  });
}

describe('ARIA curriculum canonical preference projection', () => {
  const loadStudent = loadAriaAuthorizationStudent as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('CURRICULUM_PROFILE_SHAPE_IS_CANONICAL_WITH_OR_WITHOUT_ROW', async () => {
    loadStudent.mockResolvedValueOnce(studentFixture());
    const withoutRow = await listCurriculum();
    expect(withoutRow.profile).toEqual({
      version: 1,
      pinnedCourseKeys: [],
      focusedCourseKey: null,
      courseOrder: [],
      showCitations: true,
    });
    expect(withoutRow.profile).not.toHaveProperty('preferencesVersion');

    loadStudent.mockResolvedValueOnce(studentFixture({
      preferencesVersion: 1,
      pinnedCourseKeys: ['eds-nsi-terminale'],
      focusedCourseKey: 'eds-nsi-terminale',
      courseOrder: ['eds-nsi-terminale'],
      showCitations: false,
    }));
    const withRow = await listCurriculum();
    expect(withRow.profile).toEqual({
      version: 1,
      pinnedCourseKeys: ['eds-nsi-terminale'],
      focusedCourseKey: 'eds-nsi-terminale',
      courseOrder: ['eds-nsi-terminale'],
      showCitations: false,
    });
    expect(withRow.profile).not.toHaveProperty('preferencesVersion');
  });

  it.each([
    { preferencesVersion: 2, pinnedCourseKeys: [], focusedCourseKey: null, courseOrder: [], showCitations: true },
    { preferencesVersion: 1, pinnedCourseKeys: ['eds-nsi-terminale', 7], focusedCourseKey: null, courseOrder: [], showCitations: true },
    { preferencesVersion: 1, pinnedCourseKeys: ['eds-nsi-terminale', 'eds-nsi-terminale'], focusedCourseKey: null, courseOrder: [], showCitations: true },
    { preferencesVersion: 1, pinnedCourseKeys: [], focusedCourseKey: null, courseOrder: [], showCitations: 'yes' },
  ])('CURRICULUM_CORRUPT_PREFERENCES_FAIL_CLOSED %#', async (ariaProfile) => {
    loadStudent.mockResolvedValueOnce(studentFixture(ariaProfile));
    await expect(listCurriculum()).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('CURRICULUM_STALE_PREFERENCES_FILTERED_WITHOUT_WRITE', async () => {
    const ariaProfile = {
      preferencesVersion: 1,
      pinnedCourseKeys: ['eds-nsi-terminale', 'eds-maths-premiere'],
      focusedCourseKey: 'eds-maths-premiere',
      courseOrder: ['eds-maths-premiere', 'tc-philosophie-terminale'],
      showCitations: true,
    };
    const before = JSON.parse(JSON.stringify(ariaProfile));
    loadStudent.mockResolvedValueOnce(studentFixture(ariaProfile));

    const result = await listCurriculum();

    expect(result.profile).toEqual({
      version: 1,
      pinnedCourseKeys: ['eds-nsi-terminale'],
      focusedCourseKey: null,
      courseOrder: ['tc-philosophie-terminale'],
      showCitations: true,
    });
    expect(ariaProfile).toEqual(before);
  });

  it('CURRICULUM_PARTIAL_ORDER_PRESERVES_ACADEMIC_REMAINDER', async () => {
    loadStudent.mockResolvedValueOnce(studentFixture({
      preferencesVersion: 1,
      pinnedCourseKeys: [],
      focusedCourseKey: null,
      courseOrder: ['eds-nsi-terminale', 'tc-philosophie-terminale'],
      showCitations: true,
    }));
    const ordered = await listCurriculum();

    expect(ordered.courses.slice(0, 2).map(({ courseKey }) => courseKey)).toEqual([
      'eds-nsi-terminale',
      'tc-philosophie-terminale',
    ]);

    loadStudent.mockResolvedValueOnce(studentFixture());
    const academicOrder = (await listCurriculum()).courses.map(({ courseKey }) => courseKey);
    const expectedRemainder = academicOrder.filter(
      (courseKey) => courseKey !== 'eds-nsi-terminale' && courseKey !== 'tc-philosophie-terminale',
    );
    expect(ordered.courses.slice(2).map(({ courseKey }) => courseKey)).toEqual(expectedRemainder);
  });

  it('CURRICULUM_PINS_DO_NOT_GATE_ACADEMIC_MAP', async () => {
    loadStudent.mockResolvedValueOnce(studentFixture({
      preferencesVersion: 1,
      pinnedCourseKeys: [],
      focusedCourseKey: null,
      courseOrder: [],
      showCitations: true,
    }));

    const result = await listCurriculum();
    expect(result.courses.map(({ courseKey }) => courseKey)).toEqual(expect.arrayContaining([
      'eds-maths-terminale',
      'eds-nsi-terminale',
      'tc-philosophie-terminale',
    ]));
    expect(result.courses.every(({ access }) => access.pinnedForAria === false)).toBe(true);
  });

  it('evaluates entitlements at the canonical boundary when no clock is supplied', async () => {
    loadStudent.mockResolvedValueOnce(studentFixture());
    await expect(listAriaCurriculumForActor({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
    })).resolves.toMatchObject({ profile: { version: 1 } });
  });
});
