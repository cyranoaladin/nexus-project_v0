export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { listAriaConversations } from '@/lib/aria/application/history/public';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';
import { createLogger } from '@/lib/middleware/logger';
import {
  ariaConversationListQuerySchema,
  strictSearchParams,
} from '@/lib/aria/transport/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ELEVE') {
      return unauthorizedAriaResponse(logger);
    }
    const query = ariaConversationListQuerySchema.parse(
      strictSearchParams(new URL(request.url).searchParams),
    );
    const legacy = query.contextState === 'LEGACY_CONTEXT_UNRESOLVED';
    const result = await listAriaConversations({
      actor: { userId: session.user.id, role: session.user.role },
      courseKey: legacy ? undefined : query.courseKey,
      contextState: query.contextState,
      cursor: query.cursor,
      limit: query.limit,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === 'ARIA_QUERY_PARAMETER_DUPLICATED')) {
      return toAriaErrorResponse(
        new AriaError('BAD_REQUEST', 400, 'Requête d’historique ARIA invalide.'),
        logger,
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
