import { isKnownCourseKey } from '@/lib/curriculum/catalog';
import { AriaError } from '../../errors';
import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';
import { prismaAriaHistoryRepository } from '../../infrastructure/prisma/history-repository';

export async function listAriaConversations(input: Readonly<{
  actor: { readonly userId: string; readonly role: string };
  courseKey?: string;
  contextState: 'ACTIVE' | 'LEGACY_CONTEXT_UNRESOLVED';
  cursor?: string;
  limit: number;
}>) {
  const actor = resolveInteractiveStudentActor(input.actor);
  if (input.contextState === 'ACTIVE') {
    if (!input.courseKey || !isKnownCourseKey(input.courseKey)) {
      throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
    }
  } else if (input.courseKey !== undefined) {
    throw new AriaError('BAD_REQUEST', 400, 'Un historique non résolu ne peut pas recevoir de cours.');
  }
  return prismaAriaHistoryRepository.listConversations({
    actorUserId: actor.userId,
    courseKey: input.courseKey,
    contextState: input.contextState,
    cursor: input.cursor,
    limit: input.limit,
  });
}

export async function listAriaConversationMessages(input: Readonly<{
  actor: { readonly userId: string; readonly role: string };
  conversationId: string;
  cursor?: string;
  limit: number;
}>) {
  const actor = resolveInteractiveStudentActor(input.actor);
  if (!input.conversationId) throw new AriaError('BAD_REQUEST', 400, 'Conversation ARIA requise.');
  return prismaAriaHistoryRepository.listMessages({
    actorUserId: actor.userId,
    conversationId: input.conversationId,
    cursor: input.cursor,
    limit: input.limit,
  });
}
