export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import { createLogger } from '@/lib/middleware/logger';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';
import { ariaChatRequestSchema, ariaPendingResponseSchema } from '@/lib/aria/transport/contracts';
import { executeAriaConversationJson } from '@/lib/aria/transport/json';
import { requireInternalAriaResponse } from '@/lib/aria/transport/internal-response';
import { prepareAriaSSEConversation } from '@/lib/aria/transport/sse';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  const logger = createLogger(request);
  const acceptHeader = request.headers.get('accept') || '';
  const isStreamingRequest = acceptHeader.includes('text/event-stream');

  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const validated = ariaChatRequestSchema.parse(body);

    const context = await buildAriaConversationContext({
      actor: { userId: session.user.id, role: session.user.role },
      courseKey: validated.courseKey,
      skillId: validated.skillId,
      resourceId: validated.resourceId,
      conversationId: validated.conversationId,
    });

    if (isStreamingRequest) {
      const prepared = await prepareAriaSSEConversation({
        executionInput: {
          context,
          clientRequestId: validated.clientRequestId,
          message: validated.content,
          pedagogicalMode: validated.pedagogicalMode,
        },
        requestId: logger.getRequestId(),
        logger,
      });
      if (prepared.kind === 'IN_PROGRESS') {
        return NextResponse.json(requireInternalAriaResponse(ariaPendingResponseSchema, {
          turnId: prepared.result.turnId,
          status: prepared.result.status,
          disposition: prepared.result.disposition,
          retryAfterMs: 1_000,
        }), { status: 202 });
      }

      return new Response(prepared.stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const responseBody = await executeAriaConversationJson({
      requestId: logger.getRequestId(),
      context,
      clientRequestId: validated.clientRequestId,
      message: validated.content,
      pedagogicalMode: validated.pedagogicalMode,
    });

    return NextResponse.json(responseBody, {
      status: responseBody.metadata.disposition === 'IN_PROGRESS' ? 202 : 200,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return toAriaErrorResponse(
        new AriaError('BAD_REQUEST', 400, 'Requête ARIA invalide.'),
        logger,
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
