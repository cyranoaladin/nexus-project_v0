import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CopySubmissionStatus, UserRole, AiJobType, AiJobStatus, AiJobPriority } from '@prisma/client';
import { serializeError } from '@/lib/utils/serialize-error';
import {
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
import { withLockedCopySubmission } from '@/lib/npc/submission-lock';
import { inspectNpcStorageFile } from '@/lib/npc/storage-root';
import { NPC_INTERACTIVE_TRANSACTION_OPTIONS } from '@/lib/npc/transaction';
import {
  NpcFileCleanupDurabilityError,
  reconcileStagedNpcFiles,
} from '@/lib/npc/upload-reconciliation';
import {
  NPC_UNAVAILABLE_CONFLICT,
  SubmissionUnavailableError,
} from '@/lib/npc/unavailable';
import {
  assertSubmissionInventoryMutable,
  NPC_INVENTORY_FROZEN_CONFLICT,
  SubmissionInventoryFrozenError,
} from '@/lib/npc/submission-inventory';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ submissionId: string }>;
}

class NpcDocumentStorageError extends Error {
  constructor(readonly publicCode: string) {
    super('NPC document storage failed');
    this.name = 'NpcDocumentStorageError';
  }
}

interface PreparedDocumentUpload {
  file: File;
  fileBuffer: Buffer;
  secureId: string;
  sanitizedName: string;
}

interface StagedDocumentUpload extends PreparedDocumentUpload {
  pageNumber: number;
  relativePath: string;
  sha256: string;
}

const MAX_FILES_PER_SUBMISSION = 20;
const routeParamsSchema = z.object({
  submissionId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
}).strict();

const documentTypeSchema = z.string().refine(isCorrectionDocumentType);

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
          pageNumber: true,
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

  const parsedParams = routeParamsSchema.safeParse(await params);
  if (!parsedParams.success) return invalidParamsResponse();
  const { submissionId } = parsedParams.data;
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

    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return invalidParamsResponse();
    const { submissionId } = parsedParams.data;
    const submission = await getSubmission(submissionId);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (!(await canManageSubmissionDocuments(actor, submission))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (submission.status === CopySubmissionStatus.UNAVAILABLE) {
      return NextResponse.json(NPC_UNAVAILABLE_CONFLICT, { status: 409 });
    }

    const formData = await request.formData();
    const parsedDocumentType = documentTypeSchema.safeParse(formData.get('documentType'));
    if (!parsedDocumentType.success) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }
    const documentType = parsedDocumentType.data;

    const files = formData.getAll('file').filter((value): value is File => value instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const preparedFiles: PreparedDocumentUpload[] = [];
    for (const file of files) {
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

      const fileBuffer = Buffer.from(await new Response(file).arrayBuffer());
      preparedFiles.push({
        file,
        fileBuffer,
        secureId,
        sanitizedName: validation.sanitizedName!,
      });
    }

    const baselinePages = submission.pages
      .map((page) => ({ id: page.id, pageNumber: page.pageNumber }))
      .sort((left, right) => left.pageNumber - right.pageNumber);
    const baselineMaximum = baselinePages.at(-1)?.pageNumber ?? 0;
    const stagedUploads: StagedDocumentUpload[] = [];
    let documents;
    try {
      for (const [index, prepared] of preparedFiles.entries()) {
        const pageNumber = baselineMaximum + index + 1;
        const metadata: FileMetadata = {
          secureId: prepared.secureId,
          originalName: prepared.file.name,
          sanitizedName: prepared.sanitizedName,
          mimeType: prepared.file.type,
          sizeBytes: prepared.file.size,
          createdAt: new Date(),
          studentId: submission.studentId,
          submissionId,
          pageNumber,
        };
        const storageResult = await saveUploadedFile(prepared.fileBuffer, metadata);
        if (
          !storageResult.success ||
          !storageResult.relativePath ||
          !storageResult.sha256
        ) {
          throw new NpcDocumentStorageError(storageResult.error || 'SAVE_FAILED');
        }
        stagedUploads.push({
          ...prepared,
          pageNumber,
          relativePath: storageResult.relativePath,
          sha256: storageResult.sha256,
        });
      }

      documents = await prisma.$transaction(async (tx) =>
        withLockedCopySubmission(tx, submissionId, async (locked) => {
          assertSubmissionInventoryMutable(locked);
          const existingPages = await tx.copyPage.findMany({
            where: { submissionId },
            orderBy: { pageNumber: 'asc' },
            select: {
              id: true,
              pageNumber: true,
              documentType: true,
              originalFilePath: true,
              sizeBytes: true,
              mimeType: true,
            },
          });
          if (existingPages.length + preparedFiles.length > MAX_FILES_PER_SUBMISSION) {
            throw new NpcDocumentStorageError('MAX_FILES_EXCEEDED');
          }
          const lockedInventory = existingPages
            .map((page) => ({ id: page.id, pageNumber: page.pageNumber }))
            .sort((left, right) => left.pageNumber - right.pageNumber);
          if (JSON.stringify(lockedInventory) !== JSON.stringify(baselinePages)) {
            throw new NpcDocumentStorageError('INVENTORY_CHANGED');
          }
          const createdDocuments = [];
          let newStudentMirror:
            | { originalFilePath: string; sizeBytes: number; mimeType: string }
            | undefined;

          for (const staged of stagedUploads) {
            const inspection = await inspectNpcStorageFile(staged.relativePath);
            if (
              inspection.sizeBytes !== staged.file.size ||
              inspection.sha256 !== staged.sha256.toLowerCase()
            ) {
              throw new NpcDocumentStorageError('STAGED_FILE_VERIFICATION_FAILED');
            }

            const document = await tx.copyPage.create({
              data: {
                submissionId,
                pageNumber: staged.pageNumber,
                status: 'UPLOADED',
                documentType,
                originalFilePath: staged.relativePath,
                originalFilename: staged.file.name,
                mimeType: staged.file.type,
                sizeBytes: staged.file.size,
                sha256: staged.sha256,
                uploadedById: actor.userId,
                convertedFilePaths: [],
              },
            });
            createdDocuments.push(document);

            if (documentType === 'STUDENT_COPY') {
              newStudentMirror ??= {
                originalFilePath: staged.relativePath,
                sizeBytes: staged.file.size,
                mimeType: staged.file.type,
              };
              await tx.aiProcessingJob.create({
                data: {
                  type: AiJobType.VISION_OCR,
                  status: AiJobStatus.PENDING,
                  priority: AiJobPriority.HIGH,
                  maxRetries: 3,
                  inputData: JSON.stringify({
                    pageId: document.id,
                    submissionId,
                    filePath: staged.relativePath,
                    mimeType: staged.file.type,
                  }),
                },
              });
            }
          }

          const documentTypes = [
            ...existingPages.map((page) => page.documentType),
            ...preparedFiles.map(() => documentType),
          ];
          const shouldSetMirror = !locked.storedFilePath && Boolean(newStudentMirror);
          await tx.copySubmission.update({
            where: { id: submissionId },
            data: {
              status: nextSubmissionStatus(documentTypes),
              storedFilePath: shouldSetMirror
                ? newStudentMirror?.originalFilePath
                : undefined,
              fileSizeBytes: shouldSetMirror
                ? newStudentMirror?.sizeBytes
                : undefined,
              mimeType: shouldSetMirror ? newStudentMirror?.mimeType : undefined,
            },
          });
          await tx.npcAuditLog.create({
            data: {
              actorId: actor.userId,
              actorRole: actor.role,
              action: 'UPLOAD_CORRECTION_DOCUMENT',
              entityType: 'CopySubmission',
              entityId: submissionId,
              details: {
                documentType,
                documentIds: createdDocuments.map((document) => document.id),
              },
            },
          });
          return createdDocuments;
        }),
        NPC_INTERACTIVE_TRANSACTION_OPTIONS,
      );
    } catch (error) {
      await reconcileStagedNpcFiles({
        prisma,
        submissionId,
        actorId: actor.userId,
        actorRole: actor.role,
        relativePaths: stagedUploads.map((staged) => staged.relativePath),
      });
      throw error;
    }

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
    if (error instanceof NpcFileCleanupDurabilityError) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    if (error instanceof SubmissionUnavailableError) {
      return NextResponse.json(NPC_UNAVAILABLE_CONFLICT, { status: 409 });
    }
    if (error instanceof SubmissionInventoryFrozenError) {
      return NextResponse.json(NPC_INVENTORY_FROZEN_CONFLICT, { status: 409 });
    }
    if (error instanceof NpcDocumentStorageError) {
      if (error.publicCode === 'MAX_FILES_EXCEEDED') {
        return NextResponse.json(
          { error: `Maximum ${MAX_FILES_PER_SUBMISSION} documents autorisés` },
          { status: 400 },
        );
      }
      if (error.publicCode === 'INVENTORY_CHANGED') {
        return NextResponse.json(NPC_INVENTORY_FROZEN_CONFLICT, { status: 409 });
      }
      return NextResponse.json({ error: error.publicCode }, { status: 500 });
    }
    console.error('[NPC Documents] Upload error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
