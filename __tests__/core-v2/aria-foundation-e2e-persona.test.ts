import { resetCoreV2AriaFoundationProfile } from '@/scripts/core-v2/aria-foundation-e2e-persona';

describe('Core v2 ARIA E2E persona reset', () => {
  it('transactionally restores an empty onboarding profile for repeatable browser runs', async () => {
    const transactionClient = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ student: { id: 'student-core-v2-aria' } }),
      },
      ariaCockpitProfileCoreV2: {
        upsert: jest.fn().mockResolvedValue({ id: 'profile-core-v2-aria' }),
      },
    };
    const client = {
      $transaction: jest.fn(async (operation: (tx: typeof transactionClient) => Promise<void>) =>
        operation(transactionClient)),
    };

    await resetCoreV2AriaFoundationProfile(client as never);

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'core-v2-aria-foundation@example.test' },
      select: { student: { select: { id: true } } },
    });
    expect(transactionClient.ariaCockpitProfileCoreV2.upsert).toHaveBeenCalledWith({
      where: { studentId: 'student-core-v2-aria' },
      create: {
        studentId: 'student-core-v2-aria',
        pinnedCourseKeys: [],
        weeklyGoalMinutes: 180,
        learningGoals: [],
        preferences: {},
        onboardingCompletedAt: null,
      },
      update: {
        targetSession: null,
        pinnedCourseKeys: [],
        weeklyGoalMinutes: 180,
        learningGoals: [],
        preferences: {},
        onboardingCompletedAt: null,
      },
    });
  });
});
