/**
 * GET /api/parent/bilans/[id]/pdf
 *
 * Returns a PDF render of the parent-facing bilan content.
 * RBAC: PARENT only — verifies bilan.studentId belongs to the authenticated parent.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { renderBilanParentPDF } from '@/lib/pdf/bilan-parent-pdfkit';

const SUBJECT_LABEL: Record<string, string> = {
  MATHEMATIQUES: 'Mathématiques',
  FRANCAIS: 'Français / EAF',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionOrError = await requireRole('PARENT');
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  try {
    const { id } = await params;

    // Verify parent owns this child
    const parent = await prisma.parentProfile.findUnique({
      where: { userId: sessionOrError.user.id },
      select: { children: { select: { id: true } } },
    });
    if (!parent) {
      return NextResponse.json({ error: 'Profil parent introuvable' }, { status: 404 });
    }
    const childIds = parent.children.map((c) => c.id);

    const bilan = await prisma.bilan.findFirst({
      where: { id, isPublished: true, studentId: { in: childIds } },
      select: {
        id: true,
        subject: true,
        studentName: true,
        globalScore: true,
        parentsMarkdown: true,
        publishedAt: true,
        createdAt: true,
        stage: { select: { title: true } },
        coach: { select: { pseudonym: true } },
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!bilan) {
      return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });
    }

    if (!bilan.parentsMarkdown) {
      return NextResponse.json(
        { error: 'Le contenu du bilan parent n\'est pas encore disponible.' },
        { status: 409 }
      );
    }

    const childName = bilan.student?.user
      ? `${bilan.student.user.firstName ?? ''} ${bilan.student.user.lastName ?? ''}`.trim()
      : bilan.studentName;

    const pdfData: BilanParentPDFData = {
      studentName: childName || bilan.studentName || 'Élève',
      stageTitle: bilan.stage?.title ?? 'Stage',
      subjectLabel: SUBJECT_LABEL[bilan.subject] ?? bilan.subject,
      coachName: bilan.coach?.pseudonym ?? null,
      publishedAt: (bilan.publishedAt ?? bilan.createdAt ?? new Date()).toISOString(),
      globalScore: bilan.globalScore,
      parentsMarkdown: bilan.parentsMarkdown,
    };

    const pdfBuffer = await renderBilanParentPDF(pdfData);

    const safeChild = (childName || 'eleve')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    const fileName = `bilan-nexus-${safeChild}-${bilan.subject.toLowerCase()}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[GET /api/parent/bilans/:id/pdf]', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
