/**
 * F50: Bilan Individual API
 * GET /api/bilans/[id] — Get bilan by ID
 * PUT /api/bilans/[id] — Update bilan
 * DELETE /api/bilans/[id] — Delete bilan
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import type { BilanStatus } from '@/lib/bilan/types';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/bilans/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH', 'ELEVE', 'PARENT']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const { id } = await params;

    const bilan = await prisma.bilan.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            grade: true,
            school: true,
          },
        },
        stage: { select: { id: true, title: true, slug: true, startDate: true, endDate: true } },
        coach: { select: { id: true, pseudonym: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!bilan) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: bilan });
  } catch (error) {
    console.error('[GET /api/bilans/[id]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bilan' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bilans/[id]
 * Update bilan fields (scoring, markdowns, status, etc.)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check bilan exists
    const existing = await prisma.bilan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) updateData.status = body.status as BilanStatus;
    if (body.progress !== undefined) updateData.progress = body.progress;
    if (body.globalScore !== undefined) updateData.globalScore = body.globalScore;
    if (body.confidenceIndex !== undefined) updateData.confidenceIndex = body.confidenceIndex;
    if (body.ssn !== undefined) updateData.ssn = body.ssn;
    if (body.uai !== undefined) updateData.uai = body.uai;
    if (body.domainScores !== undefined) updateData.domainScores = body.domainScores;
    if (body.studentMarkdown !== undefined) updateData.studentMarkdown = body.studentMarkdown;
    if (body.parentsMarkdown !== undefined) updateData.parentsMarkdown = body.parentsMarkdown;
    if (body.nexusMarkdown !== undefined) updateData.nexusMarkdown = body.nexusMarkdown;
    if (body.analysisJson !== undefined) updateData.analysisJson = body.analysisJson;
    if (body.isPublished !== undefined) {
      updateData.isPublished = body.isPublished;
      if (body.isPublished && !existing.isPublished) {
        updateData.publishedAt = new Date();
      }
    }
    if (body.errorCode !== undefined) updateData.errorCode = body.errorCode;
    if (body.errorDetails !== undefined) updateData.errorDetails = body.errorDetails;
    if (body.retryCount !== undefined) updateData.retryCount = body.retryCount;
    if (body.ragUsed !== undefined) updateData.ragUsed = body.ragUsed;
    if (body.ragCollections !== undefined) updateData.ragCollections = body.ragCollections;
    if (body.sourceVersion !== undefined) updateData.sourceVersion = body.sourceVersion;
    if (body.engineVersion !== undefined) updateData.engineVersion = body.engineVersion;

    // Update bilan
    const updated = await prisma.bilan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Bilan updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/bilans/[id]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bilan' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bilans/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Auth check — ADMIN only for deletes
  const authResponse = await requireAnyRole(['ADMIN']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const { id } = await params;

    // Check bilan exists
    const existing = await prisma.bilan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Delete bilan
    await prisma.bilan.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Bilan deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/bilans/[id]] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bilan' },
      { status: 500 }
    );
  }
}
