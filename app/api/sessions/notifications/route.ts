import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  extractSessionNotificationQuery,
  mapSessionNotificationToResponse,
  normalizeSessionNotificationQuery,
  sessionNotificationResponseInclude,
} from '../contracts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = extractSessionNotificationQuery(searchParams);

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const { status, limit } = normalizeSessionNotificationQuery(parsedQuery.data);

    const notifications = await prisma.sessionNotification.findMany({
      where: {
        userId: session.user.id,
        ...(status ? { status } : {}),
      },
      include: sessionNotificationResponseInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      notifications: notifications.map(mapSessionNotificationToResponse),
    });
  } catch (error) {
    console.error('Fetch session notifications error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
