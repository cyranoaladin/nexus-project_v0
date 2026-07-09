import { serializeError } from '@/lib/utils/serialize-error';
/**
 * Bilans API — CRUD Canonical
 * GET /api/bilans — List bilans with filtering
 * POST /api/bilans — Create new bilan
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { parseJsonBody } from '@/lib/api/helpers';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BILAN_TYPES = ['DIAGNOSTIC_PRE_STAGE', 'ASSESSMENT_QCM', 'STAGE_POST', 'CONTINUOUS'] as const;
const BILAN_STATUSES = ['PENDING', 'SCORING', 'GENERATING', 'COMPLETED', 'FAILED'] as const;

const listBilansQuerySchema = z.object({
  type: z.enum(BILAN_TYPES).optional(),
  status: z.enum(BILAN_STATUSES).optional(),
  subject: z.string().trim().min(1).max(80).optional(),
  studentId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/).optional(),
  stageId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/).optional(),
  coachId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/).optional(),
  isPublished: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
}).strict();

const createBilanBodySchema = z.object({
  type: z.enum(BILAN_TYPES),
  subject: z.string().trim().min(1).max(80),
  studentEmail: z.string().trim().email(),
  studentName: z.string().trim().min(1).max(180),
  studentPhone: z.string().trim().max(80).optional(),
  studentId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/).optional(),
  stageId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/).optional(),
  coachId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/).optional(),
  sourceData: z.record(z.unknown()).optional(),
  globalScore: z.number().min(0).max(100).optional(),
  confidenceIndex: z.number().min(0).max(100).optional(),
  domainScores: z.unknown().optional(),
}).strict();

function validationFailed() {
  return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
}

/**
 * GET /api/bilans
 * Query params: type, status, subject, studentId, stageId, coachId, isPublished, limit, offset
 */
export async function GET(request: NextRequest) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const { searchParams } = new URL(request.url);

    const parsedQuery = listBilansQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsedQuery.success) return validationFailed();
    const { type, status, subject, studentId, stageId, coachId, isPublished, limit, offset } = parsedQuery.data;

    // RBAC: Force coachId if role is COACH
    const userRole = (authResponse as any).user.role;
    const userId = (authResponse as any).user.id;
    let forcedCoachId = null;
    
    if (userRole === 'COACH') {
      const coachProfile = await prisma.coachProfile.findUnique({ where: { userId } });
      if (!coachProfile) {
        return NextResponse.json({ success: false, error: 'Profil coach introuvable' }, { status: 403 });
      }
      forcedCoachId = coachProfile.id;
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (subject) where.subject = subject;
    if (studentId) where.studentId = studentId;
    if (stageId) where.stageId = stageId;
    
    if (forcedCoachId) {
      where.coachId = forcedCoachId;
    } else if (coachId) {
      where.coachId = coachId;
    }
    
    if (isPublished !== undefined) where.isPublished = isPublished === 'true';

    // Fetch bilans
    const [bilans, total] = await Promise.all([
      prisma.bilan.findMany({
        where,
        take: Math.min(limit, 100),
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
          stage: { select: { id: true, title: true, slug: true } },
          coach: { select: { id: true, pseudonym: true } },
        },
      }),
      prisma.bilan.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: bilans,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + bilans.length < total,
      },
    });
  } catch (error) {
    console.error('[GET /api/bilans] Error:', serializeError(error));
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bilans' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bilans
 * Create a new bilan (in PENDING status)
 */
export async function POST(request: NextRequest) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody(request);
    } catch {
      return validationFailed();
    }
    const parsedBody = createBilanBodySchema.safeParse(rawBody);
    if (!parsedBody.success) return validationFailed();
    const body = parsedBody.data;

    // RBAC: Validate coachId if role is COACH
    const userRole = (authResponse as any).user.role;
    const userId = (authResponse as any).user.id;
    
    if (userRole === 'COACH') {
      const coachProfile = await prisma.coachProfile.findUnique({ where: { userId } });
      if (!coachProfile) {
        return NextResponse.json({ success: false, error: 'Profil coach introuvable' }, { status: 403 });
      }
      if (body.coachId && body.coachId !== coachProfile.id) {
        return NextResponse.json({ success: false, error: 'Interdit de créer un bilan pour un autre coach' }, { status: 403 });
      }
      // Force assignment if not provided
      if (!body.coachId) {
        body.coachId = coachProfile.id;
      }
    }

    // Create bilan
    const bilan = await prisma.bilan.create({
      data: {
        type: body.type as any,
        subject: body.subject,
        studentEmail: body.studentEmail,
        studentName: body.studentName,
        studentPhone: body.studentPhone,
        studentId: body.studentId,
        stageId: body.stageId,
        coachId: body.coachId,
        sourceData: (body.sourceData || {}) as any,
        globalScore: body.globalScore,
        confidenceIndex: body.confidenceIndex,
        domainScores: body.domainScores as any,
        status: 'PENDING',
        progress: 0,
        isPublished: false,
        retryCount: 0,
        ragUsed: false,
        ragCollections: [],
      },
    });

    return NextResponse.json({
      success: true,
      data: bilan,
      message: 'Bilan created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/bilans] Error:', serializeError(error));
    return NextResponse.json(
      { success: false, error: 'Failed to create bilan' },
      { status: 500 }
    );
  }
}
