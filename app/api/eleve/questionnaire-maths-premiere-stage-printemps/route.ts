import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const SOURCE_VERSION = 'maths_premiere_stage_printemps_v1';
const BILAN_TYPE = 'STAGE_POST' as const;
const BILAN_SUBJECT = 'MATHEMATIQUES';
const MAX_PAYLOAD_SIZE = 120_000; // 120 KB

const questionnaireSchema = z.object({
  answers: z.record(z.union([z.string(), z.array(z.string()), z.number()])),
  step: z.number().min(0).max(8).default(0),
  action: z.enum(['draft', 'submit']).default('draft'),
});

const QUESTIONNAIRE_META = {
  questionnaireSlug: "maths-premiere-stage-printemps",
  questionnaireVersion: 1,
  stageSlug: "stage-printemps-maths-1ere-eds-2026",
  level: "PREMIERE",
  subject: "MATHEMATIQUES",
  track: "EDS_GENERALE"
};

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

    return NextResponse.json({ success: true, bilan, student });
  } catch (error) {
    logger.error({ err: error }, '[API] questionnaire-maths-premiere GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionOrError = await requireRole('ELEVE');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    const bodyText = await request.text();
    if (bodyText.length > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: 'Payload too large', message: 'Payload exceeds limit of 120 KB.' },
        { status: 413 },
      );
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = questionnaireSchema.safeParse(parsedBody);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
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

    const structuredAnswers = {
      meta: QUESTIONNAIRE_META,
      profile: {
        fullName: answers.fullName,
        classLevel: answers.classLevel,
        school: answers.school,
        attendance: answers.attendance,
        missedSessions: answers.missedSessions,
        finalAssessmentTaken: answers.finalAssessmentTaken,
        peerCorrectionDone: answers.peerCorrectionDone,
      },
      beforeStage: {
        confidence: answers.beforeConfidence,
        stress: answers.beforeStress,
        difficulties: answers.beforeDifficulties,
        method: answers.beforeMethod,
        sentence: answers.beforeSentence,
      },
      automatismes: {
        calculationFluency: answers.calculationFluency,
        identities: answers.identities,
        factorisation: answers.factorisation,
        linearEquation: answers.linearEquation,
        sign: answers.sign,
        derivatives: answers.derivatives,
        exponentialRules: answers.exponentialRules,
        independenceFormula: answers.independenceFormula,
        strongestAutomation: answers.strongestAutomation,
        weakestAutomation: answers.weakestAutomation,
        recurringMistake: answers.recurringMistake,
      },
      analysis: {
        productDerivative: answers.productDerivative,
        quotientDerivative: answers.quotientDerivative,
        tangentEquation: answers.tangentEquation,
        derivativeSign: answers.derivativeSign,
        variationTable: answers.variationTable,
        exponentialPositivity: answers.exponentialPositivity,
        uniqueSolution: answers.uniqueSolution,
        hardestStep: answers.hardestStep,
      },
      sequences: {
        recurrenceVsExplicit: answers.recurrenceVsExplicit,
        arithmeticSequence: answers.arithmeticSequence,
        geometricSequence: answers.geometricSequence,
        explicitFormula: answers.explicitFormula,
        auxiliarySequence: answers.auxiliarySequence,
        sums: answers.sums,
        limit: answers.limit,
        pythonThreshold: answers.pythonThreshold,
        progressReflection: answers.progressReflection,
        mistakeToAvoid: answers.mistakeToAvoid,
      },
      scalarProduct: {
        coordinates: answers.coordinates,
        normAngle: answers.normAngle,
        orthogonality: answers.orthogonality,
        alKashi: answers.alKashi,
        medianFormula: answers.medianFormula,
        circleEquation: answers.circleEquation,
        preferredMethod: answers.preferredMethod,
      },
      probabilities: {
        weightedTree: answers.weightedTree,
        nodeSum: answers.nodeSum,
        pathProbability: answers.pathProbability,
        totalProbability: answers.totalProbability,
        bayes: answers.bayes,
        independenceVsIncompatibility: answers.independenceVsIncompatibility,
        hardestType: answers.hardestType,
      },
      finalAssessment: {
        timeManagement: answers.timeManagement,
        conciseJustification: answers.conciseJustification,
        writtenClarity: answers.writtenClarity,
        reusePreviousResults: answers.reusePreviousResults,
        rereading: answers.rereading,
        gradingCriteria: answers.gradingCriteria,
        nonDoublePenalty: answers.nonDoublePenalty,
        avoidableMistake: answers.avoidableMistake,
        peerFeedback: answers.peerFeedback,
        adviceForNextAssessment: answers.adviceForNextAssessment,
      },
      finalReview: {
        afterConfidence: answers.afterConfidence,
        afterStress: answers.afterStress,
        bestProgress: answers.bestProgress,
        priorityChapter: answers.priorityChapter,
        greatestSuccess: answers.greatestSuccess,
        mainDifficulty: answers.mainDifficulty,
        nextActions: answers.nextActions,
        needsSupport: answers.needsSupport,
        ariaNeeds: answers.ariaNeeds,
        globalRating: answers.globalRating,
        finalMessage: answers.finalMessage,
      },
    };

    const sourceData = {
      version: SOURCE_VERSION,
      meta: QUESTIONNAIRE_META,
      answers: structuredAnswers,
      rawAnswers: answers,
      step,
      submittedAt: isSubmission ? new Date().toISOString() : undefined,
    };

    const studentName = [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || student.user.email;

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
          progress: isSubmission ? 100 : Math.round(((step + 1) / 9) * 100),
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
          progress: isSubmission ? 100 : Math.round(((step + 1) / 9) * 100),
        },
      });
    }

    logger.info(
      { bilanId: bilan.id, studentId: student.id, action },
      '[API] questionnaire-maths-premiere saved',
    );

    return NextResponse.json({ success: true, bilan });
  } catch (error) {
    logger.error({ err: error }, '[API] questionnaire-maths-premiere POST failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
