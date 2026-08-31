export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { cancelAriaConversationTurn } from '@/lib/aria/application/conversation/public';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';
import { createLogger } from '@/lib/middleware/logger';
import {
  ariaCancellationResponseSchema,
  ariaCancelRequestSchema,
} from '@/lib/aria/transport/contracts';
import { requireInternalAriaResponse } from '@/lib/aria/transport/internal-response';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ turnId: string }> },
) {
  const logger = createLogger(request);
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const { turnId } = await context.params;
    const body = ariaCancelRequestSchema.parse(await request.json());
    const result = await cancelAriaConversationTurn({
      actor: { userId: session.user.id, role: session.user.role },
      turnId,
      clientRequestId: body.clientRequestId,
    });
    const publicResult = requireInternalAriaResponse(ariaCancellationResponseSchema, {
      turnId: result.turnId,
      conversationId: result.conversationId,
      status: result.status,
      disposition: result.disposition,
    });
    return NextResponse.json(publicResult, {
      status: result.disposition === 'CANCELLATION_REQUESTED' ? 202 : 200,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return toAriaErrorResponse(
        new AriaError('BAD_REQUEST', 400, 'Requête d’annulation ARIA invalide.'),
        logger,
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
