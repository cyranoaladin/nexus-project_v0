/**
 * `lib/aria/cockpit/profile-service.ts` — real internals exercised (parsing,
 * validation, partial-update payload assembly); only the Prisma boundary is
 * mocked.
 */

import { prisma } from '@/lib/prisma';
import {
  getAriaCockpitProfile,
  upsertAriaCockpitProfile,
  type AriaProfileAcademicContext,
} from '@/lib/aria/cockpit/profile-service';

jest.mock('@/lib/prisma', () => ({
  prisma: { ariaCockpitProfile: { findUnique: jest.fn(), upsert: jest.fn() } },
}));

function row(overrides: Record<string, unknown> = {}) {
  return {
    targetSession: null,
    pinnedCourseKeys: ['maths-terminale-eds'],
    weeklyGoalMinutes: 180,
    learningGoals: ['PREPARER_BAC'],
    preferences: {},
    curriculumVersion: 'v1',
    onboardingCompletedAt: null,
    ...overrides,
  };
}

const ACADEMIC_CONTEXT: AriaProfileAcademicContext = {
  gradeLevel: 'TERMINALE',
  academicTrack: 'EDS_GENERALE',
  specialties: ['MATHEMATIQUES', 'NSI'],
  stmgPathway: null,
};

describe('getAriaCockpitProfile — parsing (lines 114, 131)', () => {
  it('drops unknown/malformed course keys and non-array learningGoals rather than throwing', async () => {
    (prisma.ariaCockpitProfile.findUnique as jest.Mock).mockResolvedValue(
      row({
        pinnedCourseKeys: ['maths-terminale-eds', 'not-a-real-course-key'],
        learningGoals: 'not-an-array' as unknown as string[],
      }),
    );
    const profile = await getAriaCockpitProfile('student-1');
    expect(profile.pinnedCourseKeys).toEqual(['maths-terminale-eds']);
    expect(profile.learningGoals).toEqual([]);
  });

  it('ignores invalid entries and de-duplicates valid ones in a mixed learningGoals array', async () => {
    (prisma.ariaCockpitProfile.findUnique as jest.Mock).mockResolvedValue(
      row({
        learningGoals: [
          'PREPARER_BAC',
          'PREPARER_BAC', // duplicate — exercises the !out.includes(...) branch
          123, // wrong type
          'NOT_A_REAL_GOAL', // not in ARIA_LEARNING_GOALS
        ] as unknown as string[],
      }),
    );
    const profile = await getAriaCockpitProfile('student-1');
    expect(profile.learningGoals).toEqual(['PREPARER_BAC']);
  });
});

describe('upsertAriaCockpitProfile — partial update payload (lines 272, 277, 278)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.ariaCockpitProfile.upsert as jest.Mock).mockResolvedValue(row());
  });

  it('includes targetSession, learningGoals and preferences in the update payload when provided', async () => {
    await upsertAriaCockpitProfile(
      'student-1',
      { targetSession: 2027, learningGoals: ['PREPARER_BAC'], preferences: { defaultPanel: 'TODAY' } },
      ACADEMIC_CONTEXT,
    );
    const call = (prisma.ariaCockpitProfile.upsert as jest.Mock).mock.calls[0]![0];
    expect(call.update.targetSession).toBe(2027);
    expect(call.update.learningGoals).toEqual(['PREPARER_BAC']);
    expect(call.update.preferences).toEqual({ defaultPanel: 'TODAY' });
  });

  it('omits targetSession, learningGoals and preferences from the update payload when not provided', async () => {
    await upsertAriaCockpitProfile('student-1', { weeklyGoalMinutes: 210 }, ACADEMIC_CONTEXT);
    const call = (prisma.ariaCockpitProfile.upsert as jest.Mock).mock.calls[0]![0];
    expect('targetSession' in call.update).toBe(false);
    expect('learningGoals' in call.update).toBe(false);
    expect('preferences' in call.update).toBe(false);
    expect(call.update.weeklyGoalMinutes).toBe(210);
  });
});
