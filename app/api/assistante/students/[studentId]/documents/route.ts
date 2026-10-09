import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { serializeError } from '@/lib/utils/serialize-error';

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

/** URL-only metadata cannot be delivered by the private document reader. */
export async function POST(_request: Request, _context: RouteParams) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  return NextResponse.json(
    { error: 'DOCUMENT_FILE_UPLOAD_REQUIRED', message: 'Déposez un fichier depuis le formulaire de documents.' },
    { status: 410, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } }
  );
}
