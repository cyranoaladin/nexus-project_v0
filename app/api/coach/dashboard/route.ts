export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day; // Monday as first day
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isTestEnv = process.env.NODE_ENV === 'test';
    const allowBypass = !isTestEnv && (process.env.E2E === '1' || process.env.E2E_RUN === '1' || process.env.NEXT_PUBLIC_E2E === '1' || process.env.NODE_ENV === 'development');
    let coachUserId: string | null = null;
    if (!session || session.user.role !== 'COACH') {
      if (!allowBypass) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // E2E/dev fallback: pick any coach profile
      const anyCoach = await prisma.coachProfile.findFirst({ orderBy: { createdAt: 'asc' } });
      coachUserId = anyCoach?.userId ?? null;
      if (!coachUserId) {
        return NextResponse.json({
          coach: { id: 'mock-coach', pseudonym: 'Coach Démo', specialties: [] },
          weekStats: { totalSessions: 0, completedSessions: 0, upcomingSessions: 0 },
          weekSessions: [],
          todaySessions: [],
          uniqueStudentsCount: 0,
          students: [],
        });
      }
    } else {
      coachUserId = session.user.id;
    }
    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: coachUserId } });
    if (!coachProfile) {
      if (allowBypass) {
        return NextResponse.json({
          coach: { id: 'mock-coach', pseudonym: 'Coach Démo', specialties: [] },
          weekStats: { totalSessions: 0, completedSessions: 0, upcomingSessions: 0 },
          weekSessions: [],
          todaySessions: [],
          uniqueStudentsCount: 0,
          students: [],
        });
      }
      return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const { monday, sunday } = getWeekRange(now);

    const [weekBookings, todayBookings, distinctStudents] = await Promise.all([
      prisma.sessionBooking.findMany({
        where: { coachId: coachUserId, scheduledDate: { gte: monday, lte: sunday } },
        include: { student: true },
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma.sessionBooking.findMany({
        where: { coachId: coachUserId, scheduledDate: { gte: todayStart, lte: todayEnd } },
        include: { student: true },
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma.sessionBooking.findMany({
        where: { coachId: coachUserId },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
    ]);

    const weekStats = {
      totalSessions: weekBookings.length,
      completedSessions: weekBookings.filter(s => s.status === 'COMPLETED').length,
      upcomingSessions: weekBookings.filter(s => s.status === 'SCHEDULED' || s.status === 'CONFIRMED').length,
    };

    const weekSessions = weekBookings.map((s) => ({
      id: s.id,
      title: s.title,
      subject: s.subject,
      type: s.type,
      modality: s.modality,
      studentName: `${s.student.firstName ?? ''} ${s.student.lastName ?? ''}`.trim(),
      date: s.scheduledDate,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      status: s.status,
      creditsUsed: s.creditsUsed,
      description: s.description ?? null,
    }));

    const todaySessions = todayBookings.map((s) => ({
      id: s.id,
      studentName: `${s.student.firstName ?? ''} ${s.student.lastName ?? ''}`.trim(),
      type: s.type,
      subject: s.subject,
      time: `${s.startTime} - ${s.endTime}`,
      status: s.status.toLowerCase(),
    }));

    // Build students list from recent sessions
    const uniqueStudentUserIds = Array.from(new Set(weekBookings.map(s => s.studentId)));

    let students: any[] = [];
    if (uniqueStudentUserIds.length > 0) {
      const [studentsUsers, studentsModels, lastSessionsByStudent] = await Promise.all([
        prisma.user.findMany({ where: { id: { in: uniqueStudentUserIds } } }),
        prisma.student.findMany({ where: { userId: { in: uniqueStudentUserIds } } }),
        prisma.sessionBooking.groupBy({
          by: ['studentId'],
          where: { coachId: coachUserId },
          _max: { scheduledDate: true },
        }),
      ]);

      const userMap = new Map(studentsUsers.map(u => [u.id, u]));
      const studentModelMap = new Map(studentsModels.map(s => [s.userId, s]));
      const lastMap = new Map(lastSessionsByStudent.map(r => [r.studentId, r._max.scheduledDate]));

      // credit balances: group by Student id
      const studentIds = studentsModels.map(s => s.id);
      const creditAgg = studentIds.length > 0 ? await prisma.creditTransaction.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds } },
        _sum: { amount: true },
      }) : [];
      const creditMap = new Map(creditAgg.map(c => [c.studentId, Number(c._sum.amount || 0)]));

      students = uniqueStudentUserIds.map((userId, index) => {
        const user = userMap.get(userId);
        const student = studentModelMap.get(userId);
        const lastSession = lastMap.get(userId) || null;
        if (!student) return null;
        return {
          id: student.id,
          name: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Élève',
          grade: student.grade || 'N/A',
          isNew: !!lastSession && (new Date().getTime() - new Date(lastSession).getTime()) < 1000 * 60 * 60 * 24 * 14,
          subject: weekBookings.find(s => s.studentId === userId)?.subject || 'MATHEMATIQUES',
          lastSession: lastSession || new Date(0),
          creditBalance: creditMap.get(student.id) || 0,
        };
      }).filter(Boolean) as any[];
    }

    let specialties: string[] = [];
    try {
      specialties = JSON.parse(coachProfile.subjects || '[]');
      if (!Array.isArray(specialties)) specialties = [];
    } catch {
      specialties = [];
    }

    const response = {
      coach: {
        id: coachProfile.id,
        pseudonym: coachProfile.pseudonym,
        specialties,
      },
      weekStats,
      weekSessions,
      todaySessions,
      uniqueStudentsCount: students.length,
      students,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching coach dashboard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
