import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const session = await getServerSession(authOptions);
  const studentId = params.studentId;

  if (!session || (session.user.role !== 'ELEVE' && session.user.role !== 'PARENT')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const studentBadges = await prisma.studentBadge.findMany({
      where: {
        studentId,
      },
      include: {
        badge: true,
      },
      orderBy: { earnedAt: 'desc' },
    });

    const badges = (studentBadges || []).map((sb) => ({
      id: sb.id,
      name: sb.badge?.name || 'Badge',
      description: sb.badge?.description || '',
      category: sb.badge?.category || 'ASSIDUITE',
      icon: sb.badge?.icon || '🏅',
      unlockedAt: sb.earnedAt,
    }));

    return NextResponse.json({ badges });
  } catch (error) {
    console.error(`Error fetching badges for student ${studentId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
