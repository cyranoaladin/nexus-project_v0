/**
 * F50: Bilan Export API
 * GET /api/bilans/[id]/export?format=pdf|markdown
 * POST /api/bilans/[id]/export — Trigger export generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/bilans/[id]/export
 * Query params: format (pdf|markdown), audience (student|parents|nexus|all)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH', 'ELEVE', 'PARENT']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'markdown';
    const audience = searchParams.get('audience') || 'all';

    // Fetch bilan
    const bilan = await prisma.bilan.findUnique({
      where: { id },
      select: {
        id: true,
        publicShareId: true,
        type: true,
        subject: true,
        studentName: true,
        studentEmail: true,
        studentMarkdown: true,
        parentsMarkdown: true,
        nexusMarkdown: true,
        globalScore: true,
        confidenceIndex: true,
        status: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!bilan) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Check published status for non-staff
    const user = (request as unknown as { user?: { role: string } }).user;
    const isStaff = ['ADMIN', 'ASSISTANTE', 'COACH'].includes(user?.role || '');
    if (!isStaff && !bilan.isPublished) {
      return NextResponse.json(
        { success: false, error: 'Bilan not published' },
        { status: 403 }
      );
    }

    // Build export content based on audience
    let content: Record<string, string> = {};

    switch (audience) {
      case 'student':
        content = { student: bilan.studentMarkdown || '' };
        break;
      case 'parents':
        content = { parents: bilan.parentsMarkdown || '' };
        break;
      case 'nexus':
        content = { nexus: bilan.nexusMarkdown || '' };
        break;
      case 'all':
      default:
        content = {
          student: bilan.studentMarkdown || '',
          parents: bilan.parentsMarkdown || '',
          nexus: bilan.nexusMarkdown || '',
        };
    }

    // Return based on format
    if (format === 'markdown') {
      return NextResponse.json({
        success: true,
        data: {
          bilanId: bilan.id,
          publicShareId: bilan.publicShareId,
          type: bilan.type,
          subject: bilan.subject,
          studentName: bilan.studentName,
          globalScore: bilan.globalScore,
          confidenceIndex: bilan.confidenceIndex,
          content,
          exportedAt: new Date().toISOString(),
        },
      });
    }

    if (format === 'pdf') {
      // PDF generation placeholder — will integrate with @react-pdf/renderer
      return NextResponse.json({
        success: true,
        message: 'PDF generation ready — integrate with @react-pdf/renderer',
        data: {
          bilanId: bilan.id,
          format: 'pdf',
          content, // For now return markdown content that will be rendered to PDF
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported format. Use: markdown, pdf' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[GET /api/bilans/[id]/export] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export bilan' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bilans/[id]/export
 * Trigger async export generation (for PDF pre-generation)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const { format = 'pdf' } = body;

    // Check bilan exists
    const bilan = await prisma.bilan.findUnique({
      where: { id },
      select: { id: true, status: true, isPublished: true },
    });

    if (!bilan) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Validate bilan is completed
    if (bilan.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Bilan must be COMPLETED before export' },
        { status: 400 }
      );
    }

    // TODO: Trigger async PDF generation here
    // For now return placeholder
    return NextResponse.json({
      success: true,
      message: `Export generation queued for format: ${format}`,
      data: {
        bilanId: id,
        format,
        status: 'queued',
        estimatedCompletion: '30s',
      },
    });
  } catch (error) {
    console.error('[POST /api/bilans/[id]/export] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to queue export' },
      { status: 500 }
    );
  }
}
