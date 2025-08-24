import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Marquer comme dynamique

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }

    // Récupérer toutes les conversations de l'utilisateur
    const conversations = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: session.user.id },
          { receiverId: session.user.id }
        ]
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Grouper par conversation (paire d'utilisateurs)
    const conversationMap = new Map();

    conversations.forEach(message => {
      const otherUserId = message.senderId === session.user.id
        ? message.receiverId
        : message.senderId;

      const otherUser = message.senderId === session.user.id
        ? message.receiver
        : message.sender;

      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          user: otherUser,
          lastMessage: message,
          unreadCount: 0
        });
      }

      // Compter les messages non lus
      if (message.receiverId === session.user.id && !message.readAt) {
        conversationMap.get(otherUserId).unreadCount++;
      }
    });

    const conversationsList = Array.from(conversationMap.values());

    return NextResponse.json({
      success: true,
      conversations: conversationsList
    });

  } catch (error) {
    console.error('Erreur récupération conversations:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
