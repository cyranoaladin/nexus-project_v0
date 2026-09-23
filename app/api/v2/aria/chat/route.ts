export const dynamic = 'force-dynamic';

import { ariaChatRequestSchema } from '@/lib/aria/transport/contracts';
import { toAriaJsonResponse } from '@/lib/aria/transport/json';
import { AriaError } from '@/lib/aria/kernel/errors';
import { makeCanonicalAriaConversationExecutor } from '@/lib/aria/application/conversation/execute';
import { CoreV2AriaConversationRepository } from '@/lib/core-v2/aria/conversation-repository';
import { buildCoreV2AriaConversationContext } from '@/lib/core-v2/aria/conversation-context';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/core-v2/errors';

function mapConversationError(error: unknown): never {
  if (!(error instanceof AriaError)) throw error;
  if (error.code === 'COURSE_NOT_FOUND' || error.code === 'CONVERSATION_NOT_FOUND') throw new NotFoundError(error.publicMessage);
  if (error.code === 'NOT_ENROLLED' || error.code === 'NOT_ENTITLED' || error.code === 'UNSUPPORTED') throw new ForbiddenError(error.publicMessage);
  if (error.code === 'CONVERSATION_BUSY' || error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'CROSS_COURSE_MISMATCH') throw new ConflictError(error.publicMessage);
  if (error.code === 'INTERNAL_ERROR') throw error;
  throw new ValidationError(error.publicMessage);
}

export const POST = defineStaffRoute({
  body: ariaChatRequestSchema,
  handler: async ({ client, ctx, body }) => {
    try {
      const context = await buildCoreV2AriaConversationContext(client, ctx, {
        courseKey: body!.courseKey,
        conversationId: body!.conversationId,
        skillId: body!.skillId,
      });
      const repository = new CoreV2AriaConversationRepository(client);
      const execute = makeCanonicalAriaConversationExecutor(repository);
      const result = await execute({
        requestId: ctx.correlationId,
        context,
        clientRequestId: body!.clientRequestId,
        message: body!.content,
        pedagogicalMode: body!.pedagogicalMode,
      });
      if (result.status === 'ERROR') throw new AriaError(result.failureCode ?? 'INTERNAL_ERROR', 500, 'L’exécution ARIA s’est terminée en erreur.');
      if (result.disposition === 'IN_PROGRESS') {
        return { data: { turnId: result.turnId, status: result.status, disposition: result.disposition, retryAfterMs: 1_000 }, status: 202 };
      }
      return { data: toAriaJsonResponse(result, body!.courseKey), status: 200 };
    } catch (error: unknown) {
      mapConversationError(error);
    }
  },
});
