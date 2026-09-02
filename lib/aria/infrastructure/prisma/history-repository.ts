import {
  AriaConversationTurnStatus,
  AriaConversationTurnUseCase,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AriaError } from '../../errors';
import type {
  AriaConversationHistoryMessage,
  AriaHistoryRepository,
} from '../../application/history/ports';
import { decodeAriaPageCursor, encodeAriaPageCursor } from '../../transport/cursor';
import {
  ARIA_PEDAGOGICAL_MODES,
  type AriaPedagogicalMode,
} from '../../domain/pedagogy/pedagogical-mode';
import { projectPersistedAriaHistoryCitation } from './persisted-citation';

async function requireStudentId(actorUserId: string): Promise<string> {
  const student = await prisma.student.findUnique({
    where: { userId: actorUserId },
    select: { id: true },
  });
  if (!student) throw new AriaError('NOT_ENROLLED', 403, 'Profil élève ARIA introuvable.');
  return student.id;
}

function assertMessageRole(role: string): 'user' | 'assistant' | 'system' {
  if (role === 'user' || role === 'assistant' || role === 'system') return role;
  throw new AriaError('INTERNAL_ERROR', 500, 'Rôle de message ARIA invalide.');
}

function assertMessageStatus(
  status: string,
): 'PENDING' | 'STREAMING' | 'COMPLETED' | 'CANCELLED' | 'ERROR' {
  if (
    status === 'PENDING'
    || status === 'STREAMING'
    || status === 'COMPLETED'
    || status === 'CANCELLED'
    || status === 'ERROR'
  ) return status;
  throw new AriaError('INTERNAL_ERROR', 500, 'Statut de message ARIA invalide.');
}

function assertActiveTurnStatus(status: AriaConversationTurnStatus): 'PENDING' | 'RUNNING' {
  if (status === AriaConversationTurnStatus.PENDING || status === AriaConversationTurnStatus.RUNNING) {
    return status;
  }
  throw new AriaError('INTERNAL_ERROR', 500, 'Statut de Turn ARIA actif invalide.');
}

function assertPedagogicalMode(mode: string): AriaPedagogicalMode {
  if (ARIA_PEDAGOGICAL_MODES.some((candidate) => candidate === mode)) {
    return mode as AriaPedagogicalMode;
  }
  throw new AriaError('INTERNAL_ERROR', 500, 'Mode pédagogique ARIA actif invalide.');
}

class PrismaAriaHistoryRepository implements AriaHistoryRepository {
  async listConversations(input: Parameters<AriaHistoryRepository['listConversations']>[0]) {
    const studentId = await requireStudentId(input.actorUserId);
    const cursor = decodeAriaPageCursor('CONVERSATIONS', input.cursor);
    const rows = await prisma.ariaConversation.findMany({
      where: {
        studentId,
        contextState: input.contextState,
        ...(input.contextState === 'ACTIVE' ? { courseKey: input.courseKey } : { courseKey: null }),
        ...(cursor ? {
          OR: [
            { updatedAt: { lt: cursor.timestamp } },
            { updatedAt: cursor.timestamp, id: { lt: cursor.id } },
          ],
        } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      select: {
        id: true, courseKey: true, contextState: true, title: true,
        createdAt: true, updatedAt: true,
      },
    });
    const hasMore = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    const tail = page[page.length - 1];
    return {
      conversations: page.map((conversation) => ({
        id: conversation.id,
        courseKey: conversation.courseKey,
        contextState: conversation.contextState,
        resumable: conversation.contextState === 'ACTIVE' && conversation.courseKey !== null,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      })),
      nextCursor: hasMore && tail
        ? encodeAriaPageCursor('CONVERSATIONS', { timestamp: tail.updatedAt, id: tail.id })
        : null,
    };
  }

  async listMessages(input: Parameters<AriaHistoryRepository['listMessages']>[0]) {
    const studentId = await requireStudentId(input.actorUserId);
    const conversation = await prisma.ariaConversation.findFirst({
      where: { id: input.conversationId, studentId },
      select: {
        id: true,
        courseKey: true,
        contextState: true,
        turns: {
          where: {
            useCase: AriaConversationTurnUseCase.CONVERSATION,
            status: { in: [AriaConversationTurnStatus.PENDING, AriaConversationTurnStatus.RUNNING] },
          },
          orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
          take: 2,
          select: { id: true, clientRequestId: true, status: true, pedagogicalMode: true },
        },
      },
    });
    if (!conversation) {
      throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation ARIA introuvable.');
    }
    if (conversation.turns.length > 1) {
      throw new AriaError('INTERNAL_ERROR', 500, 'Plusieurs Turns ARIA actifs pour une conversation.');
    }
    const activeTurn = conversation.turns[0];
    const cursor = decodeAriaPageCursor('MESSAGES', input.cursor);
    const rows = await prisma.ariaMessage.findMany({
      where: {
        conversationId: conversation.id,
        ...(cursor ? {
          OR: [
            { createdAt: { lt: cursor.timestamp } },
            { createdAt: cursor.timestamp, id: { lt: cursor.id } },
          ],
        } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      select: {
        id: true,
        turnId: true,
        turn: {
          select: { useCase: true, status: true, retrievalEvidence: true },
        },
        role: true,
        content: true,
        status: true,
        createdAt: true,
        citations: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true, sourceTitle: true, sourceDocument: true, sourceLocation: true,
            courseKey: true, provenance: true, url: true, resourceId: true,
            resourceVersionId: true, contentSha256: true, chunkId: true, locator: true,
            corpusId: true, corpusVersionId: true, manifestSha256: true,
          },
        },
        feedbacks: {
          where: { studentId },
          take: 1,
          select: { useful: true },
        },
      },
    });
    const hasMore = rows.length > input.limit;
    const descendingPage = rows.slice(0, input.limit);
    const tail = descendingPage[descendingPage.length - 1];
    const messages: AriaConversationHistoryMessage[] = descendingPage.reverse().map((message) => ({
      courseKey: conversation.courseKey,
      conversationId: conversation.id,
      turnId: message.turnId,
      messageId: message.id,
      role: assertMessageRole(message.role),
      content: message.content,
      status: assertMessageStatus(message.status),
      citations: message.citations.map((citation) => projectPersistedAriaHistoryCitation({
        row: citation,
        retrievalEvidence: message.turn?.retrievalEvidence ?? null,
        expectedCourseKey: conversation.courseKey,
        canonicalConversationTurn: message.turn?.useCase
          === AriaConversationTurnUseCase.CONVERSATION
          && (message.turn.status === AriaConversationTurnStatus.COMPLETED
            || message.turn.status === AriaConversationTurnStatus.CANCELLED
            || message.turn.status === AriaConversationTurnStatus.ERROR),
      })),
      feedback: message.feedbacks[0]?.useful ?? null,
      createdAt: message.createdAt.toISOString(),
    }));
    return {
      conversation: {
        id: conversation.id,
        courseKey: conversation.courseKey,
        contextState: conversation.contextState,
        resumable: conversation.contextState === 'ACTIVE' && conversation.courseKey !== null,
        activeTurn: activeTurn ? {
          turnId: activeTurn.id,
          clientRequestId: activeTurn.clientRequestId,
          status: assertActiveTurnStatus(activeTurn.status),
          pedagogicalMode: assertPedagogicalMode(activeTurn.pedagogicalMode),
        } : null,
      },
      messages,
      nextCursor: hasMore && tail
        ? encodeAriaPageCursor('MESSAGES', { timestamp: tail.createdAt, id: tail.id })
        : null,
    };
  }
}

export const prismaAriaHistoryRepository = new PrismaAriaHistoryRepository();
