export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCoachRattachedToStudent } from '@/lib/rbac/coach-student-access';

const MAX_BODY_LENGTH = 4000;

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
    console.error('[Coach Notes API] GET error:', error);
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

    const { studentId } = await context.params;
    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

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

    const data = payload as { body?: unknown; pinned?: unknown };
    if (typeof data.body !== 'string' || data.body.trim().length === 0) {
      return NextResponse.json({ error: 'body must be a non-empty string' }, { status: 400 });
    }
    if (data.body.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { error: `body too long (max ${MAX_BODY_LENGTH} chars)` },
        { status: 400 },
      );
    }
    const pinned = typeof data.pinned === 'boolean' ? data.pinned : false;

    const note = await prisma.coachNote.create({
      data: {
        studentId,
        coachId: session.user.id,
        body: data.body.trim(),
        pinned,
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
    console.error('[Coach Notes API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
