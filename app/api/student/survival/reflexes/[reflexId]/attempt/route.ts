export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getReflex } from '@/lib/survival/reflexes';
import { DEFAULT_EXAM_DATE, snapshotFromStoredProgress, toPrismaSurvivalData } from '@/lib/survival/progress';

export async function POST(
  request: Request,
  context: { params: Promise<{ reflexId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reflexId } = await context.params;
    const reflex = getReflex(reflexId);
    if (!reflex) {
      return NextResponse.json({ error: 'Unknown reflex' }, { status: 404 });
    }

    const payload = await request.json().catch(() => null) as {
      itemId?: string;
      givenAnswer?: string;
      correctAnswer?: string;
      isCorrect?: boolean;
      timeSpentSec?: number;
    } | null;

    if (!payload?.itemId || typeof payload.givenAnswer !== 'string' || typeof payload.correctAnswer !== 'string') {
      return NextResponse.json({ error: 'Invalid attempt payload' }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true, survivalMode: true, survivalProgress: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (!student.survivalMode) return NextResponse.json({ error: 'Survival mode disabled' }, { status: 403 });

    const snapshot = snapshotFromStoredProgress(student.survivalProgress);
    snapshot.reflexesState[reflex.id] = payload.isCorrect ? 'ACQUIS' : 'REVOIR';

    const progress = await prisma.survivalProgress.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        examDate: new Date(DEFAULT_EXAM_DATE),
        ...toPrismaSurvivalData(snapshot),
      },
      update: toPrismaSurvivalData(snapshot),
    });

    await prisma.survivalAttempt.create({
      data: {
        progressId: progress.id,
        itemType: 'REFLEX_QUIZ',
        itemId: payload.itemId,
        correctAnswer: payload.correctAnswer,
        givenAnswer: payload.givenAnswer,
        isCorrect: Boolean(payload.isCorrect),
        timeSpentSec: Math.max(0, Math.floor(payload.timeSpentSec ?? 0)),
      },
    });

    return NextResponse.json({ progress, snapshot });
  } catch (error) {
    console.error('[Student Survival Attempt API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
