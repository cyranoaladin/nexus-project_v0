export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

import { isErrorResponse, requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { assignCoachSchema } from '@/lib/stages/admin-schemas';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await requireRole(UserRole.ADMIN);
  if (isErrorResponse(session)) return session;

  const { stageId } = await params;

  try {
    const coaches = await prisma.stageCoach.findMany({
      where: { stageId },
      include: {
        coach: {
          select: {
            id: true,
            pseudonym: true,
            subjects: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ coaches });
  } catch (error) {
    console.error('[GET /api/admin/stages/[stageId]/coaches]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await requireRole(UserRole.ADMIN);
  if (isErrorResponse(session)) return session;

  const { stageId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = assignCoachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const [stage, coach, existingAssignment] = await Promise.all([
      prisma.stage.findUnique({ where: { id: stageId } }),
      prisma.coachProfile.findUnique({ where: { id: parsed.data.coachId } }),
      prisma.stageCoach.findFirst({
        where: {
          stageId,
          coachId: parsed.data.coachId,
        },
      }),
    ]);

    if (!stage) {
      return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
    }

    if (!coach) {
      return NextResponse.json({ error: 'Coach introuvable' }, { status: 400 });
    }

    if (existingAssignment) {
      return NextResponse.json({ error: 'Ce coach est déjà assigné au stage' }, { status: 409 });
    }

    const assignment = await prisma.stageCoach.create({
      data: {
        stageId,
        coachId: parsed.data.coachId,
        role: parsed.data.role,
      },
      include: {
        coach: {
          select: {
            id: true,
            pseudonym: true,
            subjects: true,
            description: true,
          },
        },
      },
    });

    return NextResponse.json({ coach: assignment }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/stages/[stageId]/coaches]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await requireRole(UserRole.ADMIN);
  if (isErrorResponse(session)) return session;

  const { stageId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = assignCoachSchema.pick({ coachId: true }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await prisma.stageCoach.deleteMany({
      where: {
        stageId,
        coachId: parsed.data.coachId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/stages/[stageId]/coaches]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
