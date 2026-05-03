/**
 * POST /api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent
 * Regenerate parent summary using Mistral AI for Maths Première Stage Printemps
 */

import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

const COACH_SOURCE_VERSION = 'coach_maths_premiere_stage_printemps_v1';
const BILAN_TYPE = 'STAGE_POST' as const;
const BILAN_SUBJECT = 'MATHEMATIQUES';

/**
 * POST /api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent
 * Regenerate parent summary using Mistral AI
 */
export async function POST(request: Request, { params }: RouteParams) {
  console.log('[POST regenerate-parent] Starting request');
  try {
    const { studentId } = await params;
    console.log('[POST regenerate-parent] studentId:', studentId);

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;
    console.log('[POST regenerate-parent] Authenticated coach:', authSession.user.id);

    // Verify coach assignment
    try {
      await assertCoachCanAccessStudent({ coachUserId: authSession.user.id, studentId });
      console.log('[POST regenerate-parent] Coach access verified');
    } catch {
      console.error('[POST regenerate-parent] Coach access denied');
      return NextResponse.json(
        { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
        { status: 403 }
      );
    }

    // Find the bilan
    const bilan = await prisma.bilan.findFirst({
      where: {
        studentId,
        type: BILAN_TYPE,
        subject: BILAN_SUBJECT,
        sourceVersion: COACH_SOURCE_VERSION,
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log('[POST regenerate-parent] Bilan found:', bilan?.id, 'has sourceData:', !!bilan?.sourceData);

    if (!bilan) {
      console.error('[POST regenerate-parent] Bilan not found');
      return NextResponse.json({ error: 'Bilan not found' }, { status: 404 });
    }

    if (!bilan.sourceData) {
      console.error('[POST regenerate-parent] Source data not found');
      return NextResponse.json({ error: 'Source data not found' }, { status: 400 });
    }

    const sourceData = bilan.sourceData as Record<string, unknown>;
    console.log('[POST regenerate-parent] Source data keys:', Object.keys(sourceData));
    console.log('[POST regenerate-parent] Calling Mistral...');

    // Extract data from sourceData for the prompt (Stage Printemps structure)
    const studentName = bilan.studentName;
    
    // Global diagnostic
    const globalDiag = sourceData.globalDiagnostic as Record<string, unknown> | undefined;
    const globalMessage = (globalDiag?.mainCoachMessage as string) || 'Message non renseigné';
    
    // Automatismes
    const automatismes = sourceData.automatismes as Record<string, unknown> | undefined;
    const strengths = (automatismes?.strongestAutomation as string) || 'Non renseigné';
    const weaknesses = (automatismes?.weakestAutomation as string) || 'Non renseigné';
    
    // Final assessment
    const finalAssessment = sourceData.finalAssessment as Record<string, unknown> | undefined;
    const score = finalAssessment?.approximateScore as number | undefined ?? 0;
    const timeNote = finalAssessment?.timeManagement as number | undefined ?? 0;
    const redactionNote = finalAssessment?.writtenJustification as number | undefined ?? 0;
    const positivePoint = (finalAssessment?.strongestFinalTestPoint as string) || 'Non renseigné';
    const avoidableError = (finalAssessment?.mostAvoidableMistake as string) || 'Non renseigné';
    
    // Chapter diagnostics
    const chapterDiags = sourceData.chapterDiagnostics as Record<string, unknown> | undefined;
    const chaptersArray = chapterDiags ? Object.keys(chapterDiags) : [];
    const chapters = chaptersArray.length > 0 ? chaptersArray.join(', ') : 'Non renseigné';

    // Extract parent recommendations for priority axes
    const parentRec = sourceData.parentRecommendations as Record<string, unknown> | undefined;
    const priorityAxes = parentRec?.priorityAxes as string[] || [];

    // Build the user message dynamically
    const userMessage = `Élève : ${studentName} - Niveau : Première Mathématiques
Message global du coach : ${globalMessage}
Points forts : ${strengths}
Points faibles : ${weaknesses}
Épreuve finale : ${score}/20. Temps (${timeNote}/5). Rédaction (${redactionNote}/5). Point positif : ${positivePoint}. Erreur évitable : ${avoidableError}.
Chapitres prioritaires à travailler : ${chapters}
Axes prioritaires : ${priorityAxes.join(', ') || 'Non renseigné'}

Rédige le bilan en Markdown avec exactement ces titres :
**1. Synthèse générale**
**2. Points d'appui**
**3. Axes d'amélioration prioritaires**
**4. Épreuve finale d'entraînement**
**5. Priorités des prochaines semaines**
**6. Recommandation finale**`;

    // Call Mistral API
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    console.log('[POST regenerate-parent] MISTRAL_API_KEY present:', !!mistralApiKey);
    if (!mistralApiKey) {
      return NextResponse.json({ error: 'MISTRAL_API_KEY not configured' }, { status: 500 });
    }

    let mistralResponse: Response;
    try {
      mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: `Tu es un rédacteur pédagogique expert pour Nexus Réussite.
Tu rédiges une synthèse destinée aux parents d'un élève de Première ayant suivi un stage intensif de mathématiques.
Ton texte doit être clair, fluide, bienveillant, exigeant et professionnel.
Tu ne dois jamais recopier mécaniquement les notes du coach.
Tu dois transformer les données brutes en un texte naturel.
Tu dois respecter les accords masculin/féminin lorsque le prénom ou les données permettent de l'inférer ; sinon rester neutre.
Tu ne dois jamais dénigrer le lycée, les professeurs ou l'établissement d'origine.
Tu ne dois pas mentionner les instructions.
Tu ne dois pas inventer de résultats non fournis.
Tu dois éviter les formulations buggées ou méta comme "ton ferme", "séquences", "données brutes", "le coach indique".
Tu dois produire uniquement le bilan final en Markdown propre.

Structure attendue :
**1. Synthèse générale**
**2. Points d'appui**
**3. Axes d'amélioration prioritaires**
**4. Épreuve finale d'entraînement**
**5. Priorités des prochaines semaines**
**6. Recommandation finale**

Exigences rédactionnelles :
- phrases complètes ;
- transitions naturelles ;
- pas de collage de champs ;
- pas de liste brute sauf lorsque c'est utile ;
- formulation prête à être envoyée aux parents ;
- ton sérieux, constructif et premium ;
- pas de promesse excessive ;
- pas de critique du lycée actuel ;
- pas de mot "mock", "stub", "séquence", "ton ferme".`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
    } catch (fetchErr) {
      console.error('[POST regenerate-parent] Mistral fetch threw:', fetchErr);
      return NextResponse.json({ error: 'Mistral fetch failed', details: String(fetchErr) }, { status: 500 });
    }
    console.log('[POST regenerate-parent] Mistral response status:', mistralResponse.status);

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text();
      console.error('[Mistral API Error]', errorText);
      return NextResponse.json({ error: 'Mistral API call failed', details: errorText }, { status: 500 });
    }

    const mistralData = await mistralResponse.json();
    const generatedMarkdown = mistralData.choices?.[0]?.message?.content;

    if (!generatedMarkdown) {
      return NextResponse.json({ error: 'No content generated by Mistral' }, { status: 500 });
    }

    // Update the bilan with the generated parent summary
    const updatedBilan = await prisma.bilan.update({
      where: { id: bilan.id },
      data: {
        parentsMarkdown: generatedMarkdown,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      bilan: updatedBilan,
      parentsMarkdown: generatedMarkdown,
    });
  } catch (error) {
    console.error('[POST regenerate-parent] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
