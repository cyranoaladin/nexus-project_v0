import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const wisePaymentSchema = z.object({
  type: z.enum(['subscription', 'addon', 'pack']),
  key: z.string(),
  studentId: z.string(),
  idempotencyKey: z.string().optional(),
})

function mapPaymentType(t: 'subscription' | 'addon' | 'pack') {
  if (t === 'subscription') return 'SUBSCRIPTION' as const
  if (t === 'pack') return 'CREDIT_PACK' as const
  return 'SPECIAL_PACK' as const
}

async function fetchPricing(type: 'subscription' | 'addon' | 'pack', key: string) {
  const itemType = type.toUpperCase()
  const pricing = await prisma.productPricing.findUnique({
    where: { itemType_itemKey: { itemType, itemKey: key } as any },
  })
  if (!pricing || pricing.active === false || pricing.currency !== 'TND') return null
  return { amount: pricing.amount, description: pricing.description }
}

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

    const pricing = await fetchPricing(validatedData.type, validatedData.key)
    if (!pricing) {
      return NextResponse.json({ error: 'Article inconnu, inactif ou non tarifé' }, { status: 400 })
    }

    const idempotencyKey = request.headers.get('Idempotency-Key') || validatedData.idempotencyKey || undefined

    if (idempotencyKey) {
      const existing = await prisma.payment.findUnique({ where: { externalId: idempotencyKey } })
      if (existing) {
        const sameUser = existing.userId === session.user.id
        const sameAmount = Number(existing.amount) === Number(pricing.amount)
        const sameMethod = existing.method === 'wise'
        if (!sameUser || !sameAmount || !sameMethod) {
          return NextResponse.json({ error: 'Clé d\'idempotence déjà utilisée pour un autre paiement' }, { status: 409 })
        }
        return NextResponse.json({
          success: true,
          orderId: existing.id,
          message: 'Commande Wise récupérée (idempotent)'
        })
      }
    }
    
    // Créer l'enregistrement de paiement
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        type: mapPaymentType(validatedData.type) as any,
        amount: pricing.amount,
        currency: 'TND',
        description: pricing.description,
        status: 'PENDING',
        method: 'wise',
        externalId: idempotencyKey,
        metadata: {
          studentId: validatedData.studentId,
          itemKey: validatedData.key,
          itemType: validatedData.type,
          idempotencyKey: idempotencyKey || null,
        } as any,
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
