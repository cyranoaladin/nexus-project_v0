import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { validateNsiProgressPayload } from '@/lib/nsi-pratique-2026/progress-validation';
import type { Prisma } from '@prisma/client';

const MAX_PAYLOAD_SIZE = 200 * 1024; // 200 KB

/**
 * GET /api/eleve/nsi-pratique-2026/progress
 * Returns the student's NSI practice progress from server.
 */
export async function GET() {
  try {
    const sessionOrError = await requireRole('ELEVE');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const session = sessionOrError;

    const record = await prisma.nsiPracticeProgress.findUnique({
      where: { userId: session.user.id },
      select: { data: true, updatedAt: true, version: true },
    });

    if (!record) {
      return NextResponse.json({ data: null, updatedAt: null }, { status: 200 });
    }

    return NextResponse.json({
      data: record.data,
      updatedAt: record.updatedAt.toISOString(),
      version: record.version,
    });
  } catch (error) {
    console.error('[NSI Progress GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/eleve/nsi-pratique-2026/progress
 * Saves/updates the student's NSI practice progress.
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionOrError = await requireRole('ELEVE');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const session = sessionOrError;

    // Check content length header
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: 'Payload too large (max 200KB)' },
        { status: 413 }
      );
    }

    const body = await request.json();

    // Validate payload envelope
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { data } = body;

    // Validate and sanitize progress data with Zod
    const validation = validateNsiProgressPayload(data);
    if (!validation.valid) {
      const status = validation.error.includes('too large') ? 413 : 400;
      return NextResponse.json({ error: validation.error }, { status });
    }

    // Cast validated data to Prisma-compatible JSON type
    const progressData = validation.data as unknown as Prisma.InputJsonValue;

    const record = await prisma.nsiPracticeProgress.upsert({
      where: { userId: session.user.id },
      update: { data: progressData },
      create: { userId: session.user.id, data: progressData },
    });

    return NextResponse.json({
      success: true,
      updatedAt: record.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[NSI Progress PUT] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
