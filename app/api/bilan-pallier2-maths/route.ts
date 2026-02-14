export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { bilanDiagnosticMathsSchema } from '@/lib/validations';
import { computeScoring } from '@/lib/bilan-scoring';
import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import { generateBilans } from '@/lib/bilan-generator';
import { buildQualityFlags } from '@/lib/diagnostics/llm-contract';
import { getDefinition, resolveDefinitionKey } from '@/lib/diagnostics/definitions';
import { DiagnosticStatus } from '@/lib/diagnostics/types';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { safeSubmissionLog, safeDiagnosticLog } from '@/lib/diagnostics/safe-log';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';

/**
 * POST /api/bilan-pallier2-maths
 *
 * Pipeline: Validate → Score → Save (SCORED) → Generate LLM (async) → Update (ANALYZED/FAILED)
 * Returns immediately after scoring with publicShareId for public bilan access.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // PII-safe logging (never log personal data)
    console.log(safeDiagnosticLog('RECEIVED', 'pending', { summary: safeSubmissionLog(body) as unknown as string }));

    // 1. Validate input against v1.3 schema
    const validatedData = bilanDiagnosticMathsSchema.parse(body);

    // 1b. Idempotency check: prevent duplicate submissions (same email + type within 5 min)
    const idempotencyKey = createHash('sha256')
      .update(`${validatedData.identity.email}|DIAGNOSTIC_PRE_STAGE_MATHS|${Math.floor(Date.now() / 300000)}`)
      .digest('hex');
    const existingDuplicate = await prisma.diagnostic.findFirst({
      where: {
        studentEmail: validatedData.identity.email,
        type: 'DIAGNOSTIC_PRE_STAGE_MATHS',
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true, publicShareId: true, status: true },
    });
    if (existingDuplicate) {
      console.log(safeDiagnosticLog('DUPLICATE_BLOCKED', existingDuplicate.id, { idempotencyKey }));
      return NextResponse.json({
        success: true,
        message: 'Diagnostic déjà soumis récemment.',
        id: existingDuplicate.id,
        publicShareId: existingDuplicate.publicShareId,
        status: existingDuplicate.status,
        duplicate: true,
      });
    }

    // 2. Resolve definition
    const defKey = 'maths-premiere-p2';
    const definition = getDefinition(defKey);

    // 3. Compute scoring V1 (backward compat) + V2 (new indices)
    const scoringV1 = computeScoring(validatedData);
    const scoringV2 = computeScoringV2(validatedData, definition.scoringPolicy);

    // 4. Build the full diagnostic data payload
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
      scoring: scoringV1 as unknown as Prisma.JsonObject,
      scoringV2: scoringV2 as unknown as Prisma.JsonObject,
    };

    // 5. Persist to database (initial save with SCORED status + metadata)
    const modelUsed = process.env.OLLAMA_MODEL || 'llama3.2:latest';
    const diagnostic = await prisma.diagnostic.create({
      data: {
        type: 'DIAGNOSTIC_PRE_STAGE_MATHS',
        definitionKey: defKey,
        definitionVersion: definition.version,
        promptVersion: definition.prompts.version,
        modelUsed,
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
        status: DiagnosticStatus.SCORED,
      },
    });

    // 6. Generate bilans (synchronous — Next.js standalone doesn't keep async promises)
    //    We await the generation, but respond with scoring immediately if it fails.
    let bilanStatus: string = DiagnosticStatus.SCORED;
    try {
      await prisma.diagnostic.update({
        where: { id: diagnostic.id },
        data: { status: DiagnosticStatus.GENERATING },
      });

      const bilans = await generateBilans(validatedData, scoringV1);

      // Build quality flags for structured analysis
      const qualityFlags = buildQualityFlags({
        ragAvailable: false, // Will be updated when RAG is populated
        ragHitCount: 0,
        llmSuccessCount: [bilans.eleve, bilans.parents, bilans.nexus].filter(Boolean).length,
        dataQuality: scoringV2.dataQuality.quality,
        coverageIndex: scoringV2.coverageIndex,
      });

      await prisma.diagnostic.update({
        where: { id: diagnostic.id },
        data: {
          status: DiagnosticStatus.ANALYZED,
          analysisResult: JSON.stringify({
            eleve: bilans.eleve,
            parents: bilans.parents,
            nexus: bilans.nexus,
            generatedAt: new Date().toISOString(),
          }),
          studentMarkdown: bilans.eleve,
          parentsMarkdown: bilans.parents,
          nexusMarkdown: bilans.nexus,
          analysisJson: {
            forces: scoringV2.domainScores.filter((d) => d.priority === 'low' || d.priority === 'medium').map((d) => ({
              domain: d.domain, label: d.domain, detail: `Score: ${d.score}%`, evidence: `${d.evaluatedCount}/${d.totalCount} évalués`,
            })),
            faiblesses: scoringV2.domainScores.filter((d) => d.priority === 'critical' || d.priority === 'high').map((d) => ({
              domain: d.domain, label: d.domain, detail: `Score: ${d.score}%`, evidence: d.gaps.join(', ') || 'aucun gap identifié',
            })),
            plan: [],
            ressources: [],
            qualityFlags,
            citations: [],
          } satisfies Prisma.JsonObject as unknown as Prisma.JsonObject,
          actionPlan: bilans.nexus,
          ragUsed: false,
          ragCollections: [],
        },
      });
      bilanStatus = DiagnosticStatus.ANALYZED;
    } catch (bilanError) {
      const errorMessage = bilanError instanceof Error ? bilanError.message : 'Unknown error';
      const errorCode = errorMessage.includes('timeout') ? 'OLLAMA_TIMEOUT'
        : errorMessage.includes('Empty') ? 'OLLAMA_EMPTY_RESPONSE'
        : 'UNKNOWN_ERROR';

      console.error(safeDiagnosticLog('LLM_FAILED', diagnostic.id, { errorCode, attempt: 1 }));
      await prisma.diagnostic.update({
        where: { id: diagnostic.id },
        data: {
          status: DiagnosticStatus.FAILED,
          errorCode,
          errorDetails: errorMessage.substring(0, 500),
          analysisResult: JSON.stringify({
            error: 'Génération LLM échouée — bilan template disponible via fallback',
            generatedAt: new Date().toISOString(),
          }),
        },
      });
      bilanStatus = DiagnosticStatus.FAILED;
    }

    return NextResponse.json({
      success: true,
      message: bilanStatus === DiagnosticStatus.ANALYZED
        ? 'Diagnostic enregistré et bilan généré avec succès.'
        : bilanStatus === DiagnosticStatus.FAILED
          ? 'Diagnostic enregistré avec scoring. La génération du bilan a échoué — un template de secours est disponible.'
          : 'Diagnostic enregistré avec scoring. Le bilan détaillé sera disponible prochainement.',
      id: diagnostic.id,
      publicShareId: diagnostic.publicShareId,
      status: bilanStatus,
      scoring: {
        readinessScore: scoringV2.readinessScore,
        riskIndex: scoringV2.riskIndex,
        masteryIndex: scoringV2.masteryIndex,
        coverageIndex: scoringV2.coverageIndex,
        examReadinessIndex: scoringV2.examReadinessIndex,
        recommendation: scoringV2.recommendation,
        recommendationMessage: scoringV2.recommendationMessage,
        justification: scoringV2.justification,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(safeDiagnosticLog('POST_ERROR', 'unknown', {
        type: error instanceof Error ? error.name : 'unknown',
        msg: error instanceof Error ? error.message.substring(0, 100) : 'unknown',
      }));
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

/**
 * GET /api/bilan-pallier2-maths
 *
 * Access modes:
 *   ?share=<publicShareId>  → Public access (student/parent bilan only, no Nexus tab)
 *   ?id=<diagnosticId>      → Staff-only access (full diagnostic with Nexus data)
 *   (no params)             → Staff-only list of all diagnostics (dashboard)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get('share');
    const id = searchParams.get('id');

    // --- Public access via publicShareId (student/parent) ---
    if (shareId) {
      const diagnostic = await prisma.diagnostic.findUnique({
        where: { publicShareId: shareId },
        select: {
          id: true,
          publicShareId: true,
          type: true,
          studentFirstName: true,
          studentLastName: true,
          status: true,
          mathAverage: true,
          establishment: true,
          data: true,
          studentMarkdown: true,
          parentsMarkdown: true,
          // NOTE: nexusMarkdown intentionally excluded from public access
          analysisResult: true,
          createdAt: true,
        },
      });

      if (!diagnostic) {
        return NextResponse.json({ error: 'Bilan non trouvé' }, { status: 404 });
      }

      return NextResponse.json({ diagnostic });
    }

    // --- Staff-only access below: require ADMIN, ASSISTANTE, or COACH role ---
    const authResult = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH'] as unknown as Parameters<typeof requireAnyRole>[0]);
    if (isErrorResponse(authResult)) {
      return authResult;
    }

    // Single diagnostic by internal ID (staff access — includes Nexus data)
    if (id) {
      const diagnostic = await prisma.diagnostic.findUnique({
        where: { id },
      });

      if (!diagnostic) {
        return NextResponse.json({ error: 'Diagnostic non trouvé' }, { status: 404 });
      }

      return NextResponse.json({ diagnostic });
    }

    // List all diagnostics (dashboard — staff only, data-minimized)
    const diagnostics = await prisma.diagnostic.findMany({
      where: {
        type: { in: ['PALLIER2_MATHS', 'DIAGNOSTIC_PRE_STAGE_MATHS'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        publicShareId: true,
        type: true,
        definitionKey: true,
        studentFirstName: true,
        studentLastName: true,
        studentEmail: true,
        status: true,
        mathAverage: true,
        establishment: true,
        classRanking: true,
        modelUsed: true,
        ragUsed: true,
        errorCode: true,
        retryCount: true,
        // NOTE: full 'data' excluded from list for data minimization
        // Only scoring summary is extracted below
        data: true,
        createdAt: true,
      },
    });

    // Data minimization: strip full data payload, keep only scoring summary
    const minimized = diagnostics.map((d: typeof diagnostics[number]) => {
      const rawData = d.data as Record<string, unknown> | null;
      const scoring = rawData?.scoringV2 || rawData?.scoring;
      return {
        ...d,
        data: scoring ? { scoring } : null,
      };
    });

    return NextResponse.json({ diagnostics: minimized });
  } catch (error) {
    console.error(safeDiagnosticLog('GET_ERROR', 'unknown', {
      msg: error instanceof Error ? error.message.substring(0, 100) : 'unknown',
    }));
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
