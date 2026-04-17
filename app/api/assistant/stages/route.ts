export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  try {
    const stages = await prisma.stage.findMany({
      include: {
        _count: { select: { reservations: true } },
        reservations: { select: { richStatus: true, paymentStatus: true } },
        coaches: { include: { coach: { select: { pseudonym: true } } } },
        sessions: { orderBy: { startAt: 'asc' } },
      },
      orderBy: { startDate: 'asc' },
    });

    const kpis = {
      totalStages: stages.length,
      totalInscrits: stages.reduce((acc, s) => acc + s._count.reservations, 0),
      totalConfirmes: stages.reduce(
        (acc, s) => acc + s.reservations.filter((r) => r.richStatus === 'CONFIRMED').length,
        0
      ),
      totalAttente: stages.reduce(
        (acc, s) => acc + s.reservations.filter((r) => r.richStatus === 'WAITLISTED').length,
        0
      ),
      caEstime: stages.reduce(
        (acc, s) =>
          acc +
          Number(s.priceAmount) *
            s.reservations.filter((r) => r.richStatus === 'CONFIRMED').length,
        0
      ),
    };

    const stagesWithoutInternalReservations = stages.map(({ reservations: _r, ...s }) => ({
      ...s,
      subject: s.subject ?? [],
      level: s.level ?? [],
      sessions: (s.sessions ?? []).map((sess) => ({
        ...sess,
        startAt: sess.startAt.toISOString(),
        endAt: sess.endAt.toISOString(),
      })),
    }));

    return NextResponse.json({ stages: stagesWithoutInternalReservations, kpis });
  } catch (error) {
    console.error('[GET /api/assistant/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
