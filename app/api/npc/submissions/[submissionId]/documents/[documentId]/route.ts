import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CopySubmissionStatus, UserRole } from '@prisma/client';
import { deleteSecureFile } from '@/lib/npc/storage';
import { canManageSubmissionDocuments } from '@/lib/npc/access';
import { isCorrectionDocumentType } from '@/lib/npc/document-types';

interface RouteParams {
  params: Promise<{ submissionId: string; documentId: string }>;
}

function sanitizeCopyPage(page: Record<string, unknown>) {
  const {
    originalFilePath: _originalFilePath,
    convertedFilePaths: _convertedFilePaths,
    ocrText: _ocrText,
    ...safePage
  } = page;

  return safePage;
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

export async function PATCH(
  request: NextRequest,
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
      select: { id: true, studentId: true, coachId: true, pages: true },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (!(await canManageSubmissionDocuments(actor, submission))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const document = await prisma.copyPage.findFirst({
      where: { id: documentId, submissionId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const body = await request.json();
    const { documentType } = body;

    if (!documentType || !isCorrectionDocumentType(documentType)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }

    const updatedDocument = await prisma.copyPage.update({
      where: { id: document.id },
      data: { documentType },
    });

    // Update submission status if needed
    // Calculate status with the NEW document type included
    const allDocumentTypes = [
      ...submission.pages.filter((p) => p.id !== document.id).map((p) => p.documentType),
      documentType,
    ];
    const hasStudentCopy = allDocumentTypes.includes('STUDENT_COPY');
    const hasMinimalContext =
      allDocumentTypes.includes('SUBJECT') ||
      allDocumentTypes.includes('GRADING_RUBRIC') ||
      allDocumentTypes.includes('GRADING_INSTRUCTIONS');

    await prisma.copySubmission.update({
      where: { id: submissionId },
      data: {
        status:
          hasStudentCopy && hasMinimalContext
            ? CopySubmissionStatus.READY_FOR_AI
            : CopySubmissionStatus.UPLOADED,
      },
    });

    await prisma.npcAuditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'UPDATE_DOCUMENT_TYPE',
        entityType: 'CopyPage',
        entityId: document.id,
        details: JSON.stringify({
          oldType: document.documentType,
          newType: documentType,
        }),
      },
    });

    return NextResponse.json({
      document: sanitizeCopyPage(updatedDocument as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error('[NPC Documents] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
