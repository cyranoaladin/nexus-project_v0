export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { AcademicTrack } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCoachRattachedToStudent } from '@/lib/rbac/coach-student-access';

const ALLOWED_ROLES = new Set(['COACH', 'ADMIN', 'ASSISTANTE']);
const MAX_REASON_LENGTH = 1000;

type SurvivalModePayload = {
  enabled?: unknown;
  reason?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { studentId } = await context.params;
    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    if (role === 'COACH') {
      const allowed = await isCoachRattachedToStudent(session.user.id, studentId);
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let payload: SurvivalModePayload;
    try {
      payload = (await request.json()) as SurvivalModePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (typeof payload.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : null;
    if (reason && reason.length > MAX_REASON_LENGTH) {
      return NextResponse.json({ error: `reason too long (max ${MAX_REASON_LENGTH} chars)` }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: studentId },
      select: {
        id: true,
        userId: true,
        academicTrack: true,
        survivalMode: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const isStmg =
      student.academicTrack === AcademicTrack.STMG ||
      student.academicTrack === AcademicTrack.STMG_NON_LYCEEN;

    if (payload.enabled && !isStmg) {
      return NextResponse.json({ error: 'Survival mode is only available for STMG students' }, { status: 400 });
    }

    const now = new Date();
    const updated = await prisma.student.update({
      where: { userId: studentId },
      data: {
        survivalMode: payload.enabled,
        survivalModeReason: payload.enabled ? reason : null,
        survivalModeBy: session.user.id,
        survivalModeAt: now,
      },
      select: {
        id: true,
        userId: true,
        survivalMode: true,
        survivalModeReason: true,
        survivalModeBy: true,
        survivalModeAt: true,
      },
    });

    await prisma.coachNote.create({
      data: {
        studentId,
        coachId: session.user.id,
        pinned: payload.enabled,
        body: [
          `Mode Survie ${payload.enabled ? 'active' : 'desactive'}.`,
          reason ? `Motif pedagogique : ${reason}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[Survival Mode API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
