export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { loadCoreV2AriaStudentContext } from '@/lib/core-v2/aria/student-context';
import { NotFoundError } from '@/lib/core-v2/errors';

const bodySchema = z.object({ messageId: z.string().min(1), useful: z.boolean(), reason: z.string().max(500).nullable().optional() }).strict();

export const POST = defineStaffRoute({
  body: bodySchema,
  handler: async ({ client, ctx, body }) => {
    const student = await loadCoreV2AriaStudentContext(client, ctx);
    const message = await client.ariaMessageCoreV2.findFirst({ where: { id: body!.messageId, conversation: { studentId: student.studentId } }, select: { id: true } });
    if (!message) throw new NotFoundError('Message ARIA introuvable.');
    const feedback = await client.ariaFeedbackCoreV2.upsert({
      where: { messageId_studentId: { messageId: message.id, studentId: student.studentId } },
      create: { messageId: message.id, studentId: student.studentId, useful: body!.useful, reason: body!.reason ?? null },
      update: { useful: body!.useful, reason: body!.reason ?? null },
      select: { id: true, useful: true, reason: true, updatedAt: true },
    });
    return { data: { success: true, feedback, newBadges: [] } };
  },
});
