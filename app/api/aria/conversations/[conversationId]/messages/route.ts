export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { listAriaConversationMessages } from '@/lib/aria/application/history/public';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';
import { createLogger } from '@/lib/middleware/logger';
import {
  ariaConversationMessagesQuerySchema,
  strictSearchParams,
} from '@/lib/aria/transport/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const logger = createLogger(request);
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const { conversationId } = await context.params;
    const query = ariaConversationMessagesQuerySchema.parse(
      strictSearchParams(new URL(request.url).searchParams),
    );
    const result = await listAriaConversationMessages({
      actor: { userId: session.user.id, role: session.user.role },
      conversationId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === 'ARIA_QUERY_PARAMETER_DUPLICATED')) {
      return toAriaErrorResponse(
        new AriaError('BAD_REQUEST', 400, 'Requête de messages ARIA invalide.'),
        logger,
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
