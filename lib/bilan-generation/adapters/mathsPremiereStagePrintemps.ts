// ─────────────────────────────────────────────────────────────────────────────
// lib/bilan-generation/adapters/mathsPremiereStagePrintemps.ts
// Adapter: maps CoachMathsSourceData → NormalizedBilanInput
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedBilanInput, NormalizedChapter } from '../types';
import type { CoachMathsSourceData } from '@/lib/coach/maths-premiere-stage-printemps/types';

const CHAPTER_LABELS: Record<string, string> = {
  secondDegree: 'Second degré et équations',
  derivation: 'Dérivation',
  sequences: 'Suites numériques',
  exponential: 'Fonction exponentielle',
  scalarProduct: 'Produit scalaire',
  probabilities: 'Probabilités conditionnelles',
};

const TONE_MAP: Record<string, string> = {
  REASSURING: 'rassurant',
  BALANCED: 'équilibré et constructif',
  FIRM_BUT_SUPPORTIVE: 'exigeant mais bienveillant',
};

const URGENCY_MAP: Record<string, string> = {
  NORMAL: 'suivi normal',
  WATCH: 'vigilance recommandée',
  IMPORTANT: 'action importante',
  PRIORITY: 'intervention prioritaire',
};

const PROFILE_MAP: Record<string, string> = {
  RAPID_PROGRESS: 'progression rapide avec bonne assimilation',
  STEADY_PROGRESS: 'progression régulière et constante',
  UNEVEN_PROGRESS: 'progression inégale selon les chapitres',
  FRAGILE_BUT_MOTIVATED: 'profil fragile mais motivé',
  FRAGILE_AND_DISCOURAGED: 'profil fragile avec besoin de remobilisation',
};

const WORK_PACE_MAP: Record<string, string> = {
  FAST_AND_ACCURATE: 'rapide et rigoureux',
  FAST_BUT_CARELESS: 'rapide mais manquant parfois de rigueur',
  SLOW_BUT_ACCURATE: 'méthodique et précis, besoin de travailler la vitesse',
  SLOW_AND_UNCERTAIN: 'lent et hésitant, nécessite consolidation des bases',
  IRREGULAR: 'rythme irrégulier selon les sujets',
};

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && !isNaN(v)) return v;
  return undefined;
}

export function adaptMathsPremiereStagePrintemps(
  bilanId: string,
  studentId: string,
  studentName: string,
  rawSourceData: unknown,
): NormalizedBilanInput {
  const sd = (rawSourceData ?? {}) as Partial<CoachMathsSourceData>;

  const globalDiag = sd.globalDiagnostic ?? {};
  const pra = sd.parentRecommendations ?? {};
  const auto = sd.automatismes ?? {};
  const attendance = sd.attendanceAndEngagement ?? {};
  const fa = sd.finalAssessment ?? {};
  const chapterDiags = sd.chapterDiagnostics ?? {};

  // Derive display name
  const nameParts = studentName.trim().split(' ');
  const firstName = nameParts[0];

  // Detect gender from available data (heuristic — no assumption if unknown)
  const gender: 'male' | 'female' | 'unknown' = 'unknown';

  // Build chapters from chapterDiagnostics
  const chapters: NormalizedChapter[] = Object.entries(chapterDiags)
    .filter(([, c]) => c && typeof c === 'object')
    .map(([key, c]) => {
      const ch = c as Record<string, unknown>;
      return {
        key,
        label: CHAPTER_LABELS[key] ?? key,
        mastery: num(ch.mastery),
        acquiredMethods: Array.isArray(ch.methodsAcquired)
          ? (ch.methodsAcquired as string[]).filter(Boolean)
          : undefined,
        vigilancePoints: Array.isArray(ch.vigilancePoints)
          ? (ch.vigilancePoints as string[]).filter(Boolean)
          : undefined,
        recurringErrors: Array.isArray(ch.recurringErrors)
          ? (ch.recurringErrors as string[]).filter(Boolean)
          : undefined,
        revealingExercise: str(ch.revealingExercise),
        specificStrength: str(ch.strength),
        priorityRemediation: str(ch.priorityRemediation),
      };
    })
    .filter(ch => ch.mastery !== undefined || ch.specificStrength || ch.priorityRemediation);

  // Build overall profile text
  const profileParts: string[] = [];
  if (globalDiag.overallProfile) profileParts.push(PROFILE_MAP[globalDiag.overallProfile] ?? '');
  if (globalDiag.workPace) profileParts.push(WORK_PACE_MAP[globalDiag.workPace] ?? '');

  // Priority axes: labeled
  const priorityAxes: string[] = Array.isArray(pra.priorityAxes)
    ? pra.priorityAxes.slice(0, 6).filter(Boolean)
    : [];

  // Competencies snapshot: automatismes + analysis + sequences + scalaire + probas
  const competencies: Record<string, unknown> = {};
  if (auto.calculationFluency) competencies['Fluidité de calcul'] = auto.calculationFluency;
  if (auto.identities) competencies['Identités remarquables'] = auto.identities;
  if (auto.linearEquation) competencies['Équations du premier degré'] = auto.linearEquation;
  if (auto.derivatives) competencies['Dérivées usuelles'] = auto.derivatives;

  const analysis = sd.analysis ?? {};
  if ((analysis as Record<string, unknown>).productDerivative) competencies['Dérivée produit'] = (analysis as Record<string, unknown>).productDerivative;
  if ((analysis as Record<string, unknown>).quotientDerivative) competencies['Dérivée quotient'] = (analysis as Record<string, unknown>).quotientDerivative;
  if ((analysis as Record<string, unknown>).variationTable) competencies['Tableau de variations'] = (analysis as Record<string, unknown>).variationTable;
  if ((analysis as Record<string, unknown>).exponentialPositivity) competencies['Signe de l\'exponentielle'] = (analysis as Record<string, unknown>).exponentialPositivity;

  const sequences = sd.sequences ?? {};
  if ((sequences as Record<string, unknown>).explicitFormula) competencies['Formule explicite suite'] = (sequences as Record<string, unknown>).explicitFormula;
  if ((sequences as Record<string, unknown>).auxiliarySequence) competencies['Suite auxiliaire'] = (sequences as Record<string, unknown>).auxiliarySequence;
  if ((sequences as Record<string, unknown>).sums) competencies['Calcul de sommes'] = (sequences as Record<string, unknown>).sums;

  const scalar = sd.scalarProduct ?? {};
  if ((scalar as Record<string, unknown>).coordinates) competencies['Produit scalaire (coord.)'] = (scalar as Record<string, unknown>).coordinates;
  if ((scalar as Record<string, unknown>).alKashi) competencies['Al-Kashi'] = (scalar as Record<string, unknown>).alKashi;

  const probas = sd.probabilities ?? {};
  if ((probas as Record<string, unknown>).weightedTree) competencies['Arbre pondéré'] = (probas as Record<string, unknown>).weightedTree;
  if ((probas as Record<string, unknown>).totalProbability) competencies['Probabilités totales'] = (probas as Record<string, unknown>).totalProbability;
  if ((probas as Record<string, unknown>).bayes) competencies['Formule de Bayes'] = (probas as Record<string, unknown>).bayes;
  if ((probas as Record<string, unknown>).independenceVsIncompatibility) competencies['Indépendance vs incompatibilité'] = (probas as Record<string, unknown>).independenceVsIncompatibility;
  if ((probas as Record<string, unknown>).conditionalProbabilityFormula) competencies['P(A|B)'] = (probas as Record<string, unknown>).conditionalProbabilityFormula;

  return {
    bilanId,
    student: {
      id: studentId,
      firstName,
      displayName: studentName,
      gender,
      gradeLevel: 'Première',
      track: 'Mathématiques (spécialité)',
    },
    context: {
      bilanKind: 'MATHS_PREMIERE_STAGE_PRINTEMPS',
      subject: 'Mathématiques',
      title: 'Stage intensif de printemps',
      durationHours: 14,
      periodLabel: 'Stage de printemps 2026',
      examTarget: 'Épreuves de spécialité Mathématiques (Première)',
    },
    coachInputs: {
      mainMessage: str(globalDiag.mainCoachMessage),
      doNotSay: str(pra.parentDoNotSay),
      tone: pra.parentTone ? (TONE_MAP[pra.parentTone] ?? pra.parentTone) : undefined,
      urgencyLevel: pra.parentUrgency ? (URGENCY_MAP[pra.parentUrgency] ?? pra.parentUrgency) : undefined,
    },
    attendanceAndEngagement: {
      attendance: str(attendance.attendance),
      punctuality: str(attendance.punctuality),
      involvement: num(attendance.involvement),
      concentration: num(attendance.concentration),
      coachComment: str(attendance.coachComment),
    },
    competencies: Object.keys(competencies).length > 0 ? competencies : undefined,
    chapters: chapters.length > 0 ? chapters : undefined,
    finalAssessment: {
      completed: fa.finalTestDone === 'DONE' || fa.finalTestDone === 'PARTIAL',
      approximateScore: num(fa.approximateScore),
      timeManagement: num(fa.timeManagement),
      instructionsUnderstanding: num(fa.instructionUnderstanding),
      writtenJustification: num(fa.writtenJustification),
      methodChoice: num(fa.methodSelection),
      resilience: num(fa.resilience),
      mostAvoidableMistake: str(fa.mostAvoidableMistake),
      strongestFinalTestPoint: str(fa.strongestFinalTestPoint),
      absolutePriority: str(fa.priorityBeforeExam),
    },
    priorityAxes: priorityAxes.length > 0 ? priorityAxes : undefined,
    legacySummary: str(pra.parentSummaryMessage) ?? str(globalDiag.mainCoachMessage),
    rawSourceData,
  };
}
