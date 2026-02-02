export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AriaMessage } from '@prisma/client'
import { z } from 'zod'
import { Subject } from '@/types/enums'
import { generateAriaResponse, saveAriaConversation } from '@/lib/aria'
import { generateAriaResponseStream } from '@/lib/aria-streaming'
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
  const acceptHeader = request.headers.get('accept') || ''
  const isStreamingRequest = acceptHeader.includes('text/event-stream')
  
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
        take: 10
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
      hasHistory: conversationHistory.length > 0,
      streaming: isStreamingRequest
    })
    
    // Handle streaming request
    if (isStreamingRequest) {
      const stream = await generateAriaResponseStream(
        student.id,
        validatedData.subject,
        validatedData.content,
        conversationHistory
      )
      
      const conversationId = validatedData.conversationId || crypto.randomUUID()
      
      const responseStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          const reader = stream.getReader()
          let fullResponse = ''
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'start',
            conversationId 
          })}\n\n`))
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              controller.enqueue(value)
              
              const text = new TextDecoder().decode(value)
              const dataLines = text.split('\n\n')
              for (const line of dataLines) {
                if (line.startsWith('data: ')) {
                  const jsonStr = line.substring(6)
                  try {
                    const data = JSON.parse(jsonStr)
                    if (data.content) {
                      fullResponse += data.content
                    }
                  } catch {
                    // Ignore parse errors
                  }
                }
              }
            }
            
            // Save conversation after streaming completes
            const { conversation, ariaMessage } = await saveAriaConversation(
              student.id,
              validatedData.subject,
              validatedData.content,
              fullResponse,
              validatedData.conversationId
            )
            
            // Check and award badges
            const newBadges = await checkAndAwardBadges(student.id, 'first_aria_question')
            await checkAndAwardBadges(student.id, 'aria_question_count')
            
            logger.info('ARIA streaming response completed', {
              conversationId: conversation.id,
              messageId: ariaMessage.id,
              badgesAwarded: newBadges.length
            })
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'metadata',
              conversation: {
                id: conversation.id,
                subject: conversation.subject,
                title: conversation.title
              },
              message: {
                id: ariaMessage.id,
                createdAt: ariaMessage.createdAt
              },
              newBadges: newBadges.map(badge => ({
                name: badge.badge.name,
                description: badge.badge.description,
                icon: badge.badge.icon
              }))
            })}\n\n`))
            
            controller.close()
          } catch (error) {
            logger.error('Streaming error:', error)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error',
              error: 'Streaming error occurred' 
            })}\n\n`))
            controller.close()
          }
        }
      })
      
      logger.logRequest(200)
      
      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }
    
    // Non-streaming path (backward compatibility)
    const ariaResponse = await generateAriaResponse(
      student.id,
      validatedData.subject,
      validatedData.content,
      conversationHistory
    )
    
    const { conversation, ariaMessage } = await saveAriaConversation(
      student.id,
      validatedData.subject,
      validatedData.content,
      ariaResponse,
      validatedData.conversationId
    )
    
    const newBadges = await checkAndAwardBadges(student.id, 'first_aria_question')
    await checkAndAwardBadges(student.id, 'aria_question_count')
    
    logger.info('ARIA response generated', {
      conversationId: conversation.id,
      messageId: ariaMessage.id,
      badgesAwarded: newBadges.length
    })
    
    logger.logRequest(200, {
      conversationId: conversation.id,
      badgesCount: newBadges.length
    })
    
    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        subject: conversation.subject,
        title: conversation.title
      },
      message: {
        id: ariaMessage.id,
        content: ariaResponse,
        createdAt: ariaMessage.createdAt
      },
      newBadges: newBadges.map(badge => ({
        name: badge.badge.name,
        description: badge.badge.description,
        icon: badge.badge.icon
      }))
    })
    
  } catch (error) {
    logger.error('Erreur chat ARIA:', error)
    logger.logRequest(500)
    
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}