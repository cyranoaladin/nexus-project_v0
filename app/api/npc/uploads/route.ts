import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { can } from '@/lib/rbac';
import { UserRole, CopySubmissionStatus, Subject } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { serializeError } from '@/lib/utils/serialize-error';
import {
  validateUploadedFile,
  deleteSecureFile,
  generateSecureFileId,
  saveUploadedFile,
  FILE_VALIDATION_ERRORS,
} from '@/lib/npc';
import type { FileMetadata } from '@/lib/npc';
import { withLockedCopySubmission } from '@/lib/npc/submission-lock';
import { z } from 'zod';

// ─── Constants ───

const MAX_REQUEST_SIZE = 11 * 1024 * 1024; // 11MB (slightly above file limit for overhead)

class InitialUploadStorageError extends Error {
  constructor(readonly publicCode: string) {
    super('NPC initial upload storage failed');
    this.name = 'InitialUploadStorageError';
  }
}

const uploadMetadataSchema = z.object({
  studentId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional(),
  subject: z.nativeEnum(Subject),
}).strict();

// ─── Auth Helper ───

async function authenticateAndAuthorize(
  sessionUser: { id: string; role: UserRole },
  studentId: string
): Promise<
  | { authorized: false; response: NextResponse }
  | { authorized: true; userId: string; role: UserRole }
> {
  const { id: userId, role } = sessionUser;

  // Check base permission
  if (!can(role, 'CREATE', 'COPY_SUBMISSION')) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  // Additional ownership checks for non-admin roles
  if (role === UserRole.ELEVE) {
    // Student can only upload for themselves
    const student = await prisma.student.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!student || student.id !== studentId) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Forbidden - Can only upload own copies' },
          { status: 403 }
        ),
      };
    }
  } else if (role === UserRole.PARENT) {
    // Parent can upload for their children
    const parent = await prisma.parentProfile.findFirst({
      where: { userId },
      include: {
        children: { select: { id: true } },
      },
    });
    const childIds = parent?.children.map((c) => c.id) || [];
    if (!childIds.includes(studentId)) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Forbidden - Can only upload for own children' },
          { status: 403 }
        ),
      };
    }
  } else if (role === UserRole.COACH) {
    // Coach can upload for assigned students
    const coach = await prisma.coachProfile.findFirst({
      where: { userId },
      include: {
        studentAssignments: {
          where: { status: 'ACTIVE' },
          select: { studentId: true },
        },
      },
    });
    const assignedIds = coach?.studentAssignments.map((a) => a.studentId) || [];
    if (!assignedIds.includes(studentId)) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Forbidden - Student not assigned to you' },
          { status: 403 }
        ),
      };
    }
  }
  // ADMIN and ASSISTANTE bypass ownership checks

  return { authorized: true, userId, role };
}

// ─── POST Handler ───

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionUser = session.user as { id: string; role: UserRole };
    if (!can(sessionUser.role, 'CREATE', 'COPY_SUBMISSION')) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();

    const parsedMetadata = uploadMetadataSchema.safeParse({
      studentId: formData.get('studentId'),
      title: formData.get('title'),
      description: formData.get('description') || undefined,
      subject: formData.get('subject'),
    });

    if (!parsedMetadata.success) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      );
    }
    const { studentId, title, description, subject } = parsedMetadata.data;

    // Authenticate and authorize
    const authorization = await authenticateAndAuthorize(sessionUser, studentId);
    if (!authorization.authorized) {
      return authorization.response;
    }

    // Get uploaded file
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check request size
    if (file.size > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      );
    }

    // Generate secure file ID
    const secureId = generateSecureFileId();

    // Validate file (server-side, never trust client)
    const validation = validateUploadedFile({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      secureId,
    });

    if (!validation.valid) {
      const errorMessage =
        validation.error && FILE_VALIDATION_ERRORS[validation.error]
          ? FILE_VALIDATION_ERRORS[validation.error]
          : 'Invalid file';
      return NextResponse.json(
        { error: errorMessage, code: validation.error },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await new Response(file).arrayBuffer());
    const coachId =
      authorization.role === UserRole.COACH
        ? (
            await prisma.coachProfile.findFirst({
              where: { userId: authorization.userId },
              select: { id: true },
            })
          )?.id ?? null
        : null;
    let savedRelativePath: string | undefined;
    let submission;
    try {
      submission = await prisma.$transaction(async (tx) => {
        const created = await tx.copySubmission.create({
          data: {
            studentId,
            coachId,
            subject: subject as Subject,
            title,
            description,
            status: CopySubmissionStatus.UPLOADED,
            storedFilePath: null,
            fileSizeBytes: null,
            mimeType: null,
          },
        });

        return withLockedCopySubmission(tx, created.id, async () => {
          const metadata: FileMetadata = {
            secureId,
            originalName: file.name,
            sanitizedName: validation.sanitizedName!,
            mimeType: file.type,
            sizeBytes: file.size,
            createdAt: new Date(),
            studentId,
            submissionId: created.id,
            pageNumber: 1,
          };
          const storageResult = await saveUploadedFile(fileBuffer, metadata);
          if (
            !storageResult.success ||
            !storageResult.relativePath ||
            !storageResult.sha256
          ) {
            throw new InitialUploadStorageError(
              storageResult.error || 'SAVE_FAILED',
            );
          }
          savedRelativePath = storageResult.relativePath;

          await tx.copySubmission.update({
            where: { id: created.id },
            data: {
              storedFilePath: storageResult.relativePath,
              fileSizeBytes: file.size,
              mimeType: file.type,
            },
          });
          await tx.copyPage.create({
            data: {
              submissionId: created.id,
              pageNumber: 1,
              originalFilePath: storageResult.relativePath,
              originalFilename: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              sha256: storageResult.sha256,
              documentType: 'STUDENT_COPY',
              uploadedById: authorization.userId,
              convertedFilePaths: [],
              status: 'UPLOADED',
            },
          });
          return created;
        });
      });
    } catch (error) {
      if (savedRelativePath) await deleteSecureFile(savedRelativePath);
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        submissionId: submission.id,
        message: 'File uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof InitialUploadStorageError) {
      return NextResponse.json({ error: error.publicCode }, { status: 500 });
    }
    console.error('[NPC Upload] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
