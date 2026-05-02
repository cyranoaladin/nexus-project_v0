import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CopySubmissionStatus, UserRole } from '@prisma/client';
import { deleteSecureFile } from '@/lib/npc/storage';
import { canManageSubmissionDocuments } from '@/lib/npc/access';

interface RouteParams {
  params: Promise<{ submissionId: string; documentId: string }>;
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

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await getActor();
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { submissionId, documentId } = await params;
    const submission = await prisma.copySubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, studentId: true, coachId: true },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (!(await canManageSubmissionDocuments(actor, submission))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const document = await prisma.copyPage.findFirst({
      where: { id: documentId, submissionId },
      select: { id: true, originalFilePath: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await prisma.copyPage.delete({ where: { id: document.id } });
    await deleteSecureFile(document.originalFilePath);

    const remainingStudentCopies = await prisma.copyPage.findFirst({
      where: { submissionId, documentType: 'STUDENT_COPY' },
      select: { id: true },
    });

    if (!remainingStudentCopies) {
      await prisma.copySubmission.update({
        where: { id: submissionId },
        data: {
          status: CopySubmissionStatus.PENDING_UPLOAD,
          storedFilePath: null,
          fileSizeBytes: null,
          mimeType: null,
        },
      });
    }

    await prisma.npcAuditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'DELETE_CORRECTION_DOCUMENT',
        entityType: 'CopyPage',
        entityId: document.id,
        details: JSON.stringify({ submissionId }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NPC Documents] Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
