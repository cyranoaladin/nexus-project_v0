export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        user: true,
        sessions: {
          orderBy: { scheduledAt: 'desc' },
          take: 5,
          include: { coach: { include: { user: true } } },
        },
        _count: {
          select: { ariaConversations: true },
        },
        badges: { include: { badge: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const creditBalance = await prisma.creditTransaction.aggregate({
      where: { studentId: student.id },
      _sum: { amount: true },
    });

    const dashboardData = {
      student: {
        id: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        grade: student.grade,
        school: student.school,
      },
      credits: {
        balance: creditBalance._sum.amount || 0,
        transactions: [], // Simplifié
      },
      nextSession: student.sessions.find((s) => new Date(s.scheduledAt) > new Date()) || null,
      recentSessions: student.sessions,
      ariaStats: {
        messagesToday: 0, // Simplifié
        totalConversations: student._count.ariaConversations,
      },
      badges: student.badges.map((sb) => ({
        id: sb.badge.id,
        name: sb.badge.name,
        description: sb.badge.description,
        category: sb.badge.category,
        icon: sb.badge.icon,
        earnedAt: sb.earnedAt,
      })),
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Error fetching student dashboard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
