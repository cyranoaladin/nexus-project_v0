import type { Prisma, Subject } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type SessionWithStudent = Prisma.SessionBookingGetPayload<{
  include: {
    student: true;
  };
}>;

type WeekSession = SessionWithStudent;

type StudentWithCredits = Prisma.StudentGetPayload<{
  include: {
    creditTransactions: true;
  };
}>;

interface RecentBooking {
  studentId: string;
  subject: Subject;
  scheduledDate: Date;
}

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
    const todaysSessions: SessionWithStudent[] = await prisma.sessionBooking.findMany({
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

    const todaySessions = todaysSessions.map((session) => ({
      id: session.id,
      studentName: `${session.student?.firstName ?? ''} ${session.student?.lastName ?? ''}`.trim(),
      subject: session.subject,
      time: `${session.startTime} - ${session.endTime}`,
      type: session.type,
      status: session.status.toLowerCase(),
      scheduledAt: session.scheduledDate,
      duration: session.duration,
    }));

    // Week stats from SessionBooking
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday as start
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekSessionsRaw: WeekSession[] = await prisma.sessionBooking.findMany({
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
    const completedSessions = weekSessionsRaw.filter((session) => session.status === 'COMPLETED').length;
    const upcomingSessions = weekSessionsRaw.filter((session) => ['SCHEDULED', 'CONFIRMED'].includes(session.status)).length;

    const weekSessions = weekSessionsRaw.map((session) => ({
      id: session.id,
      studentId: session.studentId,
      studentName: `${session.student?.firstName ?? ''} ${session.student?.lastName ?? ''}`.trim(),
      subject: session.subject,
      date: session.scheduledDate,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      type: session.type,
      modality: session.modality,
      status: session.status,
      creditsUsed: session.creditsUsed,
      title: session.title,
      description: session.description ?? ''
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

    // Parse subjects from JSON string stored in coach profile
    let specialties: string[] = [];
    try {
      specialties = JSON.parse(coach.subjects || '[]');
    } catch (parseError) {
      console.warn('Coach profile specialties parse failed', parseError);
      specialties = [];
    }

    // Recent students (last 30 days), fetch Student model for credit balance
    const recentBookings = await prisma.sessionBooking.findMany({
      where: {
        coachId: coachUserId,
        scheduledDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { scheduledDate: 'desc' },
      distinct: ['studentId'],
      select: { studentId: true, subject: true, scheduledDate: true }
    }) as RecentBooking[];

    const students: Array<{ id: string; name: string; grade: string | null; subject: string; lastSession: Date; creditBalance: number; isNew: boolean; }> = [];

    for (const rb of recentBookings) {
      const studentUser = await prisma.user.findUnique({ where: { id: rb.studentId } });
      // Find Student entity to compute credits and grade
      const studentEntity = await prisma.student.findFirst({
        where: { userId: rb.studentId },
        include: { creditTransactions: true }
      }) as StudentWithCredits | null;

      const creditBalance = studentEntity?.creditTransactions?.reduce((total, transaction) => total + transaction.amount, 0) ?? 0;

      students.push({
        id: studentEntity?.id ?? rb.studentId,
        name: `${studentUser?.firstName ?? ''} ${studentUser?.lastName ?? ''}`.trim(),
        grade: studentEntity?.grade ?? null,
        subject: rb.subject,
        lastSession: rb.scheduledDate,
        creditBalance,
        isNew: rb.scheduledDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      });
    }

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