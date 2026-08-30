export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { streamAriaConversation, executeAriaConversationJson } from '@/lib/aria/orchestration';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';
import { ariaChatRequestSchema } from '@/lib/aria/transport/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  const logger = createLogger(request);
  const acceptHeader = request.headers.get('accept') || '';
  const isStreamingRequest = acceptHeader.includes('text/event-stream');

  try {
    let session: import('next-auth').Session | null = null;
    try {
      session = await auth();
    } catch {
      // Standalone mode bypass
    }

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

    // 3. Branche Streaming SSE unifiée (consomme executeAriaConversation via l'adaptateur streamAriaConversation)
    if (isStreamingRequest) {
      const sseStream = await streamAriaConversation({
        context,
        clientRequestId: validated.clientRequestId,
        message: validated.content,
      });

      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // 4. Branche JSON unifiée (consomme executeAriaConversation via l'adaptateur executeAriaConversationJson)
    // Invariant ARIA_GENERATION_PIPELINES=1 : même moteur, même RAG, même persistance
    const result = await executeAriaConversationJson({
      context,
      clientRequestId: validated.clientRequestId,
      message: validated.content,
    });

    return NextResponse.json({
      success: true,
      conversation: {
        id: result.conversationId,
        courseKey: context.courseKey,
      },
      message: {
        id: result.messageId,
        content: result.fullText,
        citations: result.citations,
      },
      newBadges: [],
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données de requête invalides', code: 'BAD_REQUEST', issues: error.issues },
        { status: 400 }
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
