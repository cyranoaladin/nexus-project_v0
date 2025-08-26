export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest) {
  try {
    const allow =
      process.env.E2E === '1' ||
      process.env.E2E_RUN === '1' ||
      process.env.NEXT_PUBLIC_E2E === '1' ||
      process.env.NODE_ENV === 'development';
    if (!allow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const coachProfiles = await prisma.coachProfile.findMany({ take: 5 });
    let created = 0;

    for (const cp of coachProfiles) {
      // Nettoyage pour état déterministe
      await prisma.coachAvailability.deleteMany({ where: { coachId: cp.id } });

      const now = new Date();
      const blocked = new Date(now.getTime() + 2 * 24 * 3600 * 1000);
      const days = [1, 3, 5]; // Lun, Mer, Ven après-midi
      const extra = [2, 4]; // Mar, Jeu matin

      const data: any[] = [];
      const coachUserId = cp.userId;
      for (const d of days) {
        data.push({
          coachId: coachUserId,
          dayOfWeek: d,
          startTime: '14:00',
          endTime: '18:00',
          isRecurring: true,
          isAvailable: true,
        });
      }
      for (const d of extra) {
        data.push({
          coachId: coachUserId,
          dayOfWeek: d,
          startTime: '09:00',
          endTime: '12:00',
          isRecurring: true,
          isAvailable: true,
        });
      }
      data.push({
        coachId: coachUserId,
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '12:00',
        isRecurring: true,
        isAvailable: true,
      });
      data.push({
        coachId: coachUserId,
        dayOfWeek: blocked.getDay(),
        startTime: '00:00',
        endTime: '23:59',
        specificDate: blocked,
        isAvailable: false,
        isRecurring: false,
      });
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getTime() + i * 24 * 3600 * 1000);
        data.push({
          coachId: coachUserId,
          dayOfWeek: d.getDay(),
          startTime: '10:00',
          endTime: '12:00',
          specificDate: d,
          isAvailable: true,
          isRecurring: false,
        });
        data.push({
          coachId: coachUserId,
          dayOfWeek: d.getDay(),
          startTime: '15:00',
          endTime: '17:00',
          specificDate: d,
          isAvailable: true,
          isRecurring: false,
        });
      }

      const res = await prisma.coachAvailability.createMany({ data, skipDuplicates: true });
      created += res.count;
    }

    return NextResponse.json({ success: true, created });
  } catch (e) {
    console.error('[SEED_AVAIL_ERROR]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
