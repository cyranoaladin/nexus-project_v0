export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCoachRattachedToStudent } from '@/lib/rbac/coach-student-access';

/**
 * GET /api/coach/students/[studentId]/dossier
 *
 * Returns the pedagogical dossier of one student for the authenticated coach.
 * RBAC:
 *   - 401 if no session
 *   - 403 if role is not COACH or ADMIN
 *   - 403 if COACH and not rattached (no SessionBooking) to this student
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== 'COACH' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { studentId } = await context.params;
    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    // studentId from URL is a Student entity ID, resolve the userId
    const studentEntity = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true },
    });

    // Fallback: try treating studentId as a userId (legacy compatibility)
    const resolvedStudentEntity = studentEntity ?? await prisma.student.findUnique({
      where: { userId: studentId },
      select: { id: true, userId: true },
    });

    if (!resolvedStudentEntity) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const studentEntityId = resolvedStudentEntity.id;
    const studentUserId = resolvedStudentEntity.userId;

    if (role === 'COACH') {
      const allowed = await isCoachRattachedToStudent(session.user.id, studentUserId);
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Fetch student (User + Student profile)
    const studentUser = await prisma.user.findUnique({
      where: { id: studentUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        student: {
          select: {
            id: true,
            grade: true,
            gradeLevel: true,
            academicTrack: true,
            specialties: true,
            stmgPathway: true,
            credits: true,
            totalSessions: true,
            completedSessions: true,
          },
        },
      },
    });

    if (!studentUser) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Recent sessions (last 30 days) — only those of the requesting coach
    // unless ADMIN, who sees all sessions.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSessions = await prisma.sessionBooking.findMany({
      where: {
        studentId: studentUserId,
        ...(role === 'COACH' ? { coachId: session.user.id } : {}),
        scheduledDate: { gte: thirtyDaysAgo },
      },
      orderBy: { scheduledDate: 'desc' },
      take: 20,
      select: {
        id: true,
        subject: true,
        scheduledDate: true,
        startTime: true,
        endTime: true,
        status: true,
        type: true,
        modality: true,
        creditsUsed: true,
      },
    });

    // Maths progression (all tracks)
    let mathsProgress: Array<{
      level: string;
      track: string;
      totalXp: number;
      updatedAt: Date;
    }> = [];
    try {
      const rows = await prisma.mathsProgress.findMany({
        where: { userId: studentUserId },
        select: { level: true, track: true, totalXp: true, updatedAt: true },
      });
      mathsProgress = rows.map((r) => ({
        level: String(r.level),
        track: String(r.track),
        totalXp: r.totalXp,
        updatedAt: r.updatedAt,
      }));
    } catch {
      mathsProgress = [];
    }

    // Counts (cheap aggregates) — bilans + ARIA conversations
    let bilansCount = 0;
    try {
      bilansCount = (await prisma.bilan?.count?.({ where: { studentId: studentEntityId } })) ?? 0;
    } catch {
      bilansCount = 0;
    }

    let ariaConversationsCount = 0;
    try {
      ariaConversationsCount =
        (await prisma.ariaConversation?.count?.({
          where: { student: { userId: studentUserId } },
        })) ?? 0;
    } catch {
      ariaConversationsCount = 0;
    }

    return NextResponse.json({
      student: {
        id: studentUser.id,
        name: `${studentUser.firstName ?? ''} ${studentUser.lastName ?? ''}`.trim(),
        email: studentUser.email,
        gradeLevel: studentUser.student?.gradeLevel ?? null,
        academicTrack: studentUser.student?.academicTrack ?? null,
        specialties: studentUser.student?.specialties ?? [],
        stmgPathway: studentUser.student?.stmgPathway ?? null,
        nexusIndex: null, // computed from mathsProgress if available
        status: 'STABLE',
      },
      progressionHistory: [],
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        date: s.scheduledDate.toISOString(),
        subject: String(s.subject),
        notes: null,
        rapportUrl: null,
      })),
      pedagogicalAlerts: [],
      verbatims: [],
      ragSources: [],
      notes: [],
      bilanCount: bilansCount,
      ariaConversationCount: ariaConversationsCount,
    });
  } catch (error) {
    console.error('[Coach Dossier API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
