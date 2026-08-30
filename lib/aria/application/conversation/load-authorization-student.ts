import { prisma } from '@/lib/prisma';
import type { AriaActor } from '../../kernel/actor-subject';
import type { AriaEntitlementRecord } from '../../kernel/entitlements';
import type { StudentWithEnrollments } from '../../access';
import { AriaError } from '../../errors';

export interface StoredConversationContext {
  readonly id: string;
  readonly studentId: string;
  readonly courseKey: string | null;
  readonly contextState: 'ACTIVE' | 'LEGACY_CONTEXT_UNRESOLVED';
  readonly skillId: string | null;
  readonly resourceId: string | null;
}

export interface AriaAuthorizationStudent extends StudentWithEnrollments {
  readonly userId: string;
  readonly user: { readonly entitlements: readonly AriaEntitlementRecord[] };
  readonly ariaConversations: readonly StoredConversationContext[];
  readonly ariaProfile?: {
    readonly pinnedCourseKeys: unknown;
    readonly focusedCourseKey: string | null;
    readonly courseOrder: unknown;
    readonly showCitations: boolean;
  } | null;
}

export async function loadAriaAuthorizationStudent(
  actor: AriaActor,
  conversationId?: string | null,
): Promise<AriaAuthorizationStudent> {
  const student = await prisma.student.findUnique({
    where: { userId: actor.userId },
    select: {
      id: true,
      userId: true,
      gradeLevel: true,
      academicTrack: true,
      stmgPathway: true,
      academicEnrollments: {
        select: { courseKey: true, kind: true, source: true },
      },
      user: {
        select: {
          entitlements: {
            select: {
              id: true,
              productCode: true,
              status: true,
              startsAt: true,
              endsAt: true,
              ariaScopes: { select: { kind: true, courseKey: true } },
            },
          },
        },
      },
      ariaConversations: {
        where: { id: conversationId ?? '__NO_CONVERSATION_REQUESTED__' },
        select: {
          id: true,
          studentId: true,
          courseKey: true,
          contextState: true,
          skillId: true,
          resourceId: true,
        },
        take: 1,
      },
      ariaProfile: {
        select: {
          pinnedCourseKeys: true,
          focusedCourseKey: true,
          courseOrder: true,
          showCitations: true,
        },
      },
    },
  });
  if (!student || !student.gradeLevel || !student.academicTrack) {
    throw new AriaError('NOT_ENROLLED', 404, 'Profil scolaire élève incomplet ou introuvable.');
  }
  return student as AriaAuthorizationStudent;
}
