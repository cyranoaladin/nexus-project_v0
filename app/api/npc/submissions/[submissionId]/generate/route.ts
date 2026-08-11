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
import { withLockedCopySubmission } from '@/lib/npc/submission-lock';
import { NPC_INTERACTIVE_TRANSACTION_OPTIONS } from '@/lib/npc/transaction';
import {
  assertSubmissionAvailable,
  NPC_UNAVAILABLE_CONFLICT,
  SubmissionUnavailableError,
} from '@/lib/npc/unavailable';
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

    if (submission.status === CopySubmissionStatus.UNAVAILABLE) {
      return NextResponse.json(NPC_UNAVAILABLE_CONFLICT, { status: 409 });
    }

    const queued = await prisma.$transaction(async (tx) =>
      withLockedCopySubmission(tx, submissionId, async (locked) => {
        assertSubmissionAvailable(locked);
        const current = await tx.copySubmission.findUniqueOrThrow({
          where: { id: submissionId },
          select: {
            status: true,
            pages: {
              select: {
                id: true,
                documentType: true,
                status: true,
              },
            },
          },
        });
        if (
          current.status === CopySubmissionStatus.QUEUED_FOR_ANALYSIS ||
          current.status === CopySubmissionStatus.ANALYZING ||
          current.status === CopySubmissionStatus.COMPLETED
        ) {
          return { kind: 'already-processing' as const };
        }
        if (!current.pages.some((page) => page.documentType === 'STUDENT_COPY')) {
          return { kind: 'missing-copy' as const };
        }

        const aiJob = await tx.aiProcessingJob.create({
          data: {
            type: AiJobType.PEDAGOGICAL_DIAGNOSIS,
            status: AiJobStatus.PENDING,
            priority: 'NORMAL',
            copySubmissionId: submissionId,
            inputData: JSON.stringify({
              submissionId,
              documentCount: current.pages.length,
              documentTypes: current.pages.map((page) => page.documentType),
            }),
          },
        });
        await tx.copySubmission.update({
          where: { id: submissionId },
          data: {
            status: CopySubmissionStatus.QUEUED_FOR_ANALYSIS,
            aiJobId: aiJob.id,
          },
        });
        await tx.npcAuditLog.create({
          data: {
            actorId: actor.userId,
            actorRole: actor.role,
            action: 'LAUNCH_AI_CORRECTION',
            entityType: 'CopySubmission',
            entityId: submissionId,
            details: {
              jobId: aiJob.id,
              documentCount: current.pages.length,
            },
          },
        });
        return { kind: 'queued' as const, jobId: aiJob.id };
      }),
      NPC_INTERACTIVE_TRANSACTION_OPTIONS,
    );

    if (queued.kind === 'already-processing') {
      return NextResponse.json(
        { error: 'Submission is already being processed or completed' },
        { status: 400 },
      );
    }
    if (queued.kind === 'missing-copy') {
      return NextResponse.json(
        { error: 'At least one student copy is required' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        jobId: queued.jobId,
        status: 'QUEUED_FOR_ANALYSIS',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SubmissionUnavailableError) {
      return NextResponse.json(NPC_UNAVAILABLE_CONFLICT, { status: 409 });
    }
    console.error('[NPC Generate] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
