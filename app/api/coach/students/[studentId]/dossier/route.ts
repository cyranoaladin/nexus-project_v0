import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { projectEnrollmentsForDisplay } from '@/lib/curriculum/catalog';
import { isCoachAssignedToStudent } from '@/lib/rbac/coach-student-access';
import { NextResponse } from 'next/server';

/**
 * GET /api/coach/students/[studentId]/dossier
 *
 * Returns the pedagogical dossier of one student for the authenticated coach.
 * RBAC:
 *   - 401 if no session
 *   - 403 if role is not COACH or ADMIN
 *   - 403 if COACH has no active CoachStudentAssignment to this student
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

    // studentId from URL must be a genuine Student.id — no ambiguous
    // fallback to User.id (removed: every canonical route on this branch
    // since Task 7-9 accepts only Student.id in the URL).
    const studentEntity = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true },
    });

    if (!studentEntity) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const studentEntityId = studentEntity.id;
    const studentUserId = studentEntity.userId;

    if (role === 'COACH') {
      const allowed = await isCoachAssignedToStudent({
        coachUserId: session.user.id,
        studentId: studentEntityId,
      });
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
            academicEnrollments: { select: { courseKey: true, kind: true } },
            stmgPathway: true,
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
        // Canonical Student.id (Tâche 13/14) — jamais l'ancien `studentId`
        // (User.id) : une réservation non réconciliée (`studentProfileId`
        // null) n'apparaît plus ici, elle n'appartient à aucun dossier tant
        // qu'elle n'est pas rattachée à l'identité canonique.
        studentProfileId: studentEntityId,
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
      },
    });

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
        // Identité explicite et non ambiguë (Tâche 14) : chaque sous-module
        // du dossier référence l'une ou l'autre — jamais `id` seul, qui ne
        // dit pas laquelle des deux il porte.
        studentId: studentEntityId, // Student.id
        studentUserId: studentUser.id, // User.id
        name: `${studentUser.firstName ?? ''} ${studentUser.lastName ?? ''}`.trim(),
        email: studentUser.email,
        gradeLevel: studentUser.student?.gradeLevel ?? null,
        academicTrack: studentUser.student?.academicTrack ?? null,
        academicCourses: projectEnrollmentsForDisplay(studentUser.student?.academicEnrollments ?? []),
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
    console.error('[Coach Dossier API] Error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
