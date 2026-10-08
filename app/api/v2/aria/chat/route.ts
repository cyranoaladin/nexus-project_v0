export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ariaChatRequestSchema } from '@/lib/aria/transport/contracts';
import { toAriaJsonResponse } from '@/lib/aria/transport/json';
import { prepareAriaSSEConversation } from '@/lib/aria/transport/sse';
import { AriaError } from '@/lib/aria/kernel/errors';
import { serializeAriaPublicError } from '@/lib/aria/application/public-error';
import { makeCanonicalAriaConversationExecutor } from '@/lib/aria/application/conversation/execute';
import { CoreV2AriaConversationRepository } from '@/lib/core-v2/aria/conversation-repository';
import { buildCoreV2AriaConversationContext } from '@/lib/core-v2/aria/conversation-context';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { CoreV2DatabaseIdentityError, CoreV2DatabaseUrlError } from '@/lib/core-v2/client';
import { CoreV2ConfigError } from '@/lib/core-v2/config';
import { CoreV2DomainError, ForbiddenError, ValidationError } from '@/lib/core-v2/errors';
import { CORRELATION_HEADER } from '@/lib/core-v2/http/respond';
import { isCoreV2AriaConversationEnabled } from '@/lib/core-v2/aria/recovery-config';
import { logger } from '@/lib/logger';

function mapChatError(error: unknown, correlationId: string): NextResponse | undefined {
  if (
    (error instanceof CoreV2DomainError && !(error instanceof ValidationError))
    || error instanceof CoreV2ConfigError
    || error instanceof CoreV2DatabaseUrlError
    || error instanceof CoreV2DatabaseIdentityError
  ) return undefined;
  const publicError = serializeAriaPublicError(
    error instanceof ValidationError ? new AriaError('BAD_REQUEST', 400, 'Requête ARIA invalide.') : error,
    {
      requestId: correlationId,
      phase: 'PRE_STREAM',
      logger: { error: (message, _ignored, metadata) => logger.error(metadata ?? {}, message) },
    },
  );
  return NextResponse.json({
    ok: false,
    error: { ...publicError.body.error, message: 'Requête ARIA impossible.' },
    correlationId,
  }, {
    status: publicError.status,
    headers: { [CORRELATION_HEADER]: correlationId },
  });
}

export const POST = defineStaffRoute({
  body: ariaChatRequestSchema,
  mapError: mapChatError,
  handler: async ({ client, ctx, body, request }) => {
    if (!isCoreV2AriaConversationEnabled()) {
      throw new ForbiddenError('Le chat ARIA Core v2 n’est pas encore disponible pour ce profil.');
    }
    const context = await buildCoreV2AriaConversationContext(client, ctx, {
      courseKey: body!.courseKey,
      conversationId: body!.conversationId,
      skillId: body!.skillId,
    });
    const repository = new CoreV2AriaConversationRepository(client);
    const execute = makeCanonicalAriaConversationExecutor(repository);
    const executionInput = {
      requestId: ctx.correlationId,
      context,
      clientRequestId: body!.clientRequestId,
      message: body!.content,
      pedagogicalMode: body!.pedagogicalMode,
    };
    if (request.headers.get('accept')?.includes('text/event-stream')) {
      const prepared = await prepareAriaSSEConversation({
        executionInput,
        requestId: ctx.correlationId,
        execute,
        logger: { error: (message, _ignored, metadata) => logger.error(metadata ?? {}, message) },
      });
      if (prepared.kind === 'IN_PROGRESS') {
        return { data: { turnId: prepared.result.turnId, status: prepared.result.status, disposition: prepared.result.disposition, retryAfterMs: 1_000 }, status: 202 };
      }
      return new NextResponse(prepared.stream, { headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'private, no-store, no-transform',
        'X-Accel-Buffering': 'no',
      } });
    }
    const result = await execute(executionInput);
    if (result.status === 'ERROR') throw new AriaError(result.failureCode ?? 'INTERNAL_ERROR', 500, 'L’exécution ARIA s’est terminée en erreur.');
    if (result.disposition === 'IN_PROGRESS') {
      return { data: { turnId: result.turnId, status: result.status, disposition: result.disposition, retryAfterMs: 1_000 }, status: 202 };
    }
    return { data: toAriaJsonResponse(result, body!.courseKey), status: 200 };
  },
});
