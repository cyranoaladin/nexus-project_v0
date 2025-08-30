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

    const studentId = session.user.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Student ID not found in session' }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        documents: true,
        bilans: true,
        bilanPremiumReports: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const now = new Date();

    const [creditBalance, nextSession, recentSessions, totalConversations, studentBadges] = await Promise.all([
      prisma.creditTransaction.aggregate({
        where: { studentId: student.id },
        _sum: { amount: true },
      }),
      prisma.session.findFirst({
        where: {
          studentId: student.id,
          scheduledAt: { gt: now },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] as any },
        },
        orderBy: { scheduledAt: 'asc' },
        include: { coach: { include: { user: true } } },
      }),
      prisma.session.findMany({
        where: { studentId: student.id },
        orderBy: { scheduledAt: 'desc' },
        take: 5,
        include: { coach: { include: { user: true } } },
      }),
      prisma.ariaConversation.count({ where: { studentId: student.id } }),
      prisma.studentBadge.findMany({
        where: { studentId: student.id },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
      }),
    ]);

    const badges = (studentBadges || []).map((sb) => ({
      id: sb.id,
      name: sb.badge?.name || 'Badge',
      description: sb.badge?.description || '',
      icon: sb.badge?.icon || '🏅',
      earnedAt: sb.earnedAt,
    }));

    const recentSessionsMapped = (recentSessions || []).map((s) => ({
      id: s.id,
      subject: s.subject,
      title: s.title,
      scheduledAt: s.scheduledAt,
      duration: s.duration,
      coach: s.coach ? { user: s.coach.user ? { firstName: s.coach.user.firstName, lastName: s.coach.user.lastName } : null } : null,
    }));

    const dashboardData = {
      student: {
        id: student.id,
        firstName: (student as any).firstName || student.user?.firstName,
        lastName: (student as any).lastName || student.user?.lastName,
        email: student.user?.email,
      },
      // New fields consumed by DashboardEleve
      credits: { balance: Number(creditBalance?._sum?.amount || 0) },
      nextSession: nextSession
        ? {
            id: nextSession.id,
            subject: nextSession.subject,
            title: nextSession.title,
            scheduledAt: nextSession.scheduledAt,
            duration: nextSession.duration,
            coach: nextSession.coach
              ? { user: nextSession.coach.user ? { firstName: nextSession.coach.user.firstName, lastName: nextSession.coach.user.lastName } : null }
              : null,
          }
        : null,
      recentSessions: recentSessionsMapped,
      ariaStats: { totalConversations },
      badges,
      // Legacy fields maintained for compatibility
      documents: student.documents,
      bilans: student.bilans,
      bilanPremiumReports: student.bilanPremiumReports,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Error fetching student dashboard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
