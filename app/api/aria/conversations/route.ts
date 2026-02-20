export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Subject } from '@/types/enums'
import { createLogger } from '@/lib/middleware/logger'

export async function GET(request: NextRequest) {
  const logger = createLogger(request)
  
  try {
    const session = await auth()
    
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
    
    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject') as Subject | null
    
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id }
    })
    
    if (!student) {
      return NextResponse.json(
        { error: 'Profil élève non trouvé' },
        { status: 404 }
      )
    }
    
    interface WhereClause {
      studentId: string
      subject?: Subject
    }
    
    const whereClause: WhereClause = {
      studentId: student.id
    }
    
    if (subject) {
      whereClause.subject = subject
    }
    
    const conversations = await prisma.ariaConversation.findMany({
      where: whereClause,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    })
    
    logger.info('ARIA conversations retrieved', {
      userId: session.user.id,
      studentId: student.id,
      subject,
      count: conversations.length
    })
    
    logger.logRequest(200, {
      conversationCount: conversations.length
    })
    
    return NextResponse.json({
      success: true,
      conversations: conversations.map(conv => ({
        id: conv.id,
        subject: conv.subject,
        title: conv.title,
        messages: conv.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          feedback: msg.feedback,
          createdAt: msg.createdAt
        })),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      }))
    })
    
  } catch (error) {
    logger.error('Erreur récupération conversations ARIA:', error)
    logger.logRequest(500)
    
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
