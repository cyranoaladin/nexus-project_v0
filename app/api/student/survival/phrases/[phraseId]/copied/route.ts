export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getPhraseMagique } from '@/lib/survival/phrases';
import { DEFAULT_EXAM_DATE, snapshotFromStoredProgress, toPrismaSurvivalData } from '@/lib/survival/progress';

const lastCopyByUserAndPhrase = new Map<string, number>();

export async function POST(
  _request: Request,
  context: { params: Promise<{ phraseId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phraseId } = await context.params;
    const phrase = getPhraseMagique(phraseId);
    if (!phrase) {
      return NextResponse.json({ error: 'Unknown phrase' }, { status: 404 });
    }

    const key = `${session.user.id}:${phraseId}`;
    const now = Date.now();
    if ((lastCopyByUserAndPhrase.get(key) ?? 0) > now - 1000) {
      return NextResponse.json({ error: 'Too many copy events' }, { status: 429 });
    }
    lastCopyByUserAndPhrase.set(key, now);

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true, survivalMode: true, survivalProgress: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (!student.survivalMode) return NextResponse.json({ error: 'Survival mode disabled' }, { status: 403 });

    const snapshot = snapshotFromStoredProgress(student.survivalProgress);
    snapshot.phrasesState[phrase.id] = (snapshot.phrasesState[phrase.id] ?? 0) + 1;

    const progress = await prisma.survivalProgress.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        examDate: new Date(DEFAULT_EXAM_DATE),
        ...toPrismaSurvivalData(snapshot),
      },
      update: toPrismaSurvivalData(snapshot),
    });

    return NextResponse.json({ progress, snapshot });
  } catch (error) {
    console.error('[Student Survival Phrase API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
