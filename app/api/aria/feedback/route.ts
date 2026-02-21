export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { recordAriaFeedback } from '@/lib/aria'
import { checkAndAwardBadges } from '@/lib/badges'
import { createLogger } from '@/lib/middleware/logger'

// Schema de validation pour le feedback ARIA
const ariaFeedbackSchema = z.object({
  messageId: z.string(),
  feedback: z.boolean()
})

export async function POST(request: NextRequest) {
  const logger = createLogger(request)
  
  try {
    let session: any = null
    try {
      session = await auth()
    } catch {
      // auth() can throw UntrustedHost in standalone mode
    }
    
    if (!session?.user || session.user.role !== 'ELEVE') {
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
      
      logger.logSecurityEvent('unauthorized_access', 401, {
        ip,
        reason: !session?.user ? 'no_session' : 'invalid_role',
        expectedRole: 'ELEVE',
        actualRole: session?.user?.role
      })
      
      logger.logRequest(401)
      
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const validatedData = ariaFeedbackSchema.parse(body)
    
    logger.info('ARIA feedback submission', {
      userId: session.user.id,
      messageId: validatedData.messageId,
      feedback: validatedData.feedback
    })
    
    // Vérifier que le message appartient à l'élève
    const message = await prisma.ariaMessage.findFirst({
      where: {
        id: validatedData.messageId,
        conversation: {
          student: {
            userId: session.user.id
          }
        }
      }
    })
    
    if (!message) {
      logger.warn('ARIA feedback for non-existent message', {
        userId: session.user.id,
        messageId: validatedData.messageId
      })
      
      logger.logRequest(404)
      
      return NextResponse.json(
        { error: 'Message non trouvé' },
        { status: 404 }
      )
    }
    
    // Enregistrer le feedback
    await recordAriaFeedback(validatedData.messageId, validatedData.feedback)
    
    // Récupérer l'élève pour les badges
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id }
    })
    
    if (student) {
      // Vérifier et attribuer des badges
      const newBadges = await checkAndAwardBadges(student.id, 'aria_feedback')
      
      logger.info('ARIA feedback recorded', {
        studentId: student.id,
        badgesAwarded: newBadges.length
      })
      
      logger.logRequest(200, {
        badgesCount: newBadges.length
      })
      
      return NextResponse.json({
        success: true,
        newBadges: newBadges.map(badge => ({
          name: badge.badge.name,
          description: badge.badge.description,
          icon: badge.badge.icon
        }))
      })
    }
    
    logger.logRequest(200)
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    logger.error('Erreur feedback ARIA:', error)
    logger.logRequest(500)
    
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}