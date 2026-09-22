/**
 * GET /api/v2/aria/cockpit — ARIA cockpit for a Core v2 identity.
 *
 * The CORE_V2 counterpart of the legacy `/api/aria/cockpit`. Never reads
 * the legacy database, never falls back to it — `defineStaffRoute` refuses
 * with 503 if the Core v2 client isn't configured, never a legacy detour.
 * Self-service only: the student is resolved from the authenticated
 * actor's own Core v2 identity (`assertSelfServiceRole` inside
 * `getOwnStudent`), never from a client-supplied id.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { loadCoreV2AriaStudentContext } from '@/lib/core-v2/aria/student-context';
import { getCoreV2AriaCockpitProfile } from '@/lib/core-v2/aria/cockpit-profile';
import { resolveCoreV2AriaEntitlements } from '@/lib/core-v2/aria/access-grants';
import { resolveAriaCurriculum } from '@/lib/aria/curriculum/resolver';
import { buildAriaExamContext } from '@/lib/aria/curriculum/exam-context';
import { getCockpitSkillGraph } from '@/lib/aria/cockpit/skill-views';
import type { AriaCockpitDTO, AriaSetupDTO, AriaSetupState } from '@/lib/aria/cockpit/contracts';

function buildSetup(
  onboardingCompletedAt: string | null,
  academicIncomplete: boolean,
  missingAcademicFields: readonly string[],
  selectedCount: number,
): AriaSetupDTO {
  let state: AriaSetupState;
  if (academicIncomplete) state = 'ACADEMIC_PROFILE_INCOMPLETE';
  else if (!onboardingCompletedAt) state = 'ONBOARDING_REQUIRED';
  else if (selectedCount === 0) state = 'NO_COURSE_SELECTED';
  else state = 'READY';

  return {
    state,
    onboardingCompleted: onboardingCompletedAt !== null,
    academicProfileIncomplete: academicIncomplete,
    missingAcademicFields,
    academicProfileReadOnly: true,
  };
}

export const GET = defineStaffRoute({
  handler: async ({ client, ctx }) => {
    const student = await loadCoreV2AriaStudentContext(client, ctx);
    const [profile, entitlements] = await Promise.all([
      getCoreV2AriaCockpitProfile(client, student.studentId),
      resolveCoreV2AriaEntitlements(client, student.studentId),
    ]);

    const curriculum = resolveAriaCurriculum({
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties: student.specialties,
      stmgPathway: student.stmgPathway,
      school: student.school,
      pinnedCourseKeys: profile.pinnedCourseKeys,
      entitlements: entitlements.features,
    });

    const setup = buildSetup(
      profile.onboardingCompletedAt,
      curriculum.academicProfile.incomplete,
      curriculum.academicProfile.missingFields,
      curriculum.pinnedCourseKeys.length,
    );

    const cockpit: AriaCockpitDTO = {
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        gradeLevel: student.gradeLevel,
        academicTrack: student.academicTrack,
      },
      setup,
      profile,
      curriculum,
      // No Core v2 source yet for the roadmap/"today" feed (legacy trajectory-derived) — honest empty, not fabricated.
      today: { items: [], weeklyGoalMinutes: profile.weeklyGoalMinutes, plannedMinutes: null },
      trajectory: null,
      resources: [],
      assessments: [],
      aria: { totalConversations: 0, messagesToday: 0, canUseAriaMaths: false, canUseAriaNsi: false },
      nextSession: null,
      examContext: buildAriaExamContext(profile.targetSession),
      capabilities: {
        trajectory: false,
        assessments: false,
        resources: false,
        nextSession: false,
        conversationHistory: false,
      },
      skillGraphs: curriculum.courses
        .filter((view) => view.course.hasSkillGraph)
        .map((view) => getCockpitSkillGraph(view.course.key))
        .filter((graph): graph is NonNullable<typeof graph> => graph !== null),
    };

    return { data: cockpit };
  },
});
