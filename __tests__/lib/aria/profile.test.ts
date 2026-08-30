import {
  DEFAULT_ARIA_LEARNING_PREFERENCES_V1,
  parseAriaLearningPreferencesV1,
  projectStoredAriaLearningPreferencesV1,
} from '@/lib/aria/domain/profile/preferences';
import {
  makeGetAriaLearningProfile,
  makeReplaceAriaLearningProfile,
} from '@/lib/aria/application/profile/public';

describe('ARIA versioned learning preferences', () => {
  const academicCourseKeys = [
    'eds-maths-terminale',
    'eds-nsi-terminale',
    'tc-philosophie-terminale',
  ] as const;

  it('defines non-gating defaults without inventing selected courses', () => {
    expect(DEFAULT_ARIA_LEARNING_PREFERENCES_V1).toEqual({
      version: 1,
      pinnedCourseKeys: [],
      focusedCourseKey: null,
      courseOrder: [],
      showCitations: true,
    });
  });

  it('accepts a complete strict V1 replacement and partial course order', () => {
    expect(parseAriaLearningPreferencesV1({
      version: 1,
      pinnedCourseKeys: ['eds-nsi-terminale'],
      focusedCourseKey: 'eds-maths-terminale',
      courseOrder: ['tc-philosophie-terminale', 'eds-maths-terminale'],
      showCitations: false,
    }, academicCourseKeys)).toEqual({
      version: 1,
      pinnedCourseKeys: ['eds-nsi-terminale'],
      focusedCourseKey: 'eds-maths-terminale',
      courseOrder: ['tc-philosophie-terminale', 'eds-maths-terminale'],
      showCitations: false,
    });
  });

  it.each([
    {
      version: 1,
      pinnedCourseKeys: ['eds-maths-terminale', 'eds-maths-terminale'],
      focusedCourseKey: null,
      courseOrder: [],
      showCitations: true,
    },
    {
      version: 1,
      pinnedCourseKeys: [],
      focusedCourseKey: null,
      courseOrder: ['eds-nsi-terminale', 'eds-nsi-terminale'],
      showCitations: true,
    },
    {
      version: 1,
      pinnedCourseKeys: ['eds-maths-premiere'],
      focusedCourseKey: null,
      courseOrder: [],
      showCitations: true,
    },
    {
      version: 1,
      pinnedCourseKeys: [],
      focusedCourseKey: 'eds-maths-premiere',
      courseOrder: [],
      showCitations: true,
    },
  ])('rejects duplicates and courses outside the current Academic Map %#', (preferences) => {
    expect(() => parseAriaLearningPreferencesV1(preferences, academicCourseKeys)).toThrow();
  });

  it('filters stale stored course preferences at read time without rewriting storage', () => {
    expect(projectStoredAriaLearningPreferencesV1({
      preferencesVersion: 1,
      pinnedCourseKeys: ['eds-maths-terminale', 'eds-maths-premiere'],
      focusedCourseKey: 'eds-maths-premiere',
      courseOrder: ['eds-maths-premiere', 'eds-nsi-terminale'],
      showCitations: true,
    }, academicCourseKeys)).toEqual({
      version: 1,
      pinnedCourseKeys: ['eds-maths-terminale'],
      focusedCourseKey: null,
      courseOrder: ['eds-nsi-terminale'],
      showCitations: true,
    });
  });
});

describe('ARIA learning profile application use case', () => {
  const repository = {
    loadByActorUserId: jest.fn(),
    createDefault: jest.fn(),
    replacePreferences: jest.fn(),
  };
  const getProfile = makeGetAriaLearningProfile(repository);
  const replaceProfile = makeReplaceAriaLearningProfile(repository);
  const context = {
    studentId: 'student-1',
    academicCourseKeys: ['eds-maths-terminale', 'eds-nsi-terminale'],
    profile: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates only neutral preferences when the profile is absent', async () => {
    repository.loadByActorUserId.mockResolvedValueOnce(context);
    repository.createDefault.mockResolvedValueOnce({
      studentId: 'student-1',
      preferencesVersion: 1,
      pinnedCourseKeys: [],
      focusedCourseKey: null,
      courseOrder: [],
      showCitations: true,
      updatedAt: new Date('2026-08-30T18:00:00.000Z'),
    });

    await expect(getProfile({
      actor: { userId: 'user-1', role: 'ELEVE' },
    })).resolves.toMatchObject({
      studentId: 'student-1',
      preferences: DEFAULT_ARIA_LEARNING_PREFERENCES_V1,
    });
    expect(repository.createDefault).toHaveBeenCalledWith('student-1');
  });

  it('replaces all V1 fields and never passes selectedCourseKeys to persistence', async () => {
    repository.loadByActorUserId.mockResolvedValueOnce(context);
    repository.replacePreferences.mockResolvedValueOnce({
      studentId: 'student-1',
      preferencesVersion: 1,
      pinnedCourseKeys: ['eds-nsi-terminale'],
      focusedCourseKey: 'eds-nsi-terminale',
      courseOrder: ['eds-nsi-terminale'],
      showCitations: false,
      updatedAt: new Date('2026-08-30T18:01:00.000Z'),
    });

    const preferences = {
      version: 1 as const,
      pinnedCourseKeys: ['eds-nsi-terminale'],
      focusedCourseKey: 'eds-nsi-terminale',
      courseOrder: ['eds-nsi-terminale'],
      showCitations: false,
    };
    const result = await replaceProfile({
      actor: { userId: 'user-1', role: 'ELEVE' },
      preferences,
    });

    expect(result.preferences).toEqual(preferences);
    expect(repository.replacePreferences).toHaveBeenCalledWith('student-1', preferences);
    expect(repository.replacePreferences.mock.calls[0][1]).not.toHaveProperty('selectedCourseKeys');
  });

  it('rejects a missing student profile without creating settings', async () => {
    repository.loadByActorUserId.mockResolvedValueOnce(null);
    await expect(getProfile({
      actor: { userId: 'user-1', role: 'ELEVE' },
    })).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
    expect(repository.createDefault).not.toHaveBeenCalled();
  });
});
