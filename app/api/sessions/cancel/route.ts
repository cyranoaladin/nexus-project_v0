import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { refundCredits } from '@/lib/credits'
import { z } from 'zod'

const cancelSessionSchema = z.object({
  sessionId: z.string(),
  reason: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ELEVE', 'COACH', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 401 }
      )
    }
    
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type invalide. Utilisez application/json.' }, { status: 415 })
    }
    let raw = ''
    try { raw = await request.text() } catch { raw = '' }
    if (!raw || raw.trim().length === 0) {
      return NextResponse.json({ error: 'Requête invalide: corps vide.' }, { status: 400 })
    }
    let body: unknown
    try { body = JSON.parse(raw) } catch {
      return NextResponse.json({ error: 'Requête invalide: JSON mal formé.' }, { status: 400 })
    }
    const { sessionId, reason } = cancelSessionSchema.parse(body)
    
    // Récupérer la session
    const sessionToCancel = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        student: true
      }
    })
    
    if (!sessionToCancel) {
      return NextResponse.json(
        { error: 'Session non trouvée' },
        { status: 404 }
      )
    }
    
    // Vérifier les permissions
    if (session.user.role === 'ELEVE') {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id }
      })
      
      if (!student || student.id !== sessionToCancel.studentId) {
        return NextResponse.json(
          { error: 'Accès non autorisé à cette session' },
          { status: 403 }
        )
      }
    }
    
    // Vérifier si l'annulation est dans les délais
    const now = new Date()
    const sessionDate = new Date(sessionToCancel.scheduledAt)
    const hoursUntilSession = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    let canRefund = false
    
    // Politique d'annulation selon le type
    if (sessionToCancel.type === 'COURS_ONLINE' || sessionToCancel.type === 'COURS_PRESENTIEL') {
      canRefund = hoursUntilSession >= 24 // 24h avant
    } else if (sessionToCancel.type === 'ATELIER_GROUPE') {
      canRefund = hoursUntilSession >= 48 // 48h avant
    }
    
    // Les assistantes peuvent toujours rembourser (cas exceptionnels)
    if (session.user.role === 'ASSISTANTE') {
      canRefund = true
    }
    
    // Annuler la session
    const cancelledSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        report: reason ? `Annulée: ${reason}` : 'Annulée'
      }
    })
    
    // Rembourser les crédits si dans les délais
    if (canRefund) {
      await refundCredits(
        sessionToCancel.studentId,
        sessionToCancel.creditCost,
        sessionId,
        `Remboursement annulation: ${sessionToCancel.title}`
      )
    }
    
    return NextResponse.json({
      success: true,
      refunded: canRefund,
      message: canRefund 
        ? 'Session annulée et crédits remboursés'
        : 'Session annulée (pas de remboursement - délai dépassé)'
    })
    
  } catch (error) {
    console.error('Erreur annulation session:', error)
    
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}