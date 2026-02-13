export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const NEW_BADGE_WINDOW_DAYS = 7;

function isRecent(earnedAt: Date): boolean {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - NEW_BADGE_WINDOW_DAYS);
  return earnedAt >= threshold;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { studentId } = await params;

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.id !== studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const studentBadges = await prisma.studentBadge.findMany({
      where: { studentId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });

    const badges = studentBadges.map((sb) => ({
      id: sb.badge.id,
      name: sb.badge.name,
      description: sb.badge.description,
      category: sb.badge.category,
      icon: sb.badge.icon ?? '🏅',
      unlockedAt: sb.earnedAt,
      isNew: isRecent(sb.earnedAt),
    }));

    return NextResponse.json({ badges });
  } catch (error) {
    console.error('[Student Badges API] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
