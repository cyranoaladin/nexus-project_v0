import type {
  AcademicEnrollmentKind,
  AcademicEnrollmentSource,
  AcademicTrack,
  GradeLevel,
  StmgPathway,
} from '@prisma/client';
import { getCourse, isKnownCourseKey, type CourseRecord } from '@/lib/curriculum/catalog';
import {
  listStudentAcademicCourseKeys,
  resolveAriaCourseAccess,
  type AriaCourseAccess,
} from '../../access';
import { getCourseCapabilities } from '../../curriculum';
import { getSkill } from '../../curriculum/skill-graph';
import { getResource } from '../../resources';
import type { AriaCourseCapabilities, AriaCourseKey, AriaResource } from '../../contracts';
import { AriaError } from '../../errors';
import { resolveStoredAriaLearningPreferencesV1 } from '../../domain/profile/preferences';
import {
  resolveInteractiveStudentActor,
  resolveStudentSelfSubject,
  type AriaActor,
  type AriaSubject,
} from '../../kernel/actor-subject';
import {
  buildCanonicalAriaEntitlementContext,
  type CanonicalAriaEntitlementContext,
} from '../../kernel/entitlements';
import {
  loadAriaAuthorizationStudent,
  type AriaAuthorizationStudent,
  type StoredConversationContext,
} from './load-authorization-student';

const ariaConversationContextBrand: unique symbol = Symbol('AriaConversationContext');

export interface AriaConversationContext {
  readonly [ariaConversationContextBrand]: true;
  readonly actor: AriaActor;
  readonly subject: AriaSubject;
  readonly student: AriaAuthorizationStudent;
  readonly courseKey: AriaCourseKey;
  readonly course: CourseRecord;
  readonly skillId?: string;
  readonly resourceId?: string;
  readonly resourceVersionId?: string;
  readonly conversation: StoredConversationContext | null;
  readonly capabilities: AriaCourseCapabilities;
  readonly access: AriaCourseAccess;
  readonly entitlementContext: CanonicalAriaEntitlementContext;
}

export interface BuildAriaConversationContextInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly courseKey: string;
  readonly skillId?: string | null;
  readonly resourceId?: string | null;
  readonly conversationId?: string | null;
  readonly now?: Date;
}

const ALLOWED_INPUT_KEYS = new Set([
  'actor',
  'courseKey',
  'skillId',
  'resourceId',
  'conversationId',
  'now',
]);

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
}

function assertExactInput(input: BuildAriaConversationContextInput): void {
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key));
  if (unknown.length > 0) {
    throw new AriaError('BAD_REQUEST', 400, 'Contexte ARIA invalide.');
  }
}

export function assertAriaResourceAuthorization(
  resource: {
    readonly courseKey: string;
    readonly ownerStudentId?: string | null;
    readonly visibility?: 'PUBLIC' | 'STUDENT_PRIVATE' | 'COACH_VISIBLE' | 'PARENT_VISIBLE' | 'SYSTEM_ONLY';
  },
  courseKey: string,
  studentId: string,
): void {
  if (resource.courseKey !== courseKey
    || resource.visibility === 'SYSTEM_ONLY'
    || (resource.visibility === 'STUDENT_PRIVATE' && resource.ownerStudentId !== studentId)
    || (resource.ownerStudentId !== null
      && resource.ownerStudentId !== undefined
      && resource.ownerStudentId !== studentId)) {
    throw new AriaError('RESOURCE_MISMATCH', 400, 'La ressource ne correspond pas au contexte autorisé.');
  }
}

function validateSkillAndResource(
  courseKey: string,
  studentId: string,
  skillId: string | null | undefined,
  resourceId: string | null | undefined,
): AriaResource | null {
  if (skillId && !getSkill(courseKey, skillId)) {
    throw new AriaError('SKILL_MISMATCH', 400, 'La compétence ne correspond pas au cours demandé.');
  }
  if (resourceId) {
    const resource = getResource(resourceId);
    if (!resource) {
      throw new AriaError('RESOURCE_MISMATCH', 400, 'La ressource ne correspond pas au cours demandé.');
    }
    assertAriaResourceAuthorization(resource, courseKey, studentId);
    return resource;
  }
  return null;
}

export async function buildAriaConversationContext(
  input: BuildAriaConversationContextInput,
): Promise<AriaConversationContext> {
  assertExactInput(input);
  const actor = resolveInteractiveStudentActor(input.actor);
  if (!isKnownCourseKey(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const course = getCourse(input.courseKey) as CourseRecord;

  const student = await loadAriaAuthorizationStudent(actor, input.conversationId);
  const subject = resolveStudentSelfSubject(actor, student);
  const now = input.now ?? new Date();
  const entitlementContext = buildCanonicalAriaEntitlementContext(
    student.user.entitlements,
    now,
  );
  const preferences = resolveStoredAriaLearningPreferencesV1(
    student.ariaProfile,
    listStudentAcademicCourseKeys(student),
  );
  const access = resolveAriaCourseAccess({
    courseKey: input.courseKey,
    student,
    pinnedCourseKeys: preferences.pinnedCourseKeys,
    entitlements: entitlementContext,
  });
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif.');
  }
  const capabilities = getCourseCapabilities(input.courseKey);
  if (!capabilities.hasChat) {
    throw new AriaError('UNSUPPORTED', 422, 'Le chat ARIA n’est pas disponible pour ce cours.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours.');
  }

  const conversation = input.conversationId ? student.ariaConversations[0] ?? null : null;
  if (input.conversationId && !conversation) {
    throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation ARIA introuvable.');
  }
  if (conversation) {
    if (conversation.studentId !== student.id) {
      throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation ARIA introuvable.');
    }
    if (conversation.contextState !== 'ACTIVE' || conversation.courseKey !== input.courseKey) {
      throw new AriaError('CROSS_COURSE_MISMATCH', 409, 'La conversation appartient à un autre cours.');
    }
    validateSkillAndResource(input.courseKey, student.id, conversation.skillId, conversation.resourceId);
    if (input.skillId && input.skillId !== conversation.skillId) {
      throw new AriaError('SKILL_MISMATCH', 409, 'La compétence demandée diffère de la conversation.');
    }
    if (input.resourceId && input.resourceId !== conversation.resourceId) {
      throw new AriaError('RESOURCE_MISMATCH', 409, 'La ressource demandée diffère de la conversation.');
    }
  }

  const skillId = input.skillId ?? conversation?.skillId;
  const resourceId = input.resourceId ?? conversation?.resourceId;
  const resource = validateSkillAndResource(input.courseKey, student.id, skillId, resourceId);
  return deepFreeze({
    [ariaConversationContextBrand]: true as const,
    actor,
    subject,
    student,
    courseKey: input.courseKey,
    course,
    skillId: skillId ?? undefined,
    resourceId: resourceId ?? undefined,
    resourceVersionId: resource?.resourceVersionId,
    conversation,
    capabilities,
    access,
    entitlementContext,
  });
}

export type AriaAcademicIdentity = {
  readonly gradeLevel: GradeLevel;
  readonly academicTrack: AcademicTrack;
  readonly stmgPathway?: StmgPathway | null;
  readonly academicEnrollments?: readonly {
    readonly courseKey: string;
    readonly kind: AcademicEnrollmentKind;
    readonly source: AcademicEnrollmentSource;
  }[];
};
