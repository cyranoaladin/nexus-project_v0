export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/assistant/notifications
// Liste les notifications pertinentes pour l'assistante connectée
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [{ userId: session.user.id }, { userRole: 'ASSISTANTE' as any }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const items = notifications.map((n) => ({
      id: n.id,
      userEmail: null,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt,
    }));

    return NextResponse.json({ notifications: items });
  } catch (e) {
    console.error('GET /api/assistant/notifications error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
