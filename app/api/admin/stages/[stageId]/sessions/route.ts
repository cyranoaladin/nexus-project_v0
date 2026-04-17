export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { createSessionSchema } from '@/lib/stages/admin-schemas';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(session)) return session;

  const { stageId } = await params;

  try {
    const sessions = await prisma.stageSession.findMany({
      where: { stageId },
      orderBy: { startAt: 'asc' },
      include: {
        coach: {
          select: {
            id: true,
            pseudonym: true,
            subjects: true,
          },
        },
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[GET /api/admin/stages/[stageId]/sessions]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(session)) return session;

  const { stageId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (new Date(parsed.data.endAt) <= new Date(parsed.data.startAt)) {
    return NextResponse.json({ error: 'L’heure de fin doit être postérieure à l’heure de début' }, { status: 400 });
  }

  try {
    const stage = await prisma.stage.findUnique({ where: { id: stageId } });
    if (!stage) {
      return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
    }

    if (parsed.data.coachId) {
      const coach = await prisma.coachProfile.findUnique({ where: { id: parsed.data.coachId } });
      if (!coach) {
        return NextResponse.json({ error: 'Coach introuvable' }, { status: 400 });
      }
    }

    const createdSession = await prisma.stageSession.create({
      data: {
        stageId,
        ...parsed.data,
        startAt: new Date(parsed.data.startAt),
        endAt: new Date(parsed.data.endAt),
      },
      include: {
        coach: {
          select: {
            id: true,
            pseudonym: true,
            subjects: true,
          },
        },
      },
    });

    return NextResponse.json({ session: createdSession }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/stages/[stageId]/sessions]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
