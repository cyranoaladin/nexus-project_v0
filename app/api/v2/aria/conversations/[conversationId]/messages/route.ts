export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { loadCoreV2AriaStudentContext } from '@/lib/core-v2/aria/student-context';
import { NotFoundError } from '@/lib/core-v2/errors';

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();

export const GET = defineStaffRoute({
  query: querySchema,
  handler: async ({ client, ctx, query, params }) => {
    const student = await loadCoreV2AriaStudentContext(client, ctx);
    const conversation = await client.ariaConversationCoreV2.findFirst({ where: { id: params.conversationId, studentId: student.studentId }, select: { id: true } });
    if (!conversation) throw new NotFoundError('Conversation ARIA introuvable.');
    const messages = await client.ariaMessageCoreV2.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query?.limit ?? 50,
      select: { id: true, turnId: true, role: true, content: true, createdAt: true, citations: { select: { id: true, sourceTitle: true, sourceDocument: true, sourceLocation: true, courseKey: true, provenance: true, url: true } } },
    });
    return { data: { conversationId: conversation.id, messages } };
  },
});
