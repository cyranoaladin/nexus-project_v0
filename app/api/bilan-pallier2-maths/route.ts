export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { bilanDiagnosticMathsSchema } from '@/lib/validations';
import { computeScoring } from '@/lib/bilan-scoring';
import { generateBilans } from '@/lib/bilan-generator';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('Received diagnostic pré-stage:', JSON.stringify(body).substring(0, 500) + '...');
    }

    // 1. Validate input against v1.3 schema
    const validatedData = bilanDiagnosticMathsSchema.parse(body);

    // 2. Compute scoring (ReadinessScore, RiskIndex, Decision, Alerts)
    const scoring = computeScoring(validatedData);

    // 3. Build the full diagnostic data payload
    const diagnosticData: Prisma.JsonObject = {
      version: validatedData.version || 'v1.3',
      submittedAt: validatedData.submittedAt || new Date().toISOString(),
      identity: validatedData.identity as unknown as Prisma.JsonObject,
      schoolContext: validatedData.schoolContext as unknown as Prisma.JsonObject,
      performance: validatedData.performance as unknown as Prisma.JsonObject,
      chapters: validatedData.chapters as unknown as Prisma.JsonObject,
      competencies: validatedData.competencies as unknown as Prisma.JsonObject,
      openQuestions: validatedData.openQuestions as unknown as Prisma.JsonObject,
      examPrep: validatedData.examPrep as unknown as Prisma.JsonObject,
      methodology: validatedData.methodology as unknown as Prisma.JsonObject,
      ambition: validatedData.ambition as unknown as Prisma.JsonObject,
      freeText: validatedData.freeText as unknown as Prisma.JsonObject,
      scoring: scoring as unknown as Prisma.JsonObject,
    };

    // 4. Persist to database (initial save with SCORED status)
    const diagnostic = await prisma.diagnostic.create({
      data: {
        type: 'DIAGNOSTIC_PRE_STAGE_MATHS',
        studentFirstName: validatedData.identity.firstName,
        studentLastName: validatedData.identity.lastName,
        studentEmail: validatedData.identity.email,
        studentPhone: validatedData.identity.phone,
        establishment: validatedData.schoolContext.establishment,
        teacherName: validatedData.schoolContext.mathTeacher,
        mathAverage: validatedData.performance.mathAverage,
        specialtyAverage: validatedData.performance.mathAverage,
        bacBlancResult: validatedData.performance.lastTestScore,
        classRanking: validatedData.performance.classRanking,
        data: diagnosticData,
        status: 'SCORED',
      },
    });

    // 5. Generate bilans synchronously (Ollama/Qwen ~30-120s)
    //    Next.js standalone doesn't keep async promises after response,
    //    so we must await the generation before responding.
    let bilanStatus: 'ANALYZED' | 'SCORE_ONLY' = 'SCORE_ONLY';
    try {
      const bilans = await generateBilans(validatedData, scoring);

      await prisma.diagnostic.update({
        where: { id: diagnostic.id },
        data: {
          status: 'ANALYZED',
          analysisResult: JSON.stringify({
            eleve: bilans.eleve,
            parents: bilans.parents,
            nexus: bilans.nexus,
            generatedAt: new Date().toISOString(),
          }),
          actionPlan: bilans.nexus,
        },
      });
      bilanStatus = 'ANALYZED';
    } catch (bilanError) {
      console.error(`Erreur génération bilan pour ${diagnostic.id}:`, bilanError);
      await prisma.diagnostic.update({
        where: { id: diagnostic.id },
        data: {
          status: 'SCORE_ONLY',
          analysisResult: JSON.stringify({
            error: 'Génération LLM échouée — bilan template disponible via fallback',
            generatedAt: new Date().toISOString(),
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: bilanStatus === 'ANALYZED'
        ? 'Diagnostic enregistré et bilan généré avec succès.'
        : 'Diagnostic enregistré avec scoring. Le bilan détaillé sera disponible prochainement.',
      id: diagnostic.id,
      status: bilanStatus,
      scoring: {
        readinessScore: scoring.readinessScore,
        riskIndex: scoring.riskIndex,
        recommendation: scoring.recommendation,
        recommendationMessage: scoring.recommendationMessage,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Erreur enregistrement diagnostic pré-stage:', error);
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Données invalides', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single diagnostic by ID
    if (id) {
      const diagnostic = await prisma.diagnostic.findUnique({
        where: { id },
      });

      if (!diagnostic) {
        return NextResponse.json({ error: 'Diagnostic non trouvé' }, { status: 404 });
      }

      return NextResponse.json({ diagnostic });
    }

    // List all diagnostics
    const diagnostics = await prisma.diagnostic.findMany({
      where: {
        type: { in: ['PALLIER2_MATHS', 'DIAGNOSTIC_PRE_STAGE_MATHS'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        studentFirstName: true,
        studentLastName: true,
        studentEmail: true,
        status: true,
        mathAverage: true,
        establishment: true,
        classRanking: true,
        data: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ diagnostics });
  } catch (error) {
    console.error('Erreur récupération diagnostics:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
