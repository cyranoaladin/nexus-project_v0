import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { maybeCreateGeneratedReportJob } from '@/lib/reports/stage/maybeCreateGeneratedReportJob';

const SOURCE_VERSION = 'eaf_stage_printemps_v1';
const BILAN_TYPE = 'STAGE_POST' as const;
const BILAN_SUBJECT = 'FRANCAIS';
const MAX_PAYLOAD_SIZE = 100_000; // 100 KB

// Schema de validation strict pour les réponses
const questionnaireSchema = z.object({
  answers: z.record(z.union([z.string(), z.array(z.string())])),
  step: z.number().min(0).max(7).default(0),
  action: z.enum(['draft', 'submit']).default('draft'),
});

const QUESTIONNAIRE_META = {
  questionnaireSlug: "eaf-stage-printemps-ecrit-francais",
  questionnaireVersion: 1,
  stageSlug: "stage-printemps-2026",
  level: "PREMIERE",
  subject: "FRANCAIS"
};

/**
 * GET /api/eleve/questionnaire-eaf-stage-printemps
 * Returns the student's existing EAF questionnaire response (draft or submitted).
 */
export async function GET() {
  try {
    const sessionOrError = await requireRole('ELEVE');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    const student = await prisma.student.findUnique({
      where: { userId: authSession.user.id },
      select: {
        id: true,
        gradeLevel: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.gradeLevel !== 'PREMIERE') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Ce questionnaire est réservé aux élèves de Première.' },
        { status: 403 },
      );
    }

    const bilan = await prisma.bilan.findFirst({
      where: {
        studentId: student.id,
        type: BILAN_TYPE,
        subject: BILAN_SUBJECT,
        sourceVersion: SOURCE_VERSION,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!bilan) {
      return NextResponse.json({ bilan: null });
    }

    const studentName = student.user
      ? [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || student.user.email
      : 'Élève';

    return NextResponse.json({ bilan, studentName });
  } catch (error) {
    logger.error({ err: error }, '[API] questionnaire-eaf-stage-printemps GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/eleve/questionnaire-eaf-stage-printemps
 * Create or update the student's EAF questionnaire response.
 */
export async function POST(request: Request) {
  try {
    const sessionOrError = await requireRole('ELEVE');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    // Protection contre les payloads trop volumineux
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: 'Payload too large', message: 'Le contenu dépasse la taille maximale autorisée.' },
        { status: 413 },
      );
    }

    const json = await request.json();
    const result = questionnaireSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Validation échouée', details: result.error.format() },
        { status: 400 },
      );
    }

    const { answers, step, action } = result.data;

    const student = await prisma.student.findUnique({
      where: { userId: authSession.user.id },
      select: {
        id: true,
        gradeLevel: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.gradeLevel !== 'PREMIERE') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Ce questionnaire est réservé aux élèves de Première.' },
        { status: 403 },
      );
    }

    const isSubmission = action === 'submit';

    // Restructuration des réponses selon les exigences de l'audit
    const structuredAnswers = {
      meta: QUESTIONNAIRE_META,
      profile: {
        fullName: answers.fullName,
        classLevel: answers.classLevel,
        school: answers.school,
        attendance: answers.attendance,
        missedSessions: answers.missedSessions
      },
      beforeStage: {
        confidence: answers.beforeConfidence,
        stress: answers.beforeStress,
        difficulties: answers.beforeDifficulties,
        method: answers.beforeMethod,
        sentence: answers.beforeSentence
      },
      examMethod: {
        expectationsClear: answers.expectationsClear,
        readVsAnalyze: answers.readVsAnalyze,
        quoteVsInterpret: answers.quoteVsInterpret,
        courseVsSubject: answers.courseVsSubject,
        timeManagement: answers.timeManagement,
        bestUnderstoodExpectation: answers.bestUnderstoodExpectation,
        unclearExpectation: answers.unclearExpectation
      },
      commentary: {
        understand: answers.commentaryUnderstand,
        issues: answers.commentaryIssues,
        project: answers.commentaryProject,
        noParaphrase: answers.commentaryNoParaphrase,
        quoteAnalysis: answers.commentaryQuote,
        plan: answers.commentaryPlan,
        clearItems: answers.commentaryClearItems,
        bestTip: answers.commentaryBestTip,
        stillWork: answers.commentaryStillWork
      },
      dissertation: {
        accessible: answers.dissertationAccessible,
        subject: answers.dissertationSubject,
        noOffTopic: answers.dissertationNoOffTopic,
        problem: answers.dissertationProblem,
        plan: answers.dissertationPlan,
        references: answers.dissertationReferences,
        clearItems: answers.dissertationClearItems,
        hardest: answers.dissertationHardest
      },
      writing: {
        clarity: answers.writingClarity,
        vocabulary: answers.writingVocabulary,
        paragraphs: answers.writingParagraphs,
        ideas: answers.writingIdeas,
        stillHard: answers.writingStillHard,
        remembered: answers.writingRemembered
      },
      support: {
        supportsClear: answers.supportsClear,
        exercisesLevel: answers.exercisesLevel,
        correctionsDetailed: answers.correctionsDetailed,
        teacherClear: answers.teacherClear,
        questionsComfort: answers.questionsComfort,
        futureUse: answers.futureUse,
        mostUsefulSupports: answers.mostUsefulSupports,
        appreciatedSupport: answers.appreciatedSupport,
        improveSupport: answers.improveSupport
      },
      finalReview: {
        afterConfidence: answers.afterConfidence,
        afterStress: answers.afterStress,
        progressFeeling: answers.progressFeeling,
        bestProgress: answers.bestProgress,
        priorityWork: answers.priorityWork,
        globalRating: answers.globalRating,
        recommendRating: answers.recommendRating,
        mostImportantBenefit: answers.mostImportantBenefit,
        nextActions: answers.nextActions,
        finalMessage: answers.finalMessage
      }
    };

    const sourceData = {
      version: SOURCE_VERSION,
      meta: QUESTIONNAIRE_META,
      answers: structuredAnswers,
      rawAnswers: answers, // Garder une copie plate pour compatibilité UI immédiate si besoin
      step,
      submittedAt: isSubmission ? new Date().toISOString() : undefined,
    };

    const studentName = [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || student.user.email;

    // Verrouillage : Si déjà soumis, on ne peut plus modifier (sauf si action=draft pour sauvegarde de secours?)
    // Regle métier : Une fois COMPLETED, on ne touche plus.
    const existingBilan = await prisma.bilan.findFirst({
      where: {
        studentId: student.id,
        type: BILAN_TYPE,
        subject: BILAN_SUBJECT,
        sourceVersion: SOURCE_VERSION,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingBilan && existingBilan.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Locked', message: 'Ce bilan a déjà été soumis et ne peut plus être modifié.' },
        { status: 403 },
      );
    }

    let bilan;
    if (existingBilan) {
      bilan = await prisma.bilan.update({
        where: { id: existingBilan.id },
        data: {
          sourceData: sourceData as any,
          status: isSubmission ? 'COMPLETED' : 'PENDING',
          progress: isSubmission ? 100 : Math.round(((step + 1) / 8) * 100),
          updatedAt: new Date(),
        },
      });
    } else {
      bilan = await prisma.bilan.create({
        data: {
          type: BILAN_TYPE,
          subject: BILAN_SUBJECT,
          studentId: student.id,
          studentEmail: student.user.email,
          studentName,
          sourceData: sourceData as any,
          sourceVersion: SOURCE_VERSION,
          status: isSubmission ? 'COMPLETED' : 'PENDING',
          progress: isSubmission ? 100 : Math.round(((step + 1) / 8) * 100),
        },
      });
    }

    logger.info(
      { bilanId: bilan.id, studentId: student.id, action },
      '[API] questionnaire-eaf-stage-printemps saved',
    );

    let generatedReportJobStatus = null;
    if (isSubmission) {
      generatedReportJobStatus = await maybeCreateGeneratedReportJob({
        studentId: student.id,
        subject: 'FRANCAIS',
        kind: 'EAF_STAGE_POST',
        stageSlug: QUESTIONNAIRE_META.stageSlug,
      });
    }

    return NextResponse.json({ success: true, bilan, generatedReportJobStatus });
  } catch (error) {
    logger.error({ err: error }, '[API] questionnaire-eaf-stage-printemps POST failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
