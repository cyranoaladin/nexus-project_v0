import { serializeError } from '@/lib/utils/serialize-error';
// ═══════════════════════════════════════════════════════════════════════════════
// API Route: NPC Submissions
// Create new copy submissions with RBAC
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Subject, GradeLevel, CopySubmissionStatus } from '@prisma/client';
import { z } from 'zod';
// No checkPermission import

const safeIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/);

const createSubmissionBodySchema = z.object({
  studentId: safeIdSchema,
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional(),
  subject: z.nativeEnum(Subject),
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
}).strict();

const listSubmissionsQuerySchema = z.object({
  studentId: safeIdSchema.optional(),
  status: z.nativeEnum(CopySubmissionStatus).optional(),
}).strict();

interface CreateSubmissionBody {
  studentId: string;
  title: string;
  description?: string;
  subject: Subject;
  gradeLevel?: GradeLevel;
}

function sanitizeSubmission(submission: Record<string, unknown>) {
  const {
    storedFilePath: _storedFilePath,
    ocrText: _ocrText,
    ocrError: _ocrError,
    aiJob: _aiJob,
    report: _report,
    ...safeSubmission
  } = submission;

  if (safeSubmission.student && typeof safeSubmission.student === 'object') {
    const student = safeSubmission.student as Record<string, unknown>;
    safeSubmission.student = {
      id: student.id,
      user: student.user,
    };
  }

  return safeSubmission;
}

// POST /api/npc/submissions - Create new submission
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission
    const allowedRoles = ['COACH', 'ADMIN', 'ASSISTANTE'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const parsedBody = createSubmissionBodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    const body = parsedBody.data as CreateSubmissionBody;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: body.studentId },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // For coaches: verify they are assigned to this student
    if (session.user.role === 'COACH') {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!coach) {
        return NextResponse.json(
          { error: 'Coach profile not found' },
          { status: 403 }
        );
      }

      const assignment = await prisma.coachStudentAssignment.findFirst({
        where: {
          coachId: coach.id,
          studentId: body.studentId,
        },
      });

      if (!assignment) {
        return NextResponse.json(
          { error: 'Not assigned to this student' },
          { status: 403 }
        );
      }
    }

    // Create submission
    const submission = await prisma.copySubmission.create({
      data: {
        studentId: body.studentId,
        coachId: session.user.role === 'COACH'
          ? (await prisma.coachProfile.findUnique({ where: { userId: session.user.id } }))?.id
          : undefined,
        title: body.title,
        description: body.description,
        subject: body.subject,
        gradeLevel: body.gradeLevel || undefined,
        status: CopySubmissionStatus.PENDING_UPLOAD,
      },
    });

    // Create audit log
    await prisma.npcAuditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: 'CREATE_SUBMISSION',
        entityType: 'CopySubmission',
        entityId: submission.id,
        details: JSON.stringify({
          studentId: body.studentId,
          title: body.title,
          subject: body.subject,
        }),
      },
    });

    return NextResponse.json(
      { submission: sanitizeSubmission(submission as unknown as Record<string, unknown>) },
      { status: 201 }
    );
  } catch (error) {
    console.error('NPC submissions API error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/npc/submissions - List submissions (for current user)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const allowedRoles = ['COACH', 'ADMIN', 'ASSISTANTE', 'ELEVE', 'PARENT'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const parsedQuery = listSubmissionsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    const { studentId, status } = parsedQuery.data;

    const where: Record<string, unknown> = {};

    // Filter by student if provided
    if (studentId) {
      where.studentId = studentId;
    }

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Role-based filtering
    if (session.user.role === 'COACH') {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!coach) {
        return NextResponse.json({ submissions: [] });
      }

      // Get assigned students
      const assignments = await prisma.coachStudentAssignment.findMany({
        where: { coachId: coach.id },
        select: { studentId: true },
      });

      where.OR = [
        { coachId: coach.id },
        { studentId: { in: assignments.map(a => a.studentId) } },
      ];
    } else if (session.user.role === 'ELEVE') {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
      });

      if (!student) {
        return NextResponse.json({ submissions: [] });
      }

      where.studentId = student.id;
    } else if (session.user.role === 'PARENT') {
      // Parents see their children's submissions
      const parent = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: { select: { id: true } } },
      });

      if (!parent) {
        return NextResponse.json({ submissions: [] });
      }

      where.studentId = { in: parent.children.map(s => s.id) };
    }

    const submissions = await prisma.copySubmission.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        studentId: true,
        coachId: true,
        subject: true,
        gradeLevel: true,
        title: true,
        description: true,
        sourceType: true,
        sourceId: true,
        status: true,
        fileSizeBytes: true,
        mimeType: true,
        student: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      submissions: submissions.map((submission) =>
        sanitizeSubmission(submission as unknown as Record<string, unknown>)
      ),
    });
  } catch (error) {
    console.error('NPC submissions API error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
