/**
 * POST /api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate
 *
 * Regenerates the parentsMarkdown for an existing completed EAF bilan using the LLM.
 * Useful when a bilan was completed before the LLM pipeline was deployed,
 * or when the coach wants a fresh LLM-quality version.
 *
 * - Works on any COMPLETED bilan (published or not)
 * - Coach must be assigned to the student
 * - Does NOT change status or publishedAt
 */

import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  getCoachProfileForUser,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { COACH_EAF_META } from '@/lib/coach/eaf-stage-printemps/types';
import type { CoachEafSourceData } from '@/lib/coach/eaf-stage-printemps/types';
import { generateLLMParentEafReport } from '@/lib/coach/eaf-stage-printemps/llm-report';

export const maxDuration = 200;

const COACH_SOURCE_VERSION = 'coach_eaf_stage_printemps_v1';
const BILAN_TYPE = 'STAGE_POST' as const;
const BILAN_SUBJECT = 'FRANCAIS';

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    try {
      await assertCoachCanAccessStudent({ coachUserId: authSession.user.id, studentId });
    } catch (error) {
      if (error instanceof CoachNotAssignedError) {
        return NextResponse.json(
          { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
          { status: 403 }
        );
      }
      throw error;
    }

    const coachProfile = await getCoachProfileForUser(authSession.user.id);

    const bilan = await prisma.bilan.findFirst({
      where: {
        studentId,
        type: BILAN_TYPE,
        subject: BILAN_SUBJECT,
        sourceVersion: COACH_SOURCE_VERSION,
        status: 'COMPLETED',
        ...(coachProfile ? { coachId: coachProfile.id } : {}),
      },
      include: {
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!bilan) {
      return NextResponse.json(
        { error: 'Not found', message: 'Aucun bilan complété trouvé pour cet élève.' },
        { status: 404 }
      );
    }

    const sourceData = bilan.sourceData as Partial<CoachEafSourceData>;

    const { markdown, llmUsed, ragHitCount } = await generateLLMParentEafReport(sourceData, {
      firstName: bilan.student?.user?.firstName ?? undefined,
      lastName:  bilan.student?.user?.lastName  ?? undefined,
    });

    await prisma.bilan.update({
      where: { id: bilan.id },
      data: {
        parentsMarkdown: markdown,
        studentMarkdown: markdown,
        updatedAt: new Date(),
      },
    });

    logger.info(
      { bilanId: bilan.id, studentId, llmUsed, ragHitCount },
      '[API] EAF bilan parentsMarkdown regenerated'
    );

    return NextResponse.json({
      success: true,
      bilanId: bilan.id,
      llmUsed,
      ragHitCount,
      markdownLength: markdown.length,
    });
  } catch (error) {
    logger.error({ err: error }, '[API] EAF regenerate POST failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
