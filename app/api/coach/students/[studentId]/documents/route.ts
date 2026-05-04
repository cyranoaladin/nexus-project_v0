import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { DocumentType, DocumentVisibilityScope, Subject } from '@prisma/client';
import { z } from 'zod';

// Validation schema for creating documents
const createDocumentSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  subject: z.nativeEnum(Subject).optional(),
  title: z.string().min(1, 'Titre requis').max(200),
  description: z.string().max(1000).optional(),
  url: z.string().url().optional(),
  localPath: z.string().optional(),
  visibilityScope: z.nativeEnum(DocumentVisibilityScope).default(DocumentVisibilityScope.STUDENT_AND_COACH),
});

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

/**
 * GET /api/coach/students/[studentId]/documents
 *
 * Returns documents for a specific student that the coach can access.
 * Requires: COACH role and active assignment to the student
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    
    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    // Verify coach is assigned to this student
    try {
      await assertCoachCanAccessStudent({
        coachUserId: session.user.id,
        studentId,
      });
    } catch {
      return NextResponse.json(
        { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
        { status: 403 }
      );
    }

    // Get student with userId for UserDocument lookup defensively
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: studentId },
          { userId: studentId }
        ]
      },
      select: { id: true, userId: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

    const documents = await prisma.userDocument.findMany({
      where: {
        userId: student.userId,
        visibilityScope: {
          in: [
            DocumentVisibilityScope.STUDENT_AND_COACH,
            DocumentVisibilityScope.STUDENT_PARENT_COACH,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error('[API Coach Documents GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coach/students/[studentId]/documents
 *
 * Creates a document metadata for a student.
 * Requires: COACH role and active assignment to the student
 * Supports both JSON (for URL-based documents) and FormData (for file uploads)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    
    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    // Verify coach is assigned to this student
    try {
      await assertCoachCanAccessStudent({
        coachUserId: session.user.id,
        studentId,
      });
    } catch {
      return NextResponse.json(
        { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
        { status: 403 }
      );
    }

    // Verify student exists with userId defensively
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: studentId },
          { userId: studentId }
        ]
      },
      select: { id: true, userId: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

    // Check if request is FormData (file upload) or JSON (URL)
    const contentType = request.headers.get('content-type');
    let documentData: any;

    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      
      if (!file) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Fichier requis' },
          { status: 400 }
        );
      }

      // Generate a unique filename
      const timestamp = Date.now();
      const sanitizedTitle = (formData.get('title') as string || 'document').replace(/[^a-zA-Z0-9]/g, '_');
      const extension = file.name.split('.').pop() || 'pdf';
      const filename = `${sanitizedTitle}-${timestamp}.${extension}`;
      const localPath = `/app/storage/documents/${student.userId}/${filename}`;

      // Save file to disk
      const uploadDir = path.join(process.cwd(), 'storage', 'documents', student.userId);
      await mkdir(uploadDir, { recursive: true });

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDir, filename), buffer);

      documentData = {
        title: formData.get('title') as string,
        documentType: formData.get('documentType') as string,
        subject: formData.get('subject') as string,
        visibilityScope: formData.get('visibilityScope') as string,
        localPath,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      };
    } else {
      // Handle JSON (URL-based)
      const body = await request.json();
      const validated = createDocumentSchema.parse(body);

      // Require either url or localPath
      if (!validated.url && !validated.localPath) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'URL ou chemin local requis' },
          { status: 400 }
        );
      }

      // Build data ensuring localPath is always provided (required by Prisma schema)
      const localPath = validated.localPath || validated.url || `/app/storage/documents/${student.userId}/${Date.now()}-${validated.title.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      documentData = {
        title: validated.title,
        documentType: validated.documentType,
        subject: validated.subject ?? null,
        description: validated.description ?? null,
        localPath,
        originalName: validated.title,
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        visibilityScope: validated.visibilityScope,
      };
    }

    const document = await prisma.userDocument.create({
      data: {
        userId: student.userId,
        uploadedById: session.user.id,
        documentType: documentData.documentType,
        subject: documentData.subject,
        title: documentData.title,
        description: documentData.description ?? null,
        localPath: documentData.localPath,
        originalName: documentData.originalName,
        mimeType: documentData.mimeType,
        sizeBytes: documentData.sizeBytes,
        visibilityScope: documentData.visibilityScope,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Document créé',
      document,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation Error', message: error.errors },
        { status: 400 }
      );
    }

    console.error('[API Coach Documents POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
