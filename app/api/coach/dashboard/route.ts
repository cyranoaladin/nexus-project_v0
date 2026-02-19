export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseSubjects } from '@/lib/utils/subjects';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'COACH') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const coachUserId = session.user.id;

    // Fetch coach profile + user
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: coachUserId },
      include: {
        user: true,
      }
    });

    if (!coach) {
      return NextResponse.json(
        { error: 'Coach profile not found' },
        { status: 404 }
      );
    }

    // Time helpers
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Today's sessions from SessionBooking
    const todaysSessions = await prisma.sessionBooking.findMany({
      where: {
        coachId: coachUserId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] }
      },
      include: {
        student: true, // User
      },
      orderBy: [{ startTime: 'asc' }]
    });

    const todaySessions = todaysSessions.map((s) => ({
      id: s.id,
      studentName: `${s.student?.firstName ?? ''} ${s.student?.lastName ?? ''}`.trim(),
      subject: s.subject,
      time: `${s.startTime} - ${s.endTime}`,
      type: s.type, // INDIVIDUAL | GROUP | MASTERCLASS
      status: s.status.toLowerCase(),
      scheduledAt: s.scheduledDate,
      duration: s.duration,
    }));

    // Week stats from SessionBooking
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday as start
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekSessionsRaw = await prisma.sessionBooking.findMany({
      where: {
        coachId: coachUserId,
        scheduledDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      include: {
        student: true,
      },
      orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }]
    });

    const totalSessions = weekSessionsRaw.length;
    const completedSessions = weekSessionsRaw.filter((s) => s.status === 'COMPLETED').length;
    const upcomingSessions = weekSessionsRaw.filter((s) => ['SCHEDULED', 'CONFIRMED'].includes(s.status)).length;

    const weekSessions = weekSessionsRaw.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      studentName: `${s.student?.firstName ?? ''} ${s.student?.lastName ?? ''}`.trim(),
      subject: s.subject,
      date: s.scheduledDate,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      type: s.type,
      modality: s.modality,
      status: s.status,
      creditsUsed: s.creditsUsed,
      title: s.title,
      description: s.description ?? ''
    }));

    // Unique students this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const uniqueStudentBookings = await prisma.sessionBooking.findMany({
      where: {
        coachId: coachUserId,
        scheduledDate: { gte: monthStart },
      },
      select: { studentId: true },
      distinct: ['studentId']
    });

    // Subjects is a Json field — parse safely via shared utility
    const specialties: string[] = parseSubjects(coach.subjects);

    // Recent students (last 30 days) — single query with includes to avoid N+1
    const recentBookings = await prisma.sessionBooking.findMany({
      where: {
        coachId: coachUserId,
        scheduledDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { scheduledDate: 'desc' },
      distinct: ['studentId'],
      select: {
        studentId: true,
        subject: true,
        scheduledDate: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            student: { select: { grade: true } }
          }
        }
      }
    });

    // Batch fetch credit balances for all student IDs in one query
    const studentUserIds = recentBookings.map(rb => rb.studentId);
    const studentEntities = await prisma.student.findMany({
      where: { userId: { in: studentUserIds } },
      include: { creditTransactions: { select: { amount: true } } }
    });
    const creditMap = new Map(
      studentEntities.map(se => [
        se.userId,
        { id: se.id, grade: se.grade, balance: se.creditTransactions.reduce((t, tr) => t + tr.amount, 0) }
      ])
    );

    const students = recentBookings.map(rb => {
      const entity = creditMap.get(rb.studentId);
      return {
        id: entity?.id ?? rb.studentId,
        name: `${rb.student?.firstName ?? ''} ${rb.student?.lastName ?? ''}`.trim(),
        grade: entity?.grade ?? rb.student?.student?.grade ?? null,
        subject: rb.subject,
        lastSession: rb.scheduledDate,
        creditBalance: entity?.balance ?? 0,
        isNew: rb.scheduledDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      };
    });

    const dashboardData = {
      coach: {
        id: coach.id,
        pseudonym: coach.pseudonym,
        tag: coach.tag,
        firstName: coach.user.firstName,
        lastName: coach.user.lastName,
        email: coach.user.email,
        specialties
      },
      todaySessions,
      weekStats: {
        totalSessions,
        completedSessions,
        upcomingSessions
      },
      weekSessions,
      students,
      uniqueStudentsCount: uniqueStudentBookings.length
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching coach dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
