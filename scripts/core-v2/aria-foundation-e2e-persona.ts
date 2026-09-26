import type { PrismaClient } from '@/core-v2/generated/client';
import { CORE_V2_ARIA_FOUNDATION_EMAIL } from '../e2e/aria-foundation-identity';

export { CORE_V2_ARIA_FOUNDATION_EMAIL };

/** Reset before every browser run so onboarding never depends on test order. */
export async function resetCoreV2AriaFoundationProfile(client: PrismaClient): Promise<void> {
  await client.$transaction(async (transaction) => {
    const identity = await transaction.user.findUnique({
      where: { email: CORE_V2_ARIA_FOUNDATION_EMAIL },
      select: { student: { select: { id: true } } },
    });
    if (!identity?.student) throw new Error('CORE_V2_ARIA_E2E_PERSONA_MISSING');

    await transaction.ariaCockpitProfileCoreV2.upsert({
      where: { studentId: identity.student.id },
      create: {
        studentId: identity.student.id,
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
}
