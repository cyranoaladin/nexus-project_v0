export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AriaMessage } from '@prisma/client'
import { z } from 'zod'
import { Subject } from '@/types/enums'
import { saveAriaConversation, generateAriaStream } from '@/lib/aria'
import { checkAndAwardBadges } from '@/lib/badges'
import { createLogger } from '@/lib/middleware/logger'

// Schema de validation pour les messages ARIA
const ariaMessageSchema = z.object({
  conversationId: z.string().optional(),
  subject: z.nativeEnum(Subject),
  content: z.string().min(1, 'Message requis').max(1000, 'Message trop long')
})

export async function POST(request: NextRequest) {
  const logger = createLogger(request)

  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ELEVE') {
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'

      logger.logSecurityEvent('unauthorized_access', 401, {
        ip,
        reason: !session ? 'no_session' : 'invalid_role',
        expectedRole: 'ELEVE',
        actualRole: session?.user.role
      })

      logger.logRequest(401)

      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = ariaMessageSchema.parse(body)

    // Récupérer l'élève
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!student) {
      return NextResponse.json(
        { error: 'Profil élève non trouvé' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à ARIA pour cette matière
    const activeSubscription = student.subscriptions[0]
    if (!activeSubscription || !activeSubscription.ariaSubjects.includes(validatedData.subject)) {
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'

      logger.logSecurityEvent('forbidden_access', 403, {
        ip,
        userId: session.user.id,
        reason: 'aria_subject_not_subscribed',
        subject: validatedData.subject
      })

      logger.logRequest(403)

      return NextResponse.json(
        { error: 'Accès ARIA non autorisé pour cette matière' },
        { status: 403 }
      )
    }

    // Récupérer l'historique de conversation si fourni
    let conversationHistory: Array<{ role: string; content: string }> = []

    if (validatedData.conversationId) {
      const messages = await prisma.ariaMessage.findMany({
        where: { conversationId: validatedData.conversationId },
        orderBy: { createdAt: 'asc' },
        take: 10 // Limiter l'historique
      })

      conversationHistory = messages.map((msg: AriaMessage) => ({
        role: msg.role,
        content: msg.content
      }))
    }

    logger.info('ARIA chat request', {
      userId: session.user.id,
      studentId: student.id,
      subject: validatedData.subject,
      conversationId: validatedData.conversationId,
      hasHistory: conversationHistory.length > 0
    })

    // Generate ARIA Response with Streaming
    const stream = await generateAriaStream(
      student.id,
      validatedData.subject,
      validatedData.content,
      conversationHistory,
      async (fullResponse) => {
        // Save conversation after stream completes
        const { conversation, ariaMessage } = await saveAriaConversation(
          student.id,
          validatedData.subject,
          validatedData.content,
          fullResponse,
          validatedData.conversationId
        );

        // Award Badges (Background)
        checkAndAwardBadges(student.id, 'first_aria_question').catch(console.error);
        checkAndAwardBadges(student.id, 'aria_question_count').catch(console.error);

        logger.info('ARIA stream completed & saved', {
          conversationId: conversation.id,
          messageId: ariaMessage.id
        });
      }
    );

    // If conversationId is new, we might need to send it back. 
    // However, with streaming, we can't easily send JSON metadata + stream without custom encoding (e.g. Server-Sent Events or delimiting).
    // For simplicity in this iteration, we return the stream of text. 
    // The client will need to fetch the conversation ID separately or we assume the client handles the "new conversation" logic 
    // by optimistically creating one or just dealing with the stream content for now.
    // To properly handle "New Conversation ID", we would typically send a header.

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      }
    });

  } catch (error) {
    logger.error('Erreur chat ARIA:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}