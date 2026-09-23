export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { loadCoreV2AriaStudentContext } from '@/lib/core-v2/aria/student-context';
import { getCoreV2AriaCockpitProfile, listCoreV2AcademicallyRelevantCourseKeys } from '@/lib/core-v2/aria/cockpit-profile';
import { resolveCoreV2AriaEntitlements } from '@/lib/core-v2/aria/access-grants';
import { resolveAriaCurriculum } from '@/lib/aria/curriculum/resolver';

export const GET = defineStaffRoute({
  handler: async ({ client, ctx }) => {
    const student = await loadCoreV2AriaStudentContext(client, ctx);
    const academicContext = { gradeLevel: student.gradeLevel, academicTrack: student.academicTrack, specialties: student.specialties, stmgPathway: student.stmgPathway, academicEnrollments: student.academicEnrollments };
    const [profile, entitlements] = await Promise.all([getCoreV2AriaCockpitProfile(client, student.studentId, academicContext), resolveCoreV2AriaEntitlements(client, student.studentId)]);
    const curriculum = resolveAriaCurriculum({ gradeLevel: student.gradeLevel, academicTrack: student.academicTrack, specialties: student.specialties, hasAcademicSpecialtyEnrollment: student.hasAcademicSpecialtyEnrollment, stmgPathway: student.stmgPathway, school: student.school, pinnedCourseKeys: profile.pinnedCourseKeys, enrollmentBackedCourseKeys: listCoreV2AcademicallyRelevantCourseKeys(academicContext), access: { kind: 'CANONICAL_BY_FEATURE', contexts: entitlements.byFeatureKey } });
    // The browser conversation client consumes the shared V1 preference
    // projection. The storage remains Core v2-native; this is only a
    // transport shape adapter, never a V1 persistence fallback.
    const clientProfile = {
      version: 1 as const,
      pinnedCourseKeys: profile.pinnedCourseKeys,
      focusedCourseKey: null,
      courseOrder: profile.pinnedCourseKeys,
      showCitations: true,
    };
    return { data: { courses: curriculum.courses.map((view) => ({ courseKey: view.course.key, label: view.course.label, capabilities: { hasChat: view.course.capabilities.chat && entitlements.capabilities.chat }, access: { status: view.access.commerciallyEntitled && view.access.productSupported && view.access.academicallyRelevant ? 'AVAILABLE' : 'LOCKED', commerciallyEntitled: view.access.commerciallyEntitled } })), profile: clientProfile } };
  },
});
