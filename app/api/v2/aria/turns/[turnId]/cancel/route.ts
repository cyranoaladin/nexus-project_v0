export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { CoreV2AriaConversationRepository } from '@/lib/core-v2/aria/conversation-repository';
import { NotFoundError } from '@/lib/core-v2/errors';

const bodySchema = z.object({ clientRequestId: z.string().uuid() }).strict();

export const POST = defineStaffRoute({
  body: bodySchema,
  handler: async ({ client, ctx, body, params }) => {
    const repository = new CoreV2AriaConversationRepository(client);
    try {
      const result = await repository.requestCancellation({ turnId: params.turnId!, actorUserId: ctx.actor.userId, clientRequestId: body!.clientRequestId, now: ctx.now() });
      return { data: result, status: result.disposition === 'CANCELLATION_REQUESTED' ? 202 : 200 };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AriaError' && (error as { code?: string }).code === 'CONVERSATION_NOT_FOUND') throw new NotFoundError('Turn ARIA introuvable.');
      throw error;
    }
  },
});
