import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { AriaAccessStatus, Subject } from '@prisma/client'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_FREEMIUM_SUBJECTS,
  DEFAULT_FREEMIUM_TOKENS,
  getAriaAccessSnapshot,
  grantAriaFreemium,
  hasFreemiumQuota
} from '@/lib/aria-access'

const freemiumPayloadSchema = z.object({
  subjects: z.array(z.nativeEnum(Subject)).min(1).max(3).optional(),
  tokens: z.number().int().min(1).max(200).optional(),
  durationDays: z.number().int().min(1).max(90).optional()
}).optional()

function serializeSnapshot(snapshot: ReturnType<typeof getAriaAccessSnapshot>): {
  status: AriaAccessStatus
  subjects: Subject[]
  activatedAt: string | null
  deactivatedAt: string | null
  freemium: {
    tokensGranted: number
    tokensUsed: number
    remaining: number
    expiresAt: string | null
  }
  lastInteractionAt: string | null
} {
  return {
    status: snapshot.status,
    subjects: snapshot.subjects,
    activatedAt: snapshot.activatedAt ? snapshot.activatedAt.toISOString() : null,
    deactivatedAt: snapshot.deactivatedAt ? snapshot.deactivatedAt.toISOString() : null,
    freemium: {
      tokensGranted: snapshot.freemium.tokensGranted,
      tokensUsed: snapshot.freemium.tokensUsed,
      remaining: snapshot.freemium.remaining,
      expiresAt: snapshot.freemium.expiresAt ? snapshot.freemium.expiresAt.toISOString() : null
    },
    lastInteractionAt: snapshot.lastInteractionAt ? snapshot.lastInteractionAt.toISOString() : null
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id }
    })

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 })
    }

    const snapshot = getAriaAccessSnapshot(student)

    return NextResponse.json({
      success: true,
      access: serializeSnapshot(snapshot)
    })
  } catch (error) {
    console.error('ARIA freemium GET error:', error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id }
    })

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const parsedPayload = freemiumPayloadSchema.parse(body || {})

    const snapshot = getAriaAccessSnapshot(student)

    if (snapshot.status === AriaAccessStatus.ACTIVE) {
      return NextResponse.json({
        error: 'ARIA est déjà activée en illimité sur votre compte'
      }, { status: 409 })
    }

    if (snapshot.status === AriaAccessStatus.SUSPENDED) {
      return NextResponse.json({
        error: 'Votre accès ARIA est suspendu. Contactez Nexus pour assistance.'
      }, { status: 403 })
    }

    if (snapshot.status === AriaAccessStatus.FREEMIUM && hasFreemiumQuota(snapshot)) {
      return NextResponse.json({
        success: true,
        message: 'Votre accès freemium ARIA est déjà actif',
        access: serializeSnapshot(snapshot)
      })
    }

    const hasConsumedFreemium = snapshot.status === AriaAccessStatus.FREEMIUM && !hasFreemiumQuota(snapshot)

    if (hasConsumedFreemium) {
      return NextResponse.json({
        error: 'Le quota freemium ARIA est épuisé. Contactez Nexus pour passer en formule illimitée.'
      }, { status: 402 })
    }

    const subjects = parsedPayload?.subjects && parsedPayload.subjects.length > 0
      ? parsedPayload.subjects
      : DEFAULT_FREEMIUM_SUBJECTS

    const tokens = parsedPayload?.tokens ?? DEFAULT_FREEMIUM_TOKENS
    const durationDays = parsedPayload?.durationDays

    await grantAriaFreemium({
      studentId: student.id,
      subjects,
      tokens,
      durationDays
    })

    const refreshed = await prisma.student.findUnique({ where: { id: student.id } })
    if (!refreshed) {
      throw new Error('ARIA freemium: état étudiant introuvable après activation')
    }

    const refreshedSnapshot = getAriaAccessSnapshot(refreshed)

    return NextResponse.json({
      success: true,
      message: 'Accès freemium ARIA activé. Profitez de vos tokens d’essai !',
      access: serializeSnapshot(refreshedSnapshot)
    })
  } catch (error) {
    console.error('ARIA freemium POST error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload invalide', details: error.flatten() }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
