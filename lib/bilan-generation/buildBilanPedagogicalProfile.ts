// ─────────────────────────────────────────────────────────────────────────────
// lib/bilan-generation/buildBilanPedagogicalProfile.ts
// Builds a structured PedagogicalProfile from normalized input.
// This is computed by code — Mistral receives the profile, not raw JSON.
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedBilanInput, PedagogicalProfile, NormalizedChapter } from './types';

function masteryLabel(n?: number): string {
  if (!n) return 'non évalué';
  const labels = ['', 'très fragile', 'fragile', 'en progression', 'satisfaisant', 'maîtrisé'];
  return labels[Math.round(n)] ?? 'non évalué';
}

function masteryPriority(n?: number): 'high' | 'medium' | 'low' {
  if (!n || n <= 2) return 'high';
  if (n === 3) return 'medium';
  return 'low';
}

function scoreInterpretation(score?: number): string {
  if (score === undefined) return '';
  if (score >= 16) return 'Excellente performance, confirme une maîtrise solide.';
  if (score >= 13) return 'Bonne performance, base saine pour la suite.';
  if (score >= 10) return 'Performance correcte avec des marges de progression identifiées.';
  if (score >= 7) return 'Performance en deçà du niveau attendu, points de vigilance importants.';
  return 'Performance insuffisante, nécessite un travail intensif immédiat.';
}

export function buildBilanPedagogicalProfile(
  input: NormalizedBilanInput,
): PedagogicalProfile {
  const { coachInputs, chapters, finalAssessment, priorityAxes, attendanceAndEngagement } = input;

  // ── Executive diagnosis ──────────────────────────────────────────────────

  const missingFields: string[] = [];
  if (!coachInputs.mainMessage) missingFields.push('message principal du coach');
  if (!chapters || chapters.length === 0) missingFields.push('diagnostic par chapitre');
  if (!finalAssessment?.approximateScore) missingFields.push('score épreuve finale');

  const overallLevel = (() => {
    if (!chapters || chapters.length === 0) return 'Niveau global non évalué par chapitre';
    const avg = chapters.filter(c => c.mastery !== undefined).reduce((s, c) => s + (c.mastery ?? 0), 0)
      / (chapters.filter(c => c.mastery !== undefined).length || 1);
    return masteryLabel(Math.round(avg));
  })();

  const learningDynamic = coachInputs.mainMessage ?? 'Dynamique observée au cours du stage.';

  const highPriorityChapters = (chapters ?? []).filter(c => masteryPriority(c.mastery) === 'high');
  const mainRisk = highPriorityChapters.length > 0
    ? `Fragilités prioritaires sur : ${highPriorityChapters.map(c => c.label).join(', ')}.`
    : 'Aucune fragilité critique identifiée.';

  const mainLever = coachInputs.mainMessage
    ? `Levier principal : ${coachInputs.mainMessage}`
    : priorityAxes?.length
      ? `Axes prioritaires identifiés : ${priorityAxes.slice(0, 3).join(', ')}.`
      : 'Renforcement des méthodes travaillées durant le stage.';

  // ── Key strengths ────────────────────────────────────────────────────────

  const keyStrengths: PedagogicalProfile['keyStrengths'] = [];

  (chapters ?? [])
    .filter(c => (c.mastery ?? 0) >= 4 || c.specificStrength)
    .slice(0, 3)
    .forEach(c => {
      keyStrengths.push({
        title: c.label,
        evidence: c.specificStrength ?? `Maîtrise ${masteryLabel(c.mastery)} observée.`,
        pedagogicalValue: c.acquiredMethods?.length
          ? `Méthodes acquises : ${c.acquiredMethods.slice(0, 2).join(', ')}.`
          : 'Chapitre consolidé, peut servir de point d\'appui.',
      });
    });

  if (finalAssessment?.strongestFinalTestPoint) {
    keyStrengths.push({
      title: 'Épreuve finale',
      evidence: finalAssessment.strongestFinalTestPoint,
      pedagogicalValue: 'Qualité confirmée en conditions d\'évaluation.',
    });
  }

  if (attendanceAndEngagement?.involvement && attendanceAndEngagement.involvement >= 4) {
    keyStrengths.push({
      title: 'Engagement et implication',
      evidence: `Niveau d'implication : ${attendanceAndEngagement.involvement}/5.`,
      pedagogicalValue: 'Attitude positive, moteur de progression.',
    });
  }

  // ── Priority weaknesses ──────────────────────────────────────────────────

  const priorityWeaknesses: PedagogicalProfile['priorityWeaknesses'] = [];

  (chapters ?? [])
    .filter(c => masteryPriority(c.mastery) === 'high')
    .slice(0, 4)
    .forEach((c: NormalizedChapter) => {
      const errors = c.recurringErrors?.slice(0, 2).join(', ');
      const vigilance = c.vigilancePoints?.slice(0, 2).join(', ');
      priorityWeaknesses.push({
        title: c.label,
        evidence: errors
          ? `Erreurs récurrentes : ${errors}.`
          : vigilance
            ? `Points de vigilance : ${vigilance}.`
            : `Maîtrise ${masteryLabel(c.mastery)}.`,
        consequence: `Les lacunes sur ce chapitre peuvent impacter directement les épreuves de spécialité.`,
        recommendedAction: c.priorityRemediation
          ? c.priorityRemediation
          : `Entraînement ciblé avec exercices types-bac sur ${c.label}.`,
      });
    });

  if (finalAssessment?.mostAvoidableMistake) {
    priorityWeaknesses.push({
      title: 'Erreur évitable à l\'épreuve',
      evidence: finalAssessment.mostAvoidableMistake,
      consequence: 'Ces erreurs représentent une perte de points directement récupérables.',
      recommendedAction: 'Mettre en place une relecture systématique en fin d\'épreuve.',
    });
  }

  // ── Chapter priorities ───────────────────────────────────────────────────

  const chapterPriorities: PedagogicalProfile['chapterPriorities'] = (chapters ?? [])
    .filter(c => c.mastery !== undefined)
    .map(c => ({
      chapter: c.label,
      level: masteryLabel(c.mastery),
      priority: masteryPriority(c.mastery),
      why: c.vigilancePoints?.length
        ? c.vigilancePoints.slice(0, 2).join('. ')
        : `Maîtrise ${masteryLabel(c.mastery)}, travail de consolidation nécessaire.`,
      actionPlan: c.priorityRemediation
        ? c.priorityRemediation
        : `Exercices d'application et révision des méthodes clés de ${c.label}.`,
    }))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });

  // ── Final assessment reading ─────────────────────────────────────────────

  let finalAssessmentReading: PedagogicalProfile['finalAssessmentReading'] | undefined;

  if (finalAssessment?.completed !== false) {
    const score = finalAssessment?.approximateScore;
    const warnings: string[] = [];
    const positives: string[] = [];

    if (finalAssessment?.writtenJustification && finalAssessment.writtenJustification <= 2)
      warnings.push('Rédaction et justification insuffisantes');
    if (finalAssessment?.methodChoice && finalAssessment.methodChoice <= 2)
      warnings.push('Choix des méthodes à consolider');
    if (finalAssessment?.mostAvoidableMistake)
      warnings.push(`Erreur évitable : ${finalAssessment.mostAvoidableMistake}`);

    if (finalAssessment?.timeManagement && finalAssessment.timeManagement >= 4)
      positives.push('Bonne gestion du temps');
    if (finalAssessment?.resilience && finalAssessment.resilience >= 4)
      positives.push('Bonne résilience face aux difficultés');
    if (finalAssessment?.strongestFinalTestPoint)
      positives.push(finalAssessment.strongestFinalTestPoint);

    finalAssessmentReading = {
      score: score !== undefined ? `${score}/20` : undefined,
      interpretation: score !== undefined
        ? scoreInterpretation(score)
        : 'Épreuve réalisée — score non renseigné.',
      warningPoints: warnings,
      positiveSigns: positives,
    };
  }

  // ── Parent guidance ──────────────────────────────────────────────────────

  const parentGuidance: PedagogicalProfile['parentGuidance'] = {
    tone: coachInputs.tone ?? 'équilibré et constructif',
    urgency: coachInputs.urgencyLevel ?? 'suivi normal',
    whatToAvoidSaying: coachInputs.doNotSay,
    mainMessage: coachInputs.mainMessage,
  };

  // ── Data quality ─────────────────────────────────────────────────────────

  const uncertaintyNotes: string[] = [];
  if (missingFields.includes('score épreuve finale'))
    uncertaintyNotes.push('Interpréter l\'épreuve sans score précis.');
  if (!chapters || chapters.length < 3)
    uncertaintyNotes.push('Diagnostic par chapitre partiel — se baser sur les données disponibles.');

  return {
    executiveDiagnosis: { overallLevel, learningDynamic, mainRisk, mainLever },
    keyStrengths,
    priorityWeaknesses,
    chapterPriorities,
    finalAssessmentReading,
    parentGuidance,
    dataQuality: { missingImportantFields: missingFields, uncertaintyNotes },
  };
}
