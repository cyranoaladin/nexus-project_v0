import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const updateNotificationSchema = z.object({
  action: z.enum(['markAsRead', 'markAllAsRead']),
  notificationId: z.string().min(1).optional(),
}).refine(
  (data) => data.action === 'markAllAsRead' || Boolean(data.notificationId),
  {
    message: 'notificationId requis pour markAsRead',
    path: ['notificationId'],
  }
);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '10', 10);
    const limit = Number.isNaN(parsedLimit) ? 10 : parsedLimit;

    const whereClause: Prisma.NotificationWhereInput = {
      userId: session.user.id
    };

    if (unreadOnly) {
      whereClause.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        read: false
      }
    });

    return NextResponse.json({
      notifications: notifications,
      unreadCount: unreadCount
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationId, action } = updateNotificationSchema.parse(body);

    if (action === 'markAsRead' && notificationId) {
      await prisma.notification.update({
        where: {
          id: notificationId,
          userId: session.user.id
        },
        data: {
          read: true
        }
      });
    } else if (action === 'markAllAsRead') {
      await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          read: false
        },
        data: {
          read: true
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Notification updated successfully'
    });

  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 