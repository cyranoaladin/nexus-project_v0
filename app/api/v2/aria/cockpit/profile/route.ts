/**
 * GET/PUT /api/v2/aria/cockpit/profile — ARIA cockpit onboarding profile
 * for a Core v2 identity. CORE_V2 counterpart of the legacy
 * `/api/aria/cockpit/profile`. Same validation rules (course must be
 * known + academically applicable, exam session must be supported),
 * applied against the Core v2 academic context — never the legacy one.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { loadCoreV2AriaStudentContext } from '@/lib/core-v2/aria/student-context';
import { getCoreV2AriaCockpitProfile, upsertCoreV2AriaCockpitProfile } from '@/lib/core-v2/aria/cockpit-profile';
import { buildAcademicProfile } from '@/lib/aria/curriculum/resolver';
import { AriaProfileValidationError, ariaProfileUpdateSchema } from '@/lib/aria/cockpit/profile-service';
import type { AriaSetupState } from '@/lib/aria/cockpit/contracts';
import { ValidationError } from '@/lib/core-v2/errors';

function deriveSetupState(
  academicIncomplete: boolean,
  onboardingCompletedAt: string | null,
  selectedCount: number,
): AriaSetupState {
  if (academicIncomplete) return 'ACADEMIC_PROFILE_INCOMPLETE';
  if (!onboardingCompletedAt) return 'ONBOARDING_REQUIRED';
  if (selectedCount === 0) return 'NO_COURSE_SELECTED';
  return 'READY';
}

export const GET = defineStaffRoute({
  handler: async ({ client, ctx }) => {
    const student = await loadCoreV2AriaStudentContext(client, ctx);
    const ariaProfile = await getCoreV2AriaCockpitProfile(client, student.studentId, {
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties: student.specialties,
      stmgPathway: student.stmgPathway,
      academicEnrollments: student.academicEnrollments,
    });
    const academicProfile = buildAcademicProfile({
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties: student.specialties,
      hasAcademicSpecialtyEnrollment: student.hasAcademicSpecialtyEnrollment,
      stmgPathway: student.stmgPathway,
      school: student.school,
    });

    return {
      data: {
        academicProfile,
        ariaProfile,
        setupState: deriveSetupState(
          academicProfile.incomplete,
          ariaProfile.onboardingCompletedAt,
          ariaProfile.pinnedCourseKeys.length,
        ),
        academicProfileReadOnly: true,
      },
    };
  },
});

export const PUT = defineStaffRoute({
  body: ariaProfileUpdateSchema as unknown as z.ZodTypeAny,
  handler: async ({ client, ctx, body }) => {
    const student = await loadCoreV2AriaStudentContext(client, ctx);
    let ariaProfile;
    try {
      ariaProfile = await upsertCoreV2AriaCockpitProfile(client, student.studentId, body, {
        gradeLevel: student.gradeLevel,
        academicTrack: student.academicTrack,
        specialties: student.specialties,
        stmgPathway: student.stmgPathway,
        academicEnrollments: student.academicEnrollments,
      });
    } catch (caught) {
      // Translated to a CoreV2DomainError so `defineStaffRoute`'s uniform
      // error envelope maps it to 400 — a bare AriaProfileValidationError
      // (shared with the legacy route) would otherwise fall through to a
      // generic 500. Same fixed, generic message as the legacy route:
      // never echo `caught.issues` to the client.
      if (caught instanceof AriaProfileValidationError) {
        throw new ValidationError('Préférences ARIA invalides (cours, objectif hebdomadaire ou parcours choisis).');
      }
      throw caught;
    }
    const academicProfile = buildAcademicProfile({
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties: student.specialties,
      hasAcademicSpecialtyEnrollment: student.hasAcademicSpecialtyEnrollment,
      stmgPathway: student.stmgPathway,
      school: student.school,
    });

    return {
      data: {
        academicProfile,
        ariaProfile,
        setupState: deriveSetupState(
          academicProfile.incomplete,
          ariaProfile.onboardingCompletedAt,
          ariaProfile.pinnedCourseKeys.length,
        ),
        academicProfileReadOnly: true,
      },
    };
  },
});
