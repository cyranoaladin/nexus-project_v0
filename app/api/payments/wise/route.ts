import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const wisePaymentSchema = z.object({
  type: z.enum(['subscription', 'addon', 'pack']),
  key: z.string(),
  studentId: z.string(),
  amount: z.number(),
  description: z.string()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'PARENT') {
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
    const validatedData = wisePaymentSchema.parse(body)
    
    // Vérifier que l'élève appartient au parent
    const student = await prisma.student.findFirst({
      where: {
        id: validatedData.studentId,
        parent: {
          userId: session.user.id
        }
      }
    })
    
    if (!student) {
      return NextResponse.json(
        { error: 'Élève non trouvé ou non autorisé' },
        { status: 404 }
      )
    }
    
    // Créer l'enregistrement de paiement
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        type: validatedData.type.toUpperCase() as any,
        amount: validatedData.amount,
        currency: 'TND',
        description: validatedData.description,
        status: 'PENDING',
        method: 'wise',
        metadata: {
          studentId: validatedData.studentId,
          itemKey: validatedData.key,
          itemType: validatedData.type
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      orderId: payment.id,
      message: 'Commande créée pour paiement Wise'
    })
    
  } catch (error) {
    console.error('Erreur paiement Wise:', error)
    
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}