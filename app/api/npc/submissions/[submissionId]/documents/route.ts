import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CopySubmissionStatus, UserRole, AiJobType, AiJobStatus, AiJobPriority } from '@prisma/client';
import {
import { serializeError } from '@/lib/utils/serialize-error';
  FILE_VALIDATION_ERRORS,
  validateUploadedFile,
} from '@/lib/npc/file-validator';
import {
  generateSecureFileId,
  saveUploadedFile,
} from '@/lib/npc/storage';
import type { FileMetadata } from '@/lib/npc/storage';
import { isCorrectionDocumentType } from '@/lib/npc/document-types';
import { canManageSubmissionDocuments, canReadSubmission } from '@/lib/npc/access';

interface RouteParams {
  params: Promise<{ submissionId: string }>;
}

const MAX_FILES_PER_SUBMISSION = 20;

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

async function getSubmission(submissionId: string) {
  return prisma.copySubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      coachId: true,
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
}

function validationErrorMessage(error?: string) {
  if (!error) return 'Invalid file';
  const baseCode = error.split(':')[0];
  return FILE_VALIDATION_ERRORS[baseCode] || FILE_VALIDATION_ERRORS[error] || 'Invalid file';
}

function nextSubmissionStatus(documentTypes: string[]) {
  const hasStudentCopy = documentTypes.includes('STUDENT_COPY');
  const hasMinimalContext =
    documentTypes.includes('SUBJECT') ||
    documentTypes.includes('GRADING_RUBRIC') ||
    documentTypes.includes('GRADING_INSTRUCTIONS');

  if (hasStudentCopy && hasMinimalContext) {
    return CopySubmissionStatus.READY_FOR_AI;
  }

  return CopySubmissionStatus.UPLOADED;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { submissionId } = await params;
  const submission = await prisma.copySubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      coachId: true,
      pages: {
        orderBy: { pageNumber: 'asc' },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  if (!(await canReadSubmission(actor, submission))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    documents: submission.pages.map((page) =>
      sanitizeCopyPage(page as unknown as Record<string, unknown>)
    ),
  });
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await getActor();
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { submissionId } = await params;
    const submission = await getSubmission(submissionId);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (!(await canManageSubmissionDocuments(actor, submission))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const documentType = formData.get('documentType') || 'STUDENT_COPY';
    if (!isCorrectionDocumentType(documentType)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }

    const files = formData.getAll('file').filter((value): value is File => value instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (submission.pages.length + files.length > MAX_FILES_PER_SUBMISSION) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_SUBMISSION} documents autorisés` },
        { status: 400 }
      );
    }

    const currentMax = await prisma.copyPage.aggregate({
      where: { submissionId },
      _max: { pageNumber: true },
    });

    const documents = [];

    for (const [index, file] of files.entries()) {
      const secureId = generateSecureFileId();
      const validation = validateUploadedFile({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        secureId,
      });

      if (!validation.valid) {
        return NextResponse.json(
          { error: validationErrorMessage(validation.error), code: validation.error },
          { status: 400 }
        );
      }

      const pageNumber = (currentMax._max.pageNumber || 0) + index + 1;
      const fileBuffer = Buffer.from(await new Response(file).arrayBuffer());
      const metadata: FileMetadata = {
        secureId,
        originalName: file.name,
        sanitizedName: validation.sanitizedName!,
        mimeType: file.type,
        sizeBytes: file.size,
        createdAt: new Date(),
        studentId: submission.studentId,
        submissionId,
        pageNumber,
      };

      const storageResult = await saveUploadedFile(fileBuffer, metadata);
      if (!storageResult.success || !storageResult.relativePath) {
        return NextResponse.json(
          { error: storageResult.error || 'Failed to save file' },
          { status: 500 }
        );
      }

      const document = await prisma.copyPage.create({
        data: {
          submissionId,
          pageNumber,
          status: 'UPLOADED',
          documentType,
          originalFilePath: storageResult.relativePath,
          originalFilename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          uploadedById: actor.userId,
          convertedFilePaths: [],
        },
      });

      documents.push(document);

      // Create VISION_OCR job for each STUDENT_COPY page
      if (documentType === 'STUDENT_COPY') {
        const filePath = storageResult.relativePath!;
        await prisma.aiProcessingJob.create({
          data: {
            type: AiJobType.VISION_OCR,
            status: AiJobStatus.PENDING,
            priority: AiJobPriority.HIGH,
            maxRetries: 3,
            inputData: JSON.stringify({
              pageId: document.id,
              submissionId,
              filePath,
              mimeType: file.type,
            }),
          },
        });
      }
    }

    const documentTypes = [
      ...submission.pages.map((page) => page.documentType),
      ...documents.map((document) => document.documentType),
    ];

    await prisma.copySubmission.update({
      where: { id: submissionId },
      data: {
        status: nextSubmissionStatus(documentTypes),
        storedFilePath: documentTypes.includes('STUDENT_COPY')
          ? documents.find((document) => document.documentType === 'STUDENT_COPY')?.originalFilePath
          : undefined,
        fileSizeBytes:
          documents.length === 1 && documents[0].documentType === 'STUDENT_COPY'
            ? documents[0].sizeBytes
            : undefined,
        mimeType:
          documents.length === 1 && documents[0].documentType === 'STUDENT_COPY'
            ? documents[0].mimeType
            : undefined,
      },
    });

    await prisma.npcAuditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'UPLOAD_CORRECTION_DOCUMENT',
        entityType: 'CopySubmission',
        entityId: submissionId,
        details: JSON.stringify({
          documentType,
          documentIds: documents.map((document) => document.id),
        }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        document: sanitizeCopyPage(documents[0] as unknown as Record<string, unknown>),
        documents: documents.map((document) =>
          sanitizeCopyPage(document as unknown as Record<string, unknown>)
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[NPC Documents] Upload error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
