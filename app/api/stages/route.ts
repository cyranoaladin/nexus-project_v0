export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const querySchema = z.object({
  open: z.string().optional(),
  level: z.string().optional(),
  subject: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const where: Record<string, unknown> = { isVisible: true };
  if (parsed.data.open === 'true') where.isOpen = true;
  if (parsed.data.level) where.level = { has: parsed.data.level };
  if (parsed.data.subject) where.subject = { has: parsed.data.subject };

  try {
    const stages = await prisma.stage.findMany({
      where,
      include: {
        _count: {
          select: {
            reservations: {
              where: { status: { in: ['PENDING', 'CONFIRMED'] } },
            },
          },
        },
        sessions: { orderBy: { startAt: 'asc' } },
        coaches: {
          include: {
            coach: { select: { pseudonym: true, subjects: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    return NextResponse.json({ stages });
  } catch (error) {
    console.error('[GET /api/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
