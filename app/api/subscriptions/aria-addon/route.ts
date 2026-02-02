export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ARIA_ADDONS } from '@/lib/constants'

const ariaAddonSchema = z.object({
  studentId: z.string(),
  addon: z.string()
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
    const { studentId, addon } = ariaAddonSchema.parse(body)
    
    // Vérifier que l'add-on existe
    if (!ARIA_ADDONS[addon as keyof typeof ARIA_ADDONS]) {
      return NextResponse.json(
        { error: 'Add-on ARIA invalide' },
        { status: 400 }
      )
    }
    
    // Vérifier que l'élève appartient au parent connecté
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        parent: {
          userId: session.user.id
        }
      },
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
        { error: 'Élève non trouvé ou non autorisé' },
        { status: 404 }
      )
    }
    
    if (!student.subscriptions[0]) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif trouvé' },
        { status: 400 }
      )
    }
    
    const addonData = ARIA_ADDONS[addon as keyof typeof ARIA_ADDONS]
    
    return NextResponse.json({
      success: true,
      addon: {
        key: addon,
        name: addonData.name,
        price: addonData.price,
        description: addonData.description
      },
      message: 'Add-on ARIA prêt pour le paiement'
    })
    
  } catch (error) {
    console.error('Erreur add-on ARIA:', error)
    
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}