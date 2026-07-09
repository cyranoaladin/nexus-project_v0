import { serializeError } from '@/lib/utils/serialize-error';
/**
 * Bilan Export API
 * GET /api/bilans/[id]/export?format=pdf|markdown
 * POST /api/bilans/[id]/export — Trigger export generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import {
  buildBilanReadWhere,
  buildBilanWriteWhere,
  canSeeInternalBilan,
} from '@/lib/security/ownership';
import { parseJsonBody } from '@/lib/api/helpers';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const routeParamsSchema = z.object({
  id: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
}).strict();

const exportQuerySchema = z.object({
  format: z.enum(['pdf', 'markdown']).default('markdown'),
  audience: z.enum(['student', 'parents', 'nexus', 'all']).default('all'),
}).strict();

const exportBodySchema = z.object({
  format: z.enum(['pdf', 'markdown']).default('pdf'),
}).strict();

function validationFailed() {
  return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
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
    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return validationFailed();
    const { searchParams } = new URL(request.url);
    const parsedQuery = exportQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsedQuery.success) return validationFailed();
    const { id } = parsedParams.data;
    const { format, audience } = parsedQuery.data;
    const where = buildBilanReadWhere(id, authResponse.user);
    if (!where) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Fetch bilan
    const bilan = await prisma.bilan.findFirst({
      where,
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

    // Build export content based on audience
    let content: Record<string, string> = {};
    const canSeeInternal = canSeeInternalBilan(authResponse.user.role);
    if (audience === 'nexus' && !canSeeInternal) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

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
        if (canSeeInternal) {
          content = {
            student: bilan.studentMarkdown || '',
            parents: bilan.parentsMarkdown || '',
            nexus: bilan.nexusMarkdown || '',
          };
        } else if (authResponse.user.role === 'PARENT') {
          content = { parents: bilan.parentsMarkdown || '' };
        } else {
          content = { student: bilan.studentMarkdown || '' };
        }
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
    console.error('[GET /api/bilans/[id]/export] Error:', serializeError(error));
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
    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return validationFailed();
    const parsedBody = exportBodySchema.safeParse(await parseJsonBody(request));
    if (!parsedBody.success) return validationFailed();
    const { id } = parsedParams.data;
    const { format } = parsedBody.data;
    const where = buildBilanWriteWhere(id, authResponse.user);
    if (!where) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Check bilan exists
    const bilan = await prisma.bilan.findFirst({
      where,
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
    console.error('[POST /api/bilans/[id]/export] Error:', serializeError(error));
    return NextResponse.json(
      { success: false, error: 'Failed to queue export' },
      { status: 500 }
    );
  }
}
