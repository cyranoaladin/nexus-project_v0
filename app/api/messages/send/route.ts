export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canSendMessageToReceiver, sanitizeMessage } from '@/lib/security/message-access'
import { z } from 'zod'

const sendMessageSchema = z.object({
  receiverId: z.string().min(1).max(128),
  content: z.string().min(1, 'Message requis').max(1000, 'Message trop long'),
  fileUrl: z.undefined().optional(),
  fileName: z.undefined().optional()
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
      where: { id: validatedData.receiverId },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    })
    
    if (!receiver) {
      return NextResponse.json(
        { error: 'Destinataire non trouvé' },
        { status: 404 }
      )
    }
    
    const canSend = await canSendMessageToReceiver({
      senderUserId: session.user.id,
      senderRole: session.user.role,
      receiverUserId: receiver.id,
      receiverRole: receiver.role,
    });

    if (!canSend) {
      return NextResponse.json(
        { error: 'Communication non autorisée' },
        { status: 403 }
      )
    }
    
    // Créer le message
    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId: validatedData.receiverId,
        content: validatedData.content,
        fileUrl: null,
        fileName: null
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
      message: sanitizeMessage(message)
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Erreur envoi message:', error instanceof Error ? error.message : 'unknown')
    
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
