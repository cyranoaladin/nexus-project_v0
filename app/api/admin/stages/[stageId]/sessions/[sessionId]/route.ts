export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { updateSessionSchema } from '@/lib/stages/admin-schemas';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string; sessionId: string }> }
) {
  const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(session)) return session;

  const { stageId, sessionId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = updateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  if (payload.startAt && payload.endAt && new Date(payload.endAt) <= new Date(payload.startAt)) {
    return NextResponse.json({ error: 'L’heure de fin doit être postérieure à l’heure de début' }, { status: 400 });
  }

  try {
    const existingSession = await prisma.stageSession.findFirst({
      where: {
        id: sessionId,
        stageId,
      },
    });

    if (!existingSession) {
      return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 });
    }

    if (payload.coachId) {
      const coach = await prisma.coachProfile.findUnique({ where: { id: payload.coachId } });
      if (!coach) {
        return NextResponse.json({ error: 'Coach introuvable' }, { status: 400 });
      }
    }

    const updatedSession = await prisma.stageSession.update({
      where: { id: sessionId },
      data: {
        ...payload,
        startAt: payload.startAt ? new Date(payload.startAt) : undefined,
        endAt: payload.endAt ? new Date(payload.endAt) : undefined,
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

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error('[PATCH /api/admin/stages/[stageId]/sessions/[sessionId]]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ stageId: string; sessionId: string }> }
) {
  const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(session)) return session;

  const { stageId, sessionId } = await params;

  try {
    const existingSession = await prisma.stageSession.findFirst({
      where: {
        id: sessionId,
        stageId,
      },
    });

    if (!existingSession) {
      return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 });
    }

    await prisma.stageSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/stages/[stageId]/sessions/[sessionId]]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
