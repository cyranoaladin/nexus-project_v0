import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import crypto from 'crypto'
import { upsertPaymentByExternalId } from '@/lib/payments'

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
    
    const body = await request.json()
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
    
    // Construire un externalId déterministe pour l'idempotence
    const idempotencyKey = `wise:${session.user.id}:${validatedData.studentId}:${validatedData.type}:${validatedData.key}:${validatedData.amount}`
    const externalId = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32)

    const mappedType = (validatedData.type === 'subscription'
      ? 'SUBSCRIPTION'
      : validatedData.type === 'addon'
        ? 'SPECIAL_PACK'
        : 'CREDIT_PACK') as 'SUBSCRIPTION' | 'SPECIAL_PACK' | 'CREDIT_PACK'

    // Créer ou récupérer l'enregistrement de paiement (idempotent)
    const { payment } = await upsertPaymentByExternalId({
      externalId,
      method: 'wise',
      type: mappedType,
      userId: session.user.id,
      amount: validatedData.amount,
      currency: 'TND',
      description: validatedData.description,
      metadata: {
        studentId: validatedData.studentId,
        itemKey: validatedData.key,
        itemType: validatedData.type
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
