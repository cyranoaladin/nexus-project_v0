/**
 * Real ARIA collective workshops for a parent's real, linked child (P7d)
 * — same three-gate check `list-course-mastery-for-parent.ts` (P6a)
 * already inlines for itself (real child ownership, academic relevance,
 * commercial entitlement), re-derived from the CHILD's own data, plus the
 * `collectiveWorkshop` tier capability. A separate inlined copy rather
 * than importing practice/authorize's actor-side authorize.ts (that one
 * is ELEVE-only by construction) — mirrors the parent module's own
 * established pattern of a dedicated, non-widened authorization path per
 * actor kind.
 */
import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { prisma } from '@/lib/prisma';
import { resolveAriaCourseAccess } from '../../access';
import { AriaError } from '../../errors';
import { buildCanonicalAriaEntitlementContext, resolveAriaCapabilities } from '../../kernel/entitlements';
import { resolveInteractiveParentActor } from '../../kernel/parent-subject';
import { loadChildForParent } from '../parent/load-child-for-parent';

export interface AriaWorkshopForParent {
  readonly id: string;
  readonly title: string;
  readonly scheduledDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly location: string | null;
  readonly childAttendanceStatus: 'REGISTERED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED';
}

export async function listAriaWorkshopsForParent(input: {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly studentId: string;
  readonly courseKey: string;
}): Promise<readonly AriaWorkshopForParent[]> {
  const actor = resolveInteractiveParentActor(input.actor);

  if (!isKnownCourseKey(input.courseKey) || !getCourse(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }

  const student = await loadChildForParent(actor.userId, input.studentId);

  const entitlements = buildCanonicalAriaEntitlementContext(student.user.entitlements, new Date());
  const access = resolveAriaCourseAccess({ courseKey: input.courseKey, student, entitlements });
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif de cet élève.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours pour cet élève.');
  }
  // A real, entitled child whose tier simply doesn't include collective
  // workshops gets a real empty list here, not a thrown error — same
  // reasoning as list-workshops-for-student.ts's identical branch: this
  // is a browse path the parent card mounts unconditionally for every
  // real course, and AUTONOMIE is the common case, not a misuse.
  if (!resolveAriaCapabilities(entitlements.tier).collectiveWorkshop) {
    return Object.freeze([]);
  }

  // Only workshops the child is real real registered/attended for — a
  // parent report never shows a workshop the child never joined, unlike
  // the student's own "browse and register" view.
  const attendances = await prisma.ariaWorkshopAttendee.findMany({
    where: { studentId: student.id, session: { courseKey: input.courseKey } },
    orderBy: { session: { scheduledDate: 'asc' } },
    include: { session: { select: { id: true, title: true, scheduledDate: true, startTime: true, endTime: true, location: true } } },
  });

  return Object.freeze(
    attendances.map((attendance) => ({
      id: attendance.session.id,
      title: attendance.session.title,
      scheduledDate: attendance.session.scheduledDate,
      startTime: attendance.session.startTime,
      endTime: attendance.session.endTime,
      location: attendance.session.location,
      childAttendanceStatus: attendance.status,
    })),
  );
}
