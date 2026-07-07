import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { DocumentType, DocumentVisibilityScope, Subject } from '@prisma/client';
import { z } from 'zod';
import { serializeError } from '@/lib/utils/serialize-error';

// Validation schema for creating documents
const createDocumentSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  subject: z.nativeEnum(Subject).optional(),
  title: z.string().min(1, 'Titre requis').max(200),
  description: z.string().max(1000).optional(),
  url: z.string().url().optional(),
  visibilityScope: z.nativeEnum(DocumentVisibilityScope).default(DocumentVisibilityScope.STUDENT_AND_COACH),
}).strict();

const routeParamsSchema = z.object({
  studentId: z.string().min(1).max(128),
});

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const documentSafeSelect = {
  id: true,
  title: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  documentType: true,
  visibilityScope: true,
  subject: true,
  description: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  uploadedById: true,
} as const;

type DocumentMutationData = {
  title: string;
  documentType: DocumentType;
  subject: Subject | null;
  description?: string | null;
  localPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  visibilityScope: DocumentVisibilityScope;
};

function sanitizeDocument(document: Record<string, unknown>) {
  const { localPath: _localPath, ...safeDocument } = document;
  return safeDocument;
}

function optionalFormString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value;
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'document';
}

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
    const parsedParams = routeParamsSchema.parse(await params);
    const { studentId } = parsedParams;
    
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
      select: documentSafeSelect,
    });

    return NextResponse.json({
      success: true,
      documents: documents.map((document) => sanitizeDocument(document)),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation Error', message: error.errors },
        { status: 400 }
      );
    }

    console.error('[API Coach Documents GET] Error:', serializeError(error));
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
    const parsedParams = routeParamsSchema.parse(await params);
    const { studentId } = parsedParams;
    
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
    let documentData: DocumentMutationData;

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

      if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Type ou taille de fichier invalide' },
          { status: 400 }
        );
      }

      const validatedMeta = createDocumentSchema.parse({
        title: optionalFormString(formData.get('title')) ?? file.name,
        documentType: optionalFormString(formData.get('documentType')),
        subject: optionalFormString(formData.get('subject')),
        description: optionalFormString(formData.get('description')),
        visibilityScope: optionalFormString(formData.get('visibilityScope')) ?? DocumentVisibilityScope.STUDENT_AND_COACH,
        url: 'https://nexusreussite.academy/internal-upload-placeholder',
      });

      // Generate a unique filename
      const timestamp = Date.now();
      const sanitizedTitle = sanitizeFilenamePart(validatedMeta.title);
      const extension = sanitizeFilenamePart(file.name.split('.').pop() || 'pdf');
      const filename = `${sanitizedTitle}-${timestamp}.${extension}`;
      const localPath = `/app/storage/documents/${student.userId}/${filename}`;

      // Save file to disk
      const uploadDir = path.join(process.cwd(), 'storage', 'documents', student.userId);
      await mkdir(uploadDir, { recursive: true });

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDir, filename), buffer);

      documentData = {
        title: validatedMeta.title,
        documentType: validatedMeta.documentType,
        subject: validatedMeta.subject ?? null,
        description: validatedMeta.description ?? null,
        visibilityScope: validatedMeta.visibilityScope,
        localPath,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      };
    } else {
      // Handle JSON (URL-based)
      const body = await request.json();
      const validated = createDocumentSchema.parse(body);

      // URL documents are metadata only; direct localPath is reserved for server-side uploads.
      if (!validated.url) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'URL requise' },
          { status: 400 }
        );
      }

      // Build data ensuring localPath is always provided (required by Prisma schema)
      const localPath = validated.url;
      
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
      select: documentSafeSelect,
    });

    return NextResponse.json({
      success: true,
      message: 'Document créé',
      document: sanitizeDocument(document),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation Error', message: error.errors },
        { status: 400 }
      );
    }

    console.error('[API Coach Documents POST] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
