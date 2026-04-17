export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string }> }
) {
  const { stageSlug } = await params;

  try {
    const stage = await prisma.stage.findUnique({
      where: { slug: stageSlug, isVisible: true },
      include: {
        sessions: {
          orderBy: { startAt: 'asc' },
          include: {
            coach: { select: { pseudonym: true } },
            documents: { where: { isPublic: true } },
          },
        },
        coaches: {
          include: {
            coach: { select: { pseudonym: true, subjects: true } },
          },
        },
        _count: {
          select: {
            reservations: { where: { status: 'CONFIRMED' } },
          },
        },
      },
    });

    if (!stage) {
      return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
    }

    return NextResponse.json({ stage });
  } catch (error) {
    console.error('[GET /api/stages/[slug]]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
