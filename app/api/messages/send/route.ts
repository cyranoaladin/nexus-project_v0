export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const sendMessageSchema = z.object({
  receiverId: z.string(),
  content: z.string().min(1, 'Message requis').max(1000, 'Message trop long'),
  fileUrl: z.string().optional(),
  fileName: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const validatedData = sendMessageSchema.parse(body)
    
    // Vérifier que le destinataire existe
    const receiver = await prisma.user.findUnique({
      where: { id: validatedData.receiverId }
    })
    
    if (!receiver) {
      return NextResponse.json(
        { error: 'Destinataire non trouvé' },
        { status: 404 }
      )
    }
    
    // Vérifier les permissions de communication
    // Élèves peuvent écrire à leurs coachs
    // Coachs peuvent écrire à leurs élèves
    // Assistante peut écrire à tout le monde
    // Parents peuvent écrire aux coachs de leurs enfants
    
    if (session.user.role === 'ELEVE') {
      // Vérifier que le destinataire est un coach ou l'assistante
      if (!['COACH', 'ASSISTANTE'].includes(receiver.role)) {
        return NextResponse.json(
          { error: 'Communication non autorisée' },
          { status: 403 }
        )
      }
    }
    
    // Créer le message
    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId: validatedData.receiverId,
        content: validatedData.content,
        fileUrl: validatedData.fileUrl,
        fileName: validatedData.fileName
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        createdAt: message.createdAt,
        sender: message.sender,
        receiver: message.receiver
      }
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Erreur envoi message:', error)
    
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
