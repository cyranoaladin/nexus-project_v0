import { serializeError } from '@/lib/utils/serialize-error';
// ═══════════════════════════════════════════════════════════════════════════════
// API Route: NPC Generate Correction
// Launch AI correction for a submission
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CopySubmissionStatus, UserRole, AiJobType, AiJobStatus } from '@prisma/client';
import { canManageSubmissionDocuments } from '@/lib/npc/access';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ submissionId: string }>;
}

const routeParamsSchema = z.object({
  submissionId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
}).strict();

function invalidParamsResponse() {
  return NextResponse.json({ error: 'Invalid route params' }, { status: 400 });
}

async function getActor() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  return {
    userId: session.user.id,
    role: session.user.role as UserRole,
  };
}

// POST /api/npc/submissions/[submissionId]/generate - Launch AI correction
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await getActor();
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return invalidParamsResponse();
    const { submissionId } = parsedParams.data;
    const submission = await prisma.copySubmission.findUnique({
      where: { id: submissionId },
      include: {
        pages: {
          select: {
            id: true,
            documentType: true,
            status: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (!(await canManageSubmissionDocuments(actor, submission))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if submission is already processing or completed
    if (
      submission.status === CopySubmissionStatus.QUEUED_FOR_ANALYSIS ||
      submission.status === CopySubmissionStatus.ANALYZING ||
      submission.status === CopySubmissionStatus.COMPLETED
    ) {
      return NextResponse.json(
        { error: 'Submission is already being processed or completed' },
        { status: 400 }
      );
    }

    // Check if there's at least one student copy
    const studentCopies = submission.pages.filter((page) => page.documentType === 'STUDENT_COPY');
    if (studentCopies.length === 0) {
      return NextResponse.json(
        { error: 'At least one student copy is required' },
        { status: 400 }
      );
    }

    // Create AI processing job
    const aiJob = await prisma.aiProcessingJob.create({
      data: {
        type: AiJobType.PEDAGOGICAL_DIAGNOSIS,
        status: AiJobStatus.PENDING,
        priority: 'NORMAL',
        inputData: JSON.stringify({
          submissionId: submission.id,
          documentCount: submission.pages.length,
          documentTypes: submission.pages.map((p) => p.documentType),
        }),
      },
    });

    // Update submission status
    await prisma.copySubmission.update({
      where: { id: submissionId },
      data: {
        status: CopySubmissionStatus.QUEUED_FOR_ANALYSIS,
        aiJobId: aiJob.id,
      },
    });

    // Create audit log
    await prisma.npcAuditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'LAUNCH_AI_CORRECTION',
        entityType: 'CopySubmission',
        entityId: submissionId,
        details: JSON.stringify({
          jobId: aiJob.id,
          documentCount: submission.pages.length,
        }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        jobId: aiJob.id,
        status: 'QUEUED_FOR_ANALYSIS',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[NPC Generate] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
