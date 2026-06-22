export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { parseSubjects } from '@/lib/utils/subjects';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
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
      status: s.status,
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
            student: { select: { id: true, grade: true } }
          }
        }
      }
    });

    // Also fetch all assigned students via the CoachStudentAssignment system
    const activeAssignments = await prisma.coachStudentAssignment.findMany({
      where: {
        coachId: coach.id,
        status: 'ACTIVE',
        startsAt: { lte: new Date() },
        OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }]
      },
      include: {
        student: {
          include: {
            user: true
          }
        }
      }
    });

    const studentMap = new Map<string, any>();

    // 1. Add assigned students
    for (const a of activeAssignments) {
      if (a.student && a.student.user) {
        studentMap.set(a.student.id, {
          id: a.student.id,
          userId: a.student.userId,
          name: `${a.student.user.firstName ?? ''} ${a.student.user.lastName ?? ''}`.trim(),
          grade: a.student.grade || 'Général',
          gradeLevel: a.student.gradeLevel,
          academicTrack: a.student.academicTrack,
          subject: a.subjects.join(', ') || 'Général',
          lastSession: a.createdAt,
          creditBalance: a.student.credits ?? 0,
          isNew: a.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        });
      }
    }

    // 2. Overlay with recent bookings
    for (const rb of recentBookings) {
      const entityId = rb.student?.student?.id || rb.studentId;
      const existing = studentMap.get(entityId);
      
      if (existing) {
        existing.subject = rb.subject || existing.subject;
        existing.lastSession = rb.scheduledDate;
        existing.isNew = rb.scheduledDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (rb.student) {
        const studentProfile = await prisma.student.findUnique({ where: { userId: rb.studentId } });
        studentMap.set(entityId, {
          id: entityId,
          userId: rb.studentId,
          name: `${rb.student.firstName ?? ''} ${rb.student.lastName ?? ''}`.trim(),
          grade: studentProfile?.grade || rb.student.student?.grade || 'Général',
          gradeLevel: studentProfile?.gradeLevel || 'PREMIERE',
          academicTrack: studentProfile?.academicTrack || 'EDS_GENERALE',
          subject: rb.subject,
          lastSession: rb.scheduledDate,
          creditBalance: studentProfile?.credits ?? 0,
          isNew: rb.scheduledDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        });
      }
    }

    const studentsMerged = Array.from(studentMap.values());
    const studentUserIds = studentsMerged.map(s => s.userId);

    // Fetch MathsProgress for all students in one query
    const studentMathsProgress = await prisma.mathsProgress.findMany({
      where: { userId: { in: studentUserIds } },
      select: { userId: true, totalXp: true, updatedAt: true }
    });
    const mathsMap = new Map(studentMathsProgress.map(mp => [mp.userId, mp]));

    const students = studentsMerged.map(s => {
      const mProgress = mathsMap.get(s.userId);
      const nexusIndex = mProgress ? Math.min(100, Math.round(mProgress.totalXp / 50)) : null;

      // Status logic
      let status: 'STABLE' | 'WARNING' | 'CRITICAL' = 'STABLE';
      if (nexusIndex && nexusIndex < 30) status = 'CRITICAL';
      else if (nexusIndex && nexusIndex < 50) status = 'WARNING';
      
      const lastActivity = mProgress?.updatedAt || s.lastSession;
      if (lastActivity) {
        const daysSinceLastActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastActivity > 10) status = 'CRITICAL';
      }

      return {
        ...s,
        nexusIndex,
        status,
      };
    });

    // Fetch pending bilans for these students
    const pendingBilans = await prisma.bilan.findMany({
      where: {
        studentId: { in: students.map(s => s.id) },
        status: 'SCORING',
        type: 'DIAGNOSTIC_PRE_STAGE'
      },
      select: { studentId: true }
    });
    const pendingBilanStudentIds = new Set(pendingBilans.map(b => b.studentId));

    // Update students with pendingBilan flag
    const studentsWithBilanFlag = students.map(s => ({
      ...s,
      hasPendingBilan: pendingBilanStudentIds.has(s.id)
    }));

    const alerts = studentsWithBilanFlag.filter(s => s.status !== 'STABLE' || s.hasPendingBilan).map(s => {

      if (s.hasPendingBilan) {

        return {
          id: `bilan-${s.id}`,
          studentName: s.name,
          studentId: s.id,
          message: 'Bilan diagnostic Maths Terminale à corriger.',
          type: 'BILAN_PENDING',
          priority: 'HIGH'
        };
      }
      return {
        id: `alert-${s.id}`,
        studentName: s.name,
        studentId: s.id,
        message: s.status === 'CRITICAL' ? 'Retard critique ou score faible.' : 'Baisse d\'activité détectée.',
        type: s.status === 'CRITICAL' ? 'STAGNATION' : 'ABSENCE',
        priority: s.status === 'CRITICAL' ? 'HIGH' : 'MEDIUM'
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
      students: studentsWithBilanFlag,
      alerts,

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
