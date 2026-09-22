/**
 * ARIA Cockpit Profile — Core v2 native persistence.
 *
 * Same functional contract as the legacy `aria_cockpit_profiles` service
 * (`lib/aria/cockpit/profile-service.ts`): targetSession, pinnedCourseKeys,
 * weeklyGoalMinutes, learningGoals, preferences, curriculumVersion,
 * onboardingCompletedAt. Backed by `AriaCockpitProfileCoreV2`, FK'd to the
 * Core v2 `Student` — a cross-database FK into the legacy table is not
 * possible in Postgres, and a Core v2 identity is never given a synthetic
 * legacy Student row to get one. No dual write between the two stores.
 *
 * Reuses the legacy service's pure validation helpers
 * (`isKnownAriaCourseKey`, `listSelectableCourseKeys`, `isSupportedExamSession`)
 * — the catalogue and exam-session rules are identical for every identity;
 * only the persistence differs.
 */
import type { PrismaClient } from '@/core-v2/generated/client';
import {
  ARIA_CURRICULUM_VERSION,
  ARIA_WEEKLY_GOAL_DEFAULT_MINUTES,
  type AriaCockpitProfileDTO,
  type AriaLearningGoal,
  type AriaPreferencesDTO,
} from '@/lib/aria/cockpit/contracts';
import { isKnownAriaCourseKey } from '@/lib/aria/curriculum/catalog';
import { listSelectableCourseKeys } from '@/lib/aria/curriculum/resolver';
import { isSupportedExamSession } from '@/lib/aria/curriculum/exam-context';
import {
  AriaProfileValidationError,
  defaultAriaCockpitProfile,
  type AriaProfileAcademicContext,
  type AriaProfileUpdateInput,
} from '@/lib/aria/cockpit/profile-service';

export { defaultAriaCockpitProfile };

interface ProfileRow {
  targetSession: number | null;
  pinnedCourseKeys: string[];
  weeklyGoalMinutes: number;
  learningGoals: string[];
  preferences: unknown;
  curriculumVersion: string;
  onboardingCompletedAt: Date | null;
}

function toDTO(row: ProfileRow): AriaCockpitProfileDTO {
  return {
    targetSession: row.targetSession,
    pinnedCourseKeys: row.pinnedCourseKeys.filter((key) => isKnownAriaCourseKey(key)),
    weeklyGoalMinutes: row.weeklyGoalMinutes,
    learningGoals: row.learningGoals as readonly AriaLearningGoal[],
    preferences: (row.preferences && typeof row.preferences === 'object' ? row.preferences : {}) as AriaPreferencesDTO,
    curriculumVersion: row.curriculumVersion,
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString() ?? null,
  };
}

export async function getCoreV2AriaCockpitProfile(
  client: PrismaClient,
  studentId: string,
): Promise<AriaCockpitProfileDTO> {
  const row = await client.ariaCockpitProfileCoreV2.findUnique({
    where: { studentId },
    select: {
      targetSession: true,
      pinnedCourseKeys: true,
      weeklyGoalMinutes: true,
      learningGoals: true,
      preferences: true,
      curriculumVersion: true,
      onboardingCompletedAt: true,
    },
  });
  return row ? toDTO(row as ProfileRow) : defaultAriaCockpitProfile();
}

/** @throws {AriaProfileValidationError} if an input is inconsistent with the student's real schooling. */
export async function upsertCoreV2AriaCockpitProfile(
  client: PrismaClient,
  studentId: string,
  input: AriaProfileUpdateInput,
  academicContext: AriaProfileAcademicContext,
): Promise<AriaCockpitProfileDTO> {
  const issues: string[] = [];

  let pinnedCourseKeys: string[] | undefined;
  if (input.pinnedCourseKeys !== undefined) {
    const unique = [...new Set(input.pinnedCourseKeys)];
    const unknown = unique.filter((key) => !isKnownAriaCourseKey(key));
    if (unknown.length > 0) issues.push(`cours inconnus du catalogue: ${unknown.join(', ')}`);

    const selectable = new Set(
      listSelectableCourseKeys({
        gradeLevel: academicContext.gradeLevel,
        academicTrack: academicContext.academicTrack,
        specialties: academicContext.specialties,
        stmgPathway: academicContext.stmgPathway,
        school: null,
      }),
    );
    const notApplicable = unique.filter((key) => isKnownAriaCourseKey(key) && !selectable.has(key));
    if (notApplicable.length > 0) issues.push(`cours hors de la scolarité de l'élève: ${notApplicable.join(', ')}`);

    pinnedCourseKeys = unique;
  }

  let targetSession: number | null | undefined;
  if (input.targetSession !== undefined) {
    if (input.targetSession !== null && !isSupportedExamSession(input.targetSession)) {
      issues.push(`session d'examen non supportée: ${input.targetSession}`);
    }
    targetSession = input.targetSession;
  }

  if (issues.length > 0) throw new AriaProfileValidationError(issues);

  const now = new Date();
  const setOnboarding = input.completeOnboarding === true ? { onboardingCompletedAt: now } : {};

  const row = await client.ariaCockpitProfileCoreV2.upsert({
    where: { studentId },
    create: {
      studentId,
      targetSession: targetSession ?? null,
      pinnedCourseKeys: pinnedCourseKeys ?? [],
      weeklyGoalMinutes: input.weeklyGoalMinutes ?? ARIA_WEEKLY_GOAL_DEFAULT_MINUTES,
      learningGoals: input.learningGoals ?? [],
      preferences: input.preferences ?? {},
      curriculumVersion: ARIA_CURRICULUM_VERSION,
      ...setOnboarding,
    },
    update: {
      ...(targetSession !== undefined ? { targetSession } : {}),
      ...(pinnedCourseKeys !== undefined ? { pinnedCourseKeys } : {}),
      ...(input.weeklyGoalMinutes !== undefined ? { weeklyGoalMinutes: input.weeklyGoalMinutes } : {}),
      ...(input.learningGoals !== undefined ? { learningGoals: input.learningGoals } : {}),
      ...(input.preferences !== undefined ? { preferences: input.preferences } : {}),
      curriculumVersion: ARIA_CURRICULUM_VERSION,
      ...setOnboarding,
    },
    select: {
      targetSession: true,
      pinnedCourseKeys: true,
      weeklyGoalMinutes: true,
      learningGoals: true,
      preferences: true,
      curriculumVersion: true,
      onboardingCompletedAt: true,
    },
  });

  return toDTO(row as ProfileRow);
}
