import { serializeError } from '@/lib/utils/serialize-error';
/**
 * Bilan Generation API
 * POST /api/bilans/generate — Trigger LLM generation for a bilan
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { BilanGenerator } from '@/lib/bilan/generator';
import type { BilanGenerationContext } from '@/lib/bilan/generator';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const safeIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/);

const generateBilanBodySchema = z.object({
  bilanId: safeIdSchema,
  enableRAG: z.boolean().default(true),
  ragCollections: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  ragQuery: z.string().trim().max(500).optional(),
  force: z.boolean().optional(),
}).strict();

const generationStatusQuerySchema = z.object({
  bilanId: safeIdSchema,
}).strict();

function validationFailed(message = 'Données invalides') {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

/**
 * POST /api/bilans/generate
 * Trigger LLM generation for an existing bilan
 */
export async function POST(request: NextRequest) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const rawBody = await request.json().catch(() => null);
    const parsedBody = generateBilanBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      const hasBilanId = rawBody && typeof rawBody === 'object' && 'bilanId' in rawBody;
      return validationFailed(hasBilanId ? undefined : 'Missing required field: bilanId');
    }
    const { bilanId, enableRAG, ragCollections, ragQuery, force } = parsedBody.data;

    // Fetch bilan
    const bilan = await prisma.bilan.findUnique({
      where: { id: bilanId },
    });

    if (!bilan) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Check if already generating
    if (bilan.status === 'GENERATING') {
      return NextResponse.json(
        { success: false, error: 'Bilan is already being generated' },
        { status: 409 }
      );
    }

    // Check if already completed
    if (bilan.status === 'COMPLETED' && !force) {
      return NextResponse.json(
        { success: false, error: 'Bilan already completed. Use force=true to regenerate.' },
        { status: 409 }
      );
    }

    // Build generation context
    const context: BilanGenerationContext = {
      bilanId: bilan.id,
      type: bilan.type as BilanGenerationContext['type'],
      subject: bilan.subject,
      studentName: bilan.studentName,
      studentEmail: bilan.studentEmail,
      studentPhone: bilan.studentPhone || undefined,
      sourceData: (bilan.sourceData as Record<string, unknown>) || {},
      globalScore: bilan.globalScore || undefined,
      confidenceIndex: bilan.confidenceIndex || undefined,
      ssn: bilan.ssn || undefined,
      uai: bilan.uai || undefined,
      domainScores: (bilan.domainScores as unknown as BilanGenerationContext['domainScores']) || undefined,
      enableRAG,
      ragCollections: ragCollections || ['methodologie', 'suites', 'derivation', 'probabilites'],
      ragQuery: ragQuery || buildRAGQueryFromBilan(bilan),
      sourceVersion: bilan.sourceVersion || undefined,
    };

    // Trigger generation asynchronously
    // Don't await — return immediately and let generation happen in background
    BilanGenerator.generateAndSave(context).catch(error => {
      console.error('[POST /api/bilans/generate] Background generation failed:', serializeError(error));
    });

    // Update status to GENERATING immediately
    await prisma.bilan.update({
      where: { id: bilanId },
      data: { status: 'GENERATING', progress: 25 },
    });

    return NextResponse.json({
      success: true,
      message: 'Generation started',
      data: {
        bilanId,
        status: 'GENERATING',
        progress: 25,
        estimatedCompletion: '30-60s',
      },
    });
  } catch (error) {
    console.error('[POST /api/bilans/generate] Error:', serializeError(error));
    return NextResponse.json(
      { success: false, error: 'Failed to start generation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bilans/generate
 * Check generation status
 */
export async function GET(request: NextRequest) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const { searchParams } = new URL(request.url);
    const queryObject = Object.fromEntries(searchParams.entries());
    const parsedQuery = generationStatusQuerySchema.safeParse(queryObject);
    if (!parsedQuery.success) {
      return validationFailed('bilanId' in queryObject ? undefined : 'Missing required param: bilanId');
    }
    const { bilanId } = parsedQuery.data;

    const bilan = await prisma.bilan.findUnique({
      where: { id: bilanId },
      select: {
        id: true,
        status: true,
        progress: true,
        studentMarkdown: true,
        parentsMarkdown: true,
        nexusMarkdown: true,
        errorCode: true,
        errorDetails: true,
        engineVersion: true,
        ragUsed: true,
        updatedAt: true,
      },
    });

    if (!bilan) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        bilanId: bilan.id,
        status: bilan.status,
        progress: bilan.progress,
        hasStudentMarkdown: !!bilan.studentMarkdown,
        hasParentsMarkdown: !!bilan.parentsMarkdown,
        hasNexusMarkdown: !!bilan.nexusMarkdown,
        errorCode: bilan.errorCode,
        errorDetails: bilan.errorDetails,
        engineVersion: bilan.engineVersion,
        ragUsed: bilan.ragUsed,
        updatedAt: bilan.updatedAt,
      },
    });
  } catch (error) {
    console.error('[GET /api/bilans/generate] Error:', serializeError(error));
    return NextResponse.json(
      { success: false, error: 'Failed to fetch generation status' },
      { status: 500 }
    );
  }
}

/**
 * Build a RAG query from bilan data
 */
function buildRAGQueryFromBilan(bilan: { subject: string; sourceData: unknown }): string {
  const data = (bilan.sourceData as Record<string, unknown>) || {};

  // Extract relevant keywords from source data
  const keywords: string[] = [];

  if (data.competencies && typeof data.competencies === 'object') {
    keywords.push(...Object.keys(data.competencies as object));
  }

  if (data.chapters && typeof data.chapters === 'object') {
    keywords.push(...Object.keys(data.chapters as object));
  }

  if (data.weaknesses && Array.isArray(data.weaknesses)) {
    keywords.push(...(data.weaknesses as string[]));
  }

  const query = keywords.length > 0
    ? `${bilan.subject} ${keywords.slice(0, 3).join(' ')}`
    : `${bilan.subject} méthodologie exercices`;

  return query;
}
