/**
 * Shared parent->child resolution (P6): every ARIA parent-facing read path
 * (Mastery, course list, and any future one) must authorize through this
 * same function — never re-implement the "does this parent really own this
 * student" check inline. Extracted from list-course-mastery-for-parent.ts
 * (P6a) once a second real consumer (P6b's course list) needed the exact
 * same loader.
 */
import { prisma } from '@/lib/prisma';
import type { StudentWithEnrollments } from '../../access';
import type { AriaEntitlementRecord } from '../../kernel/entitlements';
import { AriaError } from '../../kernel/errors';

export interface ChildForParentView extends StudentWithEnrollments {
  readonly parent: { readonly userId: string };
  readonly user: { readonly entitlements: readonly AriaEntitlementRecord[] };
}

export async function loadChildForParent(
  parentUserId: string,
  studentId: string,
): Promise<ChildForParentView> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      gradeLevel: true,
      academicTrack: true,
      stmgPathway: true,
      schoolingStatus: true,
      academicEnrollments: {
        select: { courseKey: true, kind: true, source: true },
      },
      parent: { select: { userId: true } },
      user: {
        select: {
          entitlements: {
            select: {
              id: true,
              productCode: true,
              status: true,
              startsAt: true,
              endsAt: true,
              ariaTier: true,
              ariaScopes: { select: { kind: true, courseKey: true } },
            },
          },
        },
      },
    },
  });
  // Same shape whether the student doesn't exist or belongs to a
  // different parent — never reveal which, to a requester who isn't the
  // real linked parent.
  if (!student || student.parent.userId !== parentUserId) {
    throw new AriaError('NOT_ENROLLED', 403, 'Profil élève introuvable ou non rattaché à ce compte parent.');
  }
  return student as ChildForParentView;
}
