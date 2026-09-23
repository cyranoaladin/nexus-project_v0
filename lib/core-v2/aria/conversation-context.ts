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
import type { PrismaClient } from '@/core-v2/generated/client';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import { loadCoreV2AriaStudentContext } from './student-context';
import { resolveCoreV2AriaEntitlements } from './access-grants';
import { getAriaCourse } from '@/lib/aria/curriculum/catalog';
import type { AriaConversationContext } from '@/lib/aria/application/conversation/build-context';

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

/**
 * Builds the narrow context consumed by the existing Conversation Foundation.
 * The cast at this boundary is deliberate: the engine only needs the shared
 * actor/subject/course/capability fields, while Core v2 keeps its native
 * student and entitlement records as the source of truth.
 */
export async function buildCoreV2AriaConversationContext(
  client: PrismaClient,
  ctx: ServiceContext,
  input: { readonly courseKey: string; readonly conversationId?: string; readonly skillId?: string },
): Promise<AriaConversationContext> {
  const student = await loadCoreV2AriaStudentContext(client, ctx);
  const entitlements = await resolveCoreV2AriaEntitlements(client, student.studentId, ctx.now());
  const authorization = buildCoreV2AriaConversationAuthorization({
    actor: { userId: ctx.actor.userId, role: ctx.actor.role },
    student,
    courseKey: input.courseKey,
    entitlementContext: entitlements.aggregate,
  });
  const course = getAriaCourse(input.courseKey);
  if (!course) throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');

  let conversation: { id: string; studentId: string; courseKey: string; skillId: string | null; resourceId: string | null; contextState: 'ACTIVE' } | null = null;
  if (input.conversationId) {
    const row = await client.ariaConversationCoreV2.findUnique({
      where: { id: input.conversationId },
      select: { id: true, studentId: true, courseKey: true, skillId: true, resourceId: true },
    });
    if (!row || row.studentId !== student.studentId) throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation ARIA introuvable.');
    if (row.courseKey !== input.courseKey) throw new AriaError('CROSS_COURSE_MISMATCH', 409, 'La conversation appartient à un autre cours.');
    if (input.skillId && input.skillId !== row.skillId) throw new AriaError('SKILL_MISMATCH', 409, 'La compétence demandée diffère de la conversation.');
    conversation = { ...row, contextState: 'ACTIVE' };
  }

  const compatibilityStudent = {
    id: student.studentId,
    gradeLevel: student.gradeLevel,
    academicTrack: student.academicTrack,
    stmgPathway: student.stmgPathway,
    academicEnrollments: student.academicEnrollments.map((enrollment) => ({ ...enrollment, source: 'CORE_V2' })),
  };
  const capabilities = {
    hasSkillGraph: Boolean(course.definitionKey),
    hasResources: course.support.capabilities.resources,
    hasRagCorpus: course.support.capabilities.rag,
    hasChat: authorization.capabilities.chat,
    hasAssessmentContext: false,
    chatPolicy: course.support.capabilities.rag ? 'GROUNDED_REQUIRED' : 'GENERAL_CHAT',
    generalChatAllowed: !course.support.capabilities.rag,
    skillGraphRef: course.definitionKey,
    resourceCount: 0,
  };
  return {
    actor: authorization.actor,
    subject: authorization.subject,
    student: compatibilityStudent,
    courseKey: input.courseKey,
    course,
    skillId: input.skillId ?? conversation?.skillId ?? undefined,
    resourceId: conversation?.resourceId ?? undefined,
    resourceVersionId: undefined,
    conversation,
    capabilities,
    access: { academicallyRelevant: true, commerciallyEntitled: true, productSupported: true, selectedForAria: true },
    entitlementContext: authorization.entitlementContext,
  } as unknown as AriaConversationContext;
}
