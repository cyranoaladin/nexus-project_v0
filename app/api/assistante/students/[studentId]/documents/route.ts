import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
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
  localPath: z.string().optional(),
  visibilityScope: z.nativeEnum(DocumentVisibilityScope).default(DocumentVisibilityScope.STUDENT_AND_COACH),
});

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

function sanitizeDocument(document: Record<string, unknown>) {
  const { localPath: _localPath, ...safeDocument } = document;
  return safeDocument;
}

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

/**
 * GET /api/assistante/students/[studentId]/documents
 *
 * Returns all documents for a specific student.
 * Requires: ASSISTANTE or ADMIN role
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    // Verify student exists with userId for UserDocument lookup
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { 
        id: true,
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

    const documents = await prisma.userDocument.findMany({
      where: { userId: student.userId },
      orderBy: { createdAt: 'desc' },
      select: documentSafeSelect,
    });

    return NextResponse.json({
      success: true,
      student,
      documents: documents.map((document) => sanitizeDocument(document)),
    });
  } catch (error) {
    console.error('[API Assistante Documents GET] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assistante/students/[studentId]/documents
 *
 * Creates a document metadata for a student.
 * Requires: ASSISTANTE or ADMIN role
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    // Verify student exists with userId
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

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
    
    const document = await prisma.userDocument.create({
      data: {
        userId: student.userId,
        uploadedById: session.user.id,
        documentType: validated.documentType,
        subject: validated.subject ?? null,
        title: validated.title,
        description: validated.description ?? null,
        localPath,
        originalName: validated.title,
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        visibilityScope: validated.visibilityScope,
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

    console.error('[API Assistante Documents POST] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
