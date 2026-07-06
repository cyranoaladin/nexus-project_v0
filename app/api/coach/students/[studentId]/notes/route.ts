import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCoachRattachedToStudent } from '@/lib/rbac/coach-student-access';
import { z } from 'zod';

const MAX_BODY_LENGTH = 4000;
const routeParamsSchema = z.object({
  studentId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
}).strict();
const createNoteSchema = z.object({
  body: z.string().trim().min(1).max(MAX_BODY_LENGTH),
  pinned: z.boolean().optional().default(false),
}).strict();

/**
 * GET /api/coach/students/[studentId]/notes
 * Lists private notes the authenticated coach wrote about this student.
 * Pinned notes first, then most recent.
 *
 * RBAC: COACH (rattached to the student) or ADMIN.
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

    const parsedParams = routeParamsSchema.safeParse(await context.params);
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

    // A coach only sees their own notes; an admin sees all notes about the student.
    const where =
      role === 'COACH'
        ? { studentId, coachId: session.user.id }
        : { studentId };

    const notes = await prisma.coachNote.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        body: true,
        pinned: true,
        coachId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('[Coach Notes API] GET error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/students/[studentId]/notes
 * Body: { body: string, pinned?: boolean }
 * Creates a private note authored by the calling coach.
 *
 * RBAC: COACH only, rattached to the student.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsedParams = routeParamsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }
    const { studentId } = parsedParams.data;

    const allowed = await isCoachRattachedToStudent(session.user.id, studentId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsedPayload = createNoteSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return NextResponse.json({ error: 'Invalid note payload' }, { status: 400 });
    }
    const data = parsedPayload.data;

    const note = await prisma.coachNote.create({
      data: {
        studentId,
        coachId: session.user.id,
        body: data.body,
        pinned: data.pinned,
      },
      select: {
        id: true,
        body: true,
        pinned: true,
        coachId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('[Coach Notes API] POST error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
