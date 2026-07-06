import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getReflex } from '@/lib/survival/reflex-data';
import { DEFAULT_EXAM_DATE, snapshotFromStoredProgress, toPrismaSurvivalData } from '@/lib/survival/progress';
import { z } from 'zod';

const reflexParamsSchema = z.object({
  reflexId: z.string().trim().min(1).max(80).regex(/^reflex_[0-9]+$/),
}).strict();
const reflexAttemptSchema = z.object({
  itemId: z.string().trim().min(1).max(80),
  givenAnswer: z.string().trim().min(1).max(200),
  timeSpentSec: z.coerce.number().finite().nonnegative().max(24 * 60 * 60).optional(),
}).strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ reflexId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsedParams = reflexParamsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid reflex' }, { status: 400 });
    }
    const { reflexId } = parsedParams.data;
    const reflex = getReflex(reflexId);
    if (!reflex) {
      return NextResponse.json({ error: 'Unknown reflex' }, { status: 404 });
    }

    const parsedPayload = reflexAttemptSchema.safeParse(await request.json().catch(() => null));
    if (!parsedPayload.success) {
      return NextResponse.json({ error: 'Invalid attempt payload' }, { status: 400 });
    }
    const payload = parsedPayload.data;

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true, survivalMode: true, survivalProgress: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (!student.survivalMode) return NextResponse.json({ error: 'Survival mode disabled' }, { status: 403 });

    const quizItem = reflex.miniQuiz.find((q) => q.id === payload.itemId);
    if (!quizItem) {
      return NextResponse.json({ error: 'Unknown quiz item' }, { status: 400 });
    }
    const isCorrectServer = payload.givenAnswer === quizItem.answer;

    const snapshot = snapshotFromStoredProgress(student.survivalProgress);
    snapshot.reflexesState[reflex.id] = isCorrectServer ? 'ACQUIS' : 'REVOIR';

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
        correctAnswer: quizItem.answer,
        givenAnswer: payload.givenAnswer,
        isCorrect: isCorrectServer,
        timeSpentSec: Math.max(0, Math.floor(payload.timeSpentSec ?? 0)),
      },
    });

    return NextResponse.json({ progress, snapshot });
  } catch (error) {
    console.error('[Student Survival Attempt API] POST error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
