export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const coachUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { coachProfile: true },
    });
    if (!coachUser?.coachProfile) {
      return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 });
    }
    const coachId = coachUser.coachProfile.id;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [todaySessionsRaw, weekSessionsRaw] = await Promise.all([
      prisma.session.findMany({
        where: { coachId, scheduledAt: { gte: startOfDay, lte: endOfDay } },
        include: { student: { include: { user: true } } },
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.session.findMany({
        where: { coachId, scheduledAt: { gte: weekStart, lt: weekEnd } },
        include: { student: { include: { user: true } } },
        orderBy: { scheduledAt: 'asc' },
      }),
    ]);

    const todaySessions = todaySessionsRaw.map(s => ({
      id: s.id,
      studentName: `${s.student?.user?.firstName ?? ''} ${s.student?.user?.lastName ?? ''}`.trim(),
      subject: s.subject,
      time: new Date(s.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type: s.type,
      status: s.status.toLowerCase(),
      scheduledAt: s.scheduledAt.toISOString(),
      duration: s.duration,
    }));

    const weekStats = {
      totalSessions: weekSessionsRaw.length,
      completedSessions: weekSessionsRaw.filter(s => s.status === 'COMPLETED').length,
      upcomingSessions: weekSessionsRaw.filter(s => ['SCHEDULED', 'CONFIRMED'].includes(s.status)).length,
    };

    // Optimisation N+1: Récupérer tous les élèves uniques et leurs crédits en une seule fois.
    const uniqueStudentIds = [...new Set(weekSessionsRaw.map(s => s.studentId).filter(Boolean))] as string[];
    const studentsWithCredits = await prisma.student.findMany({
      where: { id: { in: uniqueStudentIds } },
      include: {
        user: true,
        creditTransactions: { select: { amount: true } },
      },
    });

    const studentDataMap = new Map(studentsWithCredits.map(s => [s.id, {
      name: `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.trim(),
      grade: s.grade,
      creditBalance: s.creditTransactions.reduce((sum, t) => sum + t.amount, 0),
    }]));

    const students = weekSessionsRaw.map(s => ({
      id: s.studentId!,
      name: studentDataMap.get(s.studentId!)?.name ?? 'Élève inconnu',
      grade: studentDataMap.get(s.studentId!)?.grade ?? 'N/A',
      creditBalance: studentDataMap.get(s.studentId!)?.creditBalance ?? 0,
      subject: s.subject,
      lastSession: s.scheduledAt.toISOString(),
      isNew: new Date(s.scheduledAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    }));

    const dashboardData = {
      coach: {
        id: coachUser.coachProfile.id,
        pseudonym: coachUser.coachProfile.pseudonym,
        tag: coachUser.coachProfile.tag,
        firstName: coachUser.firstName,
        lastName: coachUser.lastName,
        email: coachUser.email,
        specialties: JSON.parse(coachUser.coachProfile.subjects || '[]'),
      },
      todaySessions,
      weekStats,
      weekSessions: weekSessionsRaw,
      students,
      uniqueStudentsCount: uniqueStudentIds.length,
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching coach dashboard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
