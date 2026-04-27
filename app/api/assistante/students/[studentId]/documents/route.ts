import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { DocumentType, DocumentVisibilityScope, Subject } from '@prisma/client';
import { z } from 'zod';

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

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { 
        id: true,
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
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      student,
      documents,
    });
  } catch (error) {
    console.error('[API Assistante Documents GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = createDocumentSchema.parse(body);

    if (!validated.url && !validated.localPath) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'URL ou chemin local requis' },
        { status: 400 }
      );
    }

    const document = await prisma.userDocument.create({
      data: {
        studentId,
        uploadedById: session.user.id,
        documentType: validated.documentType,
        subject: validated.subject,
        title: validated.title,
        description: validated.description,
        url: validated.url,
        localPath: validated.localPath,
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

    console.error('[API Assistante Documents POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
