import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { readGeneratedReportPdf } from '@/lib/reports/stage/reportStorage';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ studentId: string; reportId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { studentId, reportId } = await params;

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    // Verify coach assignment
    try {
      await assertCoachCanAccessStudent({ coachUserId: authSession.user.id, studentId });
    } catch (error) {
      if (error instanceof CoachNotAssignedError) {
        return NextResponse.json(
          { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
          { status: 403 }
        );
      }
      throw error;
    }

    const report = await prisma.generatedPedagogicalReport.findUnique({
      where: { id: reportId },
    });

    if (!report || report.studentId !== studentId) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.status !== 'PDF_READY') {
      return NextResponse.json(
        { error: 'Not Ready', message: "Le PDF n'est pas encore disponible." },
        { status: 409 },
      );
    }

    // Read from durable storage (configurable via GENERATED_REPORTS_DIR)
    try {
      const buffer = await readGeneratedReportPdf({
        reportId: report.id,
        studentId: report.studentId,
      });
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="bilan-${studentId}-${reportId}.pdf"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } catch {
      return NextResponse.json({ error: 'PDF file not generated or not available' }, { status: 404 });
    }
  } catch (error) {
    logger.error({ err: error }, '[API] Download PDF failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
