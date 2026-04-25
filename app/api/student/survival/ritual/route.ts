export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_EXAM_DATE, snapshotFromStoredProgress } from '@/lib/survival/progress';
import { chooseDailyRitual } from '@/lib/survival/ritual-engine';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true, survivalMode: true, survivalProgress: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (!student.survivalMode) return NextResponse.json({ error: 'Survival mode disabled' }, { status: 403 });

    const snapshot = snapshotFromStoredProgress(student.survivalProgress);
    const examDate = student.survivalProgress?.examDate ?? new Date(DEFAULT_EXAM_DATE);
    return NextResponse.json({ ritual: chooseDailyRitual(snapshot, new Date(), examDate) });
  } catch (error) {
    console.error('[Student Survival Ritual API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
