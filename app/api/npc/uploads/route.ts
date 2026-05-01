// ═══════════════════════════════════════════════════════════════════════════════
// NPC - NEXUS PEDAGOGY COCKPIT — File Upload Endpoint
// POST /api/npc/uploads - Upload copy files with RBAC protection
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { can } from '@/lib/rbac';
import { UserRole, CopySubmissionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  validateUploadedFile,
  generateSecureFileId,
  saveUploadedFile,
  FILE_VALIDATION_ERRORS,
} from '@/lib/npc';
import type { FileMetadata } from '@/lib/npc';

// ─── Constants ───

const MAX_REQUEST_SIZE = 11 * 1024 * 1024; // 11MB (slightly above file limit for overhead)

// ─── Auth Helper ───

async function authenticateAndAuthorize(
  request: NextRequest,
  studentId: string
): Promise<
  | { authorized: false; response: NextResponse }
  | { authorized: true; userId: string; role: UserRole }
> {
  const session = await auth();

  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { id: userId, role } = session.user as { id: string; role: UserRole };

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
    // Parse multipart form data
    const formData = await request.formData();

    // Extract metadata
    const studentId = formData.get('studentId') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | undefined;
    const subject = formData.get('subject') as string;

    if (!studentId || !title || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: studentId, title, subject' },
        { status: 400 }
      );
    }

    // Authenticate and authorize
    const auth = await authenticateAndAuthorize(request, studentId);
    if (!auth.authorized) {
      return auth.response;
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

    // Create CopySubmission record
    const submission = await prisma.copySubmission.create({
      data: {
        studentId,
        coachId:
          auth.role === UserRole.COACH
            ? (
                await prisma.coachProfile.findFirst({
                  where: { userId: auth.userId },
                  select: { id: true },
                })
              )?.id
            : null,
        subject: subject as any,
        title,
        description,
        status: CopySubmissionStatus.UPLOADED,
        storedFilePath: 'pending', // Will be updated after save
        fileSizeBytes: file.size,
        mimeType: file.type,
      },
    });

    // Read file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Prepare metadata for storage
    const metadata: FileMetadata = {
      secureId,
      originalName: file.name,
      sanitizedName: validation.sanitizedName!,
      mimeType: file.type,
      sizeBytes: file.size,
      createdAt: new Date(),
      studentId,
      submissionId: submission.id,
      pageNumber: 1, // For multi-page PDFs, this will be updated after processing
    };

    // Save to secure storage
    const storageResult = await saveUploadedFile(fileBuffer, metadata);

    if (!storageResult.success) {
      // Rollback: delete the submission record
      await prisma.copySubmission.delete({ where: { id: submission.id } });
      return NextResponse.json(
        { error: storageResult.error || 'Failed to save file' },
        { status: 500 }
      );
    }

    // Update submission with file path
    await prisma.copySubmission.update({
      where: { id: submission.id },
      data: {
        storedFilePath: storageResult.relativePath,
      },
    });

    // Create CopyPage record
    await prisma.copyPage.create({
      data: {
        submissionId: submission.id,
        pageNumber: 1,
        originalFilePath: storageResult.relativePath!,
        status: 'UPLOADED',
      },
    });

    return NextResponse.json(
      {
        success: true,
        submissionId: submission.id,
        filePath: storageResult.relativePath,
        message: 'File uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[NPC Upload] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
