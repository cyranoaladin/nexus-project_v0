export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { loadCoreV2AriaStudentContext } from '@/lib/core-v2/aria/student-context';
import { NotFoundError, ValidationError } from '@/lib/core-v2/errors';
import { decodeCoreV2HistoryCursor, encodeCoreV2HistoryCursor, projectCoreV2MessageStatus } from '@/lib/core-v2/aria/history-projection';

const querySchema = z.object({ cursor: z.string().min(1).max(1024).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();

export const GET = defineStaffRoute({
  query: querySchema,
  handler: async ({ client, ctx, query, params }) => {
    const student = await loadCoreV2AriaStudentContext(client, ctx);
    const conversation = await client.ariaConversationCoreV2.findFirst({ where: { id: params.conversationId, studentId: student.studentId }, select: { id: true, courseKey: true } });
    if (!conversation) throw new NotFoundError('Conversation ARIA introuvable.');
    const cursor = decodeCoreV2HistoryCursor(query?.cursor);
    if (query?.cursor && !cursor) throw new ValidationError('Curseur d’historique ARIA invalide.');
    const rows = await client.ariaMessageCoreV2.findMany({
      where: {
        conversationId: conversation.id,
        ...(cursor ? { OR: [
          { createdAt: { gt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ] } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: (query?.limit ?? 50) + 1,
      select: {
        id: true, turnId: true, role: true, content: true, createdAt: true,
        turn: { select: { status: true } },
        citations: { select: {
          id: true, sourceTitle: true, sourceDocument: true, sourceLocation: true,
          courseKey: true, provenance: true, url: true, resourceId: true,
          resourceVersionId: true, contentSha256: true, chunkId: true, locator: true,
          corpusId: true, corpusVersionId: true, manifestSha256: true,
        } },
        feedbacks: { where: { studentId: student.studentId }, select: { useful: true }, take: 1 },
      },
    });
    const limit = query?.limit ?? 50;
    const page = rows.slice(0, limit);
    const activeTurn = await client.ariaConversationTurnCoreV2.findFirst({
      where: { conversationId: conversation.id, status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
      select: { id: true, clientRequestId: true, status: true, pedagogicalMode: true },
    });
    const next = rows.length > limit ? page[page.length - 1] : undefined;
    return {
      data: {
        conversation: {
          id: conversation.id,
          courseKey: conversation.courseKey,
          contextState: 'ACTIVE' as const,
          resumable: true as const,
          activeTurn: activeTurn ? {
            turnId: activeTurn.id,
            clientRequestId: activeTurn.clientRequestId,
            status: activeTurn.status,
            pedagogicalMode: activeTurn.pedagogicalMode,
          } : null,
        },
        conversationId: conversation.id,
        messages: page.map((message) => ({
          id: message.id,
          turnId: message.turnId,
          role: message.role,
          content: message.content,
          status: projectCoreV2MessageStatus(message.role, message.turn.status),
          createdAt: message.createdAt,
          citations: message.citations.map((citation) => ({
            ...citation,
            traceability: 'CANONICAL' as const,
          })),
          feedback: message.feedbacks[0]?.useful ?? null,
        })),
        nextCursor: next ? encodeCoreV2HistoryCursor(next.createdAt, next.id) : null,
      },
    };
  },
});
