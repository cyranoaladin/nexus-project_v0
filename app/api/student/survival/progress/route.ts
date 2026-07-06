import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_EXAM_DATE, normalizeSurvivalSnapshot, snapshotFromStoredProgress, toPrismaSurvivalData } from '@/lib/survival/progress';
import type { SurvivalState } from '@/lib/survival/types';
import { z } from 'zod';

const survivalStateSchema = z.enum(['ACQUIS', 'REVOIR', 'PAS_VU']);
const survivalProgressPayloadSchema = z.object({
  reflexesState: z.record(z.string().trim().min(1).max(80), survivalStateSchema).optional(),
  phrasesState: z.record(z.string().trim().min(1).max(80), z.coerce.number().int().min(0).max(10_000)).optional(),
  rituals: z.array(z.object({
    date: z.string().trim().min(1).max(40),
    taskId: z.string().trim().min(1).max(120),
    completed: z.boolean(),
  }).strict()).max(500).optional(),
}).strict();

async function getCurrentSurvivalStudent() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ELEVE') {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      userId: true,
      academicTrack: true,
      survivalMode: true,
      survivalProgress: true,
    },
  });

  if (!student) {
    return { error: NextResponse.json({ error: 'Student not found' }, { status: 404 }) };
  }

  if (!student.survivalMode) {
    return { error: NextResponse.json({ error: 'Survival mode disabled' }, { status: 403 }) };
  }

  return { student };
}

export async function GET() {
  try {
    const current = await getCurrentSurvivalStudent();
    if ('error' in current) return current.error;

    const snapshot = snapshotFromStoredProgress(current.student.survivalProgress);
    const progress = current.student.survivalProgress ?? await prisma.survivalProgress.create({
      data: {
        studentId: current.student.id,
        examDate: new Date(DEFAULT_EXAM_DATE),
        ...toPrismaSurvivalData(snapshot),
      },
    });

    return NextResponse.json({ progress, snapshot: snapshotFromStoredProgress(progress) });
  } catch (error) {
    console.error('[Student Survival Progress API] GET error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const current = await getCurrentSurvivalStudent();
    if ('error' in current) return current.error;

    const rawPayload = await request.json().catch(() => null);
    const parsedPayload = survivalProgressPayloadSchema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const payload = parsedPayload.data as Partial<{
      reflexesState: Record<string, SurvivalState>;
      phrasesState: Record<string, number>;
      rituals: Array<{ date: string; taskId: string; completed: boolean }>;
    }>;

    const currentSnapshot = snapshotFromStoredProgress(current.student.survivalProgress);
    const nextSnapshot = normalizeSurvivalSnapshot({
      ...currentSnapshot,
      reflexesState: { ...currentSnapshot.reflexesState, ...(payload.reflexesState ?? {}) },
      phrasesState: { ...currentSnapshot.phrasesState, ...(payload.phrasesState ?? {}) },
      rituals: payload.rituals ?? currentSnapshot.rituals,
    });

    const progress = await prisma.survivalProgress.upsert({
      where: { studentId: current.student.id },
      create: {
        studentId: current.student.id,
        examDate: new Date(DEFAULT_EXAM_DATE),
        ...toPrismaSurvivalData(nextSnapshot),
      },
      update: toPrismaSurvivalData(nextSnapshot),
    });

    return NextResponse.json({ progress, snapshot: nextSnapshot });
  } catch (error) {
    console.error('[Student Survival Progress API] POST error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
