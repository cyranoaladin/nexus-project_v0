import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CopySubmissionStatus, UserRole } from '@prisma/client';
import { deleteSecureFile } from '@/lib/npc/storage';
import { canManageSubmissionDocuments } from '@/lib/npc/access';
import { isCorrectionDocumentType } from '@/lib/npc/document-types';
import { withLockedCopySubmission } from '@/lib/npc/submission-lock';
import { NPC_INTERACTIVE_TRANSACTION_OPTIONS } from '@/lib/npc/transaction';
import {
  NPC_UNAVAILABLE_CONFLICT,
  SubmissionUnavailableError,
} from '@/lib/npc/unavailable';
import {
  assertSubmissionInventoryMutable,
  NPC_INVENTORY_FROZEN_CONFLICT,
  SubmissionInventoryFrozenError,
} from '@/lib/npc/submission-inventory';
import { serializeError } from '@/lib/utils/serialize-error';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ submissionId: string; documentId: string }>;
}

const routeParamsSchema = z.object({
  submissionId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
  documentId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
}).strict();

const patchBodySchema = z.object({
  documentType: z.string().refine(isCorrectionDocumentType),
}).strict();

function invalidParamsResponse() {
  return NextResponse.json({ error: 'Invalid route params' }, { status: 400 });
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

    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return invalidParamsResponse();
    const { submissionId, documentId } = parsedParams.data;
    const submission = await prisma.copySubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, studentId: true, coachId: true, status: true, pages: true },
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

    const parsedBody = patchBodySchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }
    const { documentType } = parsedBody.data;

    const updatedDocument = await prisma.$transaction(async (tx) =>
      withLockedCopySubmission(tx, submissionId, async (locked) => {
        assertSubmissionInventoryMutable(locked);
        const document = await tx.copyPage.findFirst({
          where: { id: documentId, submissionId },
        });
        if (!document) return null;

        const updated = await tx.copyPage.update({
          where: { id: document.id },
          data: { documentType },
        });
        const pages = await tx.copyPage.findMany({
          where: { submissionId },
          orderBy: { pageNumber: 'asc' },
          select: {
            documentType: true,
            originalFilePath: true,
            sizeBytes: true,
            mimeType: true,
          },
        });
        const allDocumentTypes = pages.map((page) => page.documentType);
        const hasStudentCopy = allDocumentTypes.includes('STUDENT_COPY');
        const hasMinimalContext =
          allDocumentTypes.includes('SUBJECT') ||
          allDocumentTypes.includes('GRADING_RUBRIC') ||
          allDocumentTypes.includes('GRADING_INSTRUCTIONS');
        const mirroredPage = pages.find(
          (page) => page.documentType === 'STUDENT_COPY',
        );

        await tx.copySubmission.update({
          where: { id: submissionId },
          data: {
            status:
              hasStudentCopy && hasMinimalContext
                ? CopySubmissionStatus.READY_FOR_AI
                : CopySubmissionStatus.UPLOADED,
            storedFilePath: mirroredPage?.originalFilePath ?? null,
            fileSizeBytes: mirroredPage?.sizeBytes ?? null,
            mimeType: mirroredPage?.mimeType ?? null,
          },
        });
        await tx.npcAuditLog.create({
          data: {
            actorId: actor.userId,
            actorRole: actor.role,
            action: 'UPDATE_DOCUMENT_TYPE',
            entityType: 'CopyPage',
            entityId: document.id,
            details: {
              oldType: document.documentType,
              newType: documentType,
            },
          },
        });
        return updated;
      }),
      NPC_INTERACTIVE_TRANSACTION_OPTIONS,
    );

    if (!updatedDocument) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({
      document: sanitizeCopyPage(updatedDocument as unknown as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof SubmissionUnavailableError) {
      return NextResponse.json(NPC_UNAVAILABLE_CONFLICT, { status: 409 });
    }
    if (error instanceof SubmissionInventoryFrozenError) {
      return NextResponse.json(NPC_INVENTORY_FROZEN_CONFLICT, { status: 409 });
    }
    console.error('[NPC Documents] PATCH error:', serializeError(error));
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

    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return invalidParamsResponse();
    const { submissionId, documentId } = parsedParams.data;
    const submission = await prisma.copySubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, studentId: true, coachId: true, status: true },
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

    const document = await prisma.$transaction(async (tx) =>
      withLockedCopySubmission(tx, submissionId, async (locked) => {
        assertSubmissionInventoryMutable(locked);
        const target = await tx.copyPage.findFirst({
          where: { id: documentId, submissionId },
          select: { id: true, originalFilePath: true },
        });
        if (!target) return null;

        await tx.copyPage.delete({ where: { id: target.id } });
        const remainingPages = await tx.copyPage.findMany({
          where: { submissionId },
          orderBy: { pageNumber: 'asc' },
          select: {
            documentType: true,
            originalFilePath: true,
            sizeBytes: true,
            mimeType: true,
          },
        });
        const remainingStudentCopy = remainingPages.find(
          (page) => page.documentType === 'STUDENT_COPY',
        );
        const documentTypes = remainingPages.map((page) => page.documentType);
        const hasMinimalContext = documentTypes.some((type) =>
          ['SUBJECT', 'GRADING_RUBRIC', 'GRADING_INSTRUCTIONS'].includes(type),
        );
        await tx.copySubmission.update({
          where: { id: submissionId },
          data: {
            status: remainingStudentCopy
              ? hasMinimalContext
                ? CopySubmissionStatus.READY_FOR_AI
                : CopySubmissionStatus.UPLOADED
              : CopySubmissionStatus.PENDING_UPLOAD,
            storedFilePath: remainingStudentCopy?.originalFilePath ?? null,
            fileSizeBytes: remainingStudentCopy?.sizeBytes ?? null,
            mimeType: remainingStudentCopy?.mimeType ?? null,
          },
        });
        await tx.npcAuditLog.create({
          data: {
            actorId: actor.userId,
            actorRole: actor.role,
            action: 'DELETE_CORRECTION_DOCUMENT',
            entityType: 'CopyPage',
            entityId: target.id,
            details: { submissionId },
          },
        });
        return target;
      }),
      NPC_INTERACTIVE_TRANSACTION_OPTIONS,
    );

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const diskDeleted = await deleteSecureFile(document.originalFilePath);
    if (!diskDeleted) {
      await prisma.npcAuditLog.create({
        data: {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'DELETE_CORRECTION_DOCUMENT_STORAGE_FAILED',
          entityType: 'CopyPage',
          entityId: document.id,
          details: { submissionId },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SubmissionUnavailableError) {
      return NextResponse.json(NPC_UNAVAILABLE_CONFLICT, { status: 409 });
    }
    if (error instanceof SubmissionInventoryFrozenError) {
      return NextResponse.json(NPC_INVENTORY_FROZEN_CONFLICT, { status: 409 });
    }
    console.error('[NPC Documents] Delete error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
