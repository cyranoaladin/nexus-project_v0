export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_EXAM_DATE, snapshotFromStoredProgress, toPrismaSurvivalData } from '@/lib/survival/progress';
import { QCM_BANK } from '@/lib/survival/qcm-bank';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json().catch(() => null) as {
      itemId?: string;
      givenAnswer?: string;
      timeSpentSec?: number;
    } | null;

    const question = QCM_BANK.find((item) => item.id === payload?.itemId);
    if (!question || typeof payload?.givenAnswer !== 'string') {
      return NextResponse.json({ error: 'Invalid QCM attempt payload' }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true, survivalMode: true, survivalProgress: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (!student.survivalMode) return NextResponse.json({ error: 'Survival mode disabled' }, { status: 403 });

    const isCorrect = payload.givenAnswer === question.correctAnswer;
    const snapshot = snapshotFromStoredProgress(student.survivalProgress);
    snapshot.qcmAttempts += 1;
    if (isCorrect) snapshot.qcmCorrect += 1;

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
        itemType: 'QCM',
        itemId: question.id,
        correctAnswer: question.correctAnswer,
        givenAnswer: payload.givenAnswer,
        isCorrect,
        timeSpentSec: Math.max(0, Math.floor(payload.timeSpentSec ?? 0)),
      },
    });

    return NextResponse.json({ progress, snapshot, isCorrect });
  } catch (error) {
    console.error('[Student Survival QCM Attempt API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
