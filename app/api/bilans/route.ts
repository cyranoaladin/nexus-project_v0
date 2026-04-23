/**
 * F50: Bilans API — CRUD Canonical
 * GET /api/bilans — List bilans with filtering
 * POST /api/bilans — Create new bilan
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import type { BilanType, BilanStatus, CreateBilanInput } from '@/lib/bilan/types';

export const dynamic = 'force-dynamic';

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

    // Parse filters
    const type = searchParams.get('type') as BilanType | null;
    const status = searchParams.get('status') as BilanStatus | null;
    const subject = searchParams.get('subject');
    const studentId = searchParams.get('studentId');
    const stageId = searchParams.get('stageId');
    const coachId = searchParams.get('coachId');
    const isPublished = searchParams.get('isPublished');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

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
    
    if (isPublished !== null) where.isPublished = isPublished === 'true';

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
    console.error('[GET /api/bilans] Error:', error);
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
    const body = await request.json();

    // Validate required fields
    if (!body.type || !body.subject || !body.studentEmail || !body.studentName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, subject, studentEmail, studentName' },
        { status: 400 }
      );
    }

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
        type: body.type as BilanType,
        subject: body.subject,
        studentEmail: body.studentEmail,
        studentName: body.studentName,
        studentPhone: body.studentPhone,
        studentId: body.studentId,
        stageId: body.stageId,
        coachId: body.coachId,
        sourceData: body.sourceData || {},
        globalScore: body.globalScore,
        confidenceIndex: body.confidenceIndex,
        domainScores: body.domainScores,
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
    console.error('[POST /api/bilans] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create bilan' },
      { status: 500 }
    );
  }
}
