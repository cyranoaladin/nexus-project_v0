import { NextResponse } from 'next/server';
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

    // Get student with userId for UserDocument lookup
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
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

    const body = await request.json();
    const validated = createDocumentSchema.parse(body);

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
