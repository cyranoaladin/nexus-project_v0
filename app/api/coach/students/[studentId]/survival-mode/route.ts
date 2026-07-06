import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { AcademicTrack } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCoachRattachedToStudent } from '@/lib/rbac/coach-student-access';
import { z } from 'zod';

const ALLOWED_ROLES = new Set(['COACH', 'ADMIN', 'ASSISTANTE']);
const MAX_REASON_LENGTH = 1000;
const survivalModeParamsSchema = z.object({
  studentId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
}).strict();
const survivalModePayloadSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().max(MAX_REASON_LENGTH).optional().nullable(),
}).strict();

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

    const parsedParams = survivalModeParamsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }
    const { studentId } = parsedParams.data;

    if (role === 'COACH') {
      const allowed = await isCoachRattachedToStudent(session.user.id, studentId);
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const parsedPayload = survivalModePayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsedPayload.success) {
      return NextResponse.json({ error: 'Invalid survival mode payload' }, { status: 400 });
    }
    const payload = parsedPayload.data;
    const reason = payload.reason ?? null;

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
    console.error('[Survival Mode API] POST error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
