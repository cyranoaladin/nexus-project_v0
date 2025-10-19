import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AriaMessage } from '@prisma/client'
import { z } from 'zod'
import { Subject } from '@/types/enums'
import { generateAriaResponse, saveAriaConversation } from '@/lib/aria'
import { checkAndAwardBadges } from '@/lib/badges'
import { rateLimit, ipKey } from '@/lib/security/rate-limit'
import { verifyCsrf } from '@/lib/security/csrf'

// Schema de validation pour les messages ARIA
const ariaMessageSchema = z.object({
  conversationId: z.string().optional(),
  subject: z.nativeEnum(Subject),
  content: z.string().min(1, 'Message requis').max(1000, 'Message trop long')
})

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 req/min par IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
    if (process.env.NODE_ENV === 'production') {
      const rl = rateLimit(ipKey(ip, 'aria_chat_post'), { max: 10, windowMs: 60_000 })
      if (!rl.allowed) {
        return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard' }, { status: 429 })
      }
    }

    // CSRF (prod uniquement)
    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: 'CSRF invalide' }, { status: 403 })
    }

    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ELEVE') {
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
    
    // Générer la réponse ARIA
    const ariaResponse = await generateAriaResponse(
      student.id,
      validatedData.subject,
      validatedData.content,
      conversationHistory
    )
    
    // Sauvegarder la conversation
    const { conversation, ariaMessage } = await saveAriaConversation(
      student.id,
      validatedData.subject,
      validatedData.content,
      ariaResponse,
      validatedData.conversationId
    )
    
    // Vérifier et attribuer des badges
    const newBadges = await checkAndAwardBadges(student.id, 'first_aria_question')
    await checkAndAwardBadges(student.id, 'aria_question_count')
    
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
    console.error('Erreur chat ARIA:', error)
    
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}