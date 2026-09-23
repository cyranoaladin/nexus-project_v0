/**
 * Native Core v2 conversation authorization context.
 *
 * This adapter deliberately stops at the shared conversation contract's
 * authorization boundary: actor/subject identity, current Core v2 enrollment,
 * canonical entitlement scopes and tier capabilities. It does not read the
 * legacy Student, Subject, Subscription or AriaConversation tables.
 */
import type { AriaCapabilities, CanonicalAriaEntitlementContext } from '@/lib/aria/kernel/entitlements';
import { isAriaCourseEntitled, resolveAriaCapabilities } from '@/lib/aria/kernel/entitlements';
import { isKnownAriaCourseKey } from '@/lib/aria/curriculum/catalog';
import { AriaError } from '@/lib/aria/kernel/errors';
import { listCoreV2AcademicallyRelevantCourseKeys } from './cockpit-profile';
import type { CoreV2AriaStudentContext } from './student-context';

export interface CoreV2AriaConversationAuthorization {
  readonly actor: { readonly userId: string; readonly role: 'ELEVE' };
  readonly subject: { readonly studentId: string; readonly userId: string };
  readonly courseKey: string;
  readonly capabilities: AriaCapabilities;
  readonly entitlementContext: CanonicalAriaEntitlementContext;
  readonly academicSnapshot: Readonly<Record<string, unknown>>;
}

export function buildCoreV2AriaConversationAuthorization(input: {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly student: CoreV2AriaStudentContext;
  readonly courseKey: string;
  readonly entitlementContext: CanonicalAriaEntitlementContext;
}): CoreV2AriaConversationAuthorization {
  if (input.actor.role !== 'ELEVE' || input.actor.userId !== input.student.userId) {
    throw new AriaError('NOT_ENROLLED', 403, 'Le contexte élève ARIA est invalide.');
  }
  if (!isKnownAriaCourseKey(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const academicallyRelevantCourseKeys = listCoreV2AcademicallyRelevantCourseKeys({
    gradeLevel: input.student.gradeLevel,
    academicTrack: input.student.academicTrack,
    stmgPathway: input.student.stmgPathway,
    specialties: input.student.specialties,
    school: input.student.school,
    academicEnrollments: input.student.academicEnrollments,
  });
  if (!academicallyRelevantCourseKeys.includes(input.courseKey)) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif.');
  }
  if (!isAriaCourseEntitled(input.entitlementContext, input.courseKey)) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours.');
  }
  const capabilities = resolveAriaCapabilities(input.entitlementContext.tier);
  if (!capabilities.chat) {
    throw new AriaError('UNSUPPORTED', 422, 'Le chat ARIA n’est pas disponible pour ce profil.');
  }

  return Object.freeze({
    actor: { userId: input.actor.userId, role: 'ELEVE' as const },
    subject: { studentId: input.student.studentId, userId: input.student.userId },
    courseKey: input.courseKey,
    capabilities,
    entitlementContext: input.entitlementContext,
    academicSnapshot: Object.freeze({
      gradeLevel: input.student.gradeLevel,
      academicTrack: input.student.academicTrack,
      stmgPathway: input.student.stmgPathway,
      schoolingStatus: input.student.schoolingStatus,
      academicEnrollments: input.student.academicEnrollments,
    }),
  });
}
