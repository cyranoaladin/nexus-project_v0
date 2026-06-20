import type { CoachMathsSourceData } from './types';

type StudentInfo = {
  firstName?: string;
  lastName?: string;
  gradeLevel?: string;
};

const _ATTENDANCE_LABELS: Record<string, string> = {
  'excellente': 'excellente',
  'reguliere': 'régulière',
  'irreguliere': 'irrégulière',
  'insuffisante': 'insuffisante',
};

const _PUNCTUALITY_LABELS: Record<string, string> = {
  'tres-satisfaisante': 'très satisfaisante',
  'satisfaisante': 'satisfaisante',
  'a-ameliorer': 'à améliorer',
};

const _ATTITUDE_LABELS: Record<string, string> = {
  'perseverant': 'persévérant(e)',
  'volontaire-mais-hesitant': 'volontaire mais parfois hésitant(e)',
  'manque-de-confiance': 'manquant encore de confiance en ses capacités',
  'se-decourage-rapidement': 'ayant tendance à se décourager face aux difficultés',
  'besoin-detre-guide': "ayant besoin d'être davantage guidé(e)",
};

const _LEVEL_LABELS: Record<string, string> = {
  'tres-solide': 'très solide',
  'satisfaisant': 'satisfaisant',
  'fragile-mais-en-progres': 'fragile mais en progression',
  'fragile': 'fragile',
  'preoccupant': 'préoccupant et nécessitant un travail intensif',
};

const FOLLOW_UP_LABELS: Record<string, string> = {
  'autonomie-sufficient': "Votre enfant dispose d'une autonomie suffisante pour progresser seul(e) à condition de maintenir un travail régulier.",
  'consolidation-ponctuelle': 'Une consolidation ponctuelle est recommandée pour renforcer les acquis du stage.',
  'accompagnement-regulier': 'Un accompagnement régulier est recommandé pour ancrer les méthodes travaillées et poursuivre la progression.',
  'entrainement-intensif': "Un entraînement intensif avant les prochaines épreuves est vivement recommandé pour consolider les bases.",
};

const AXIS_LABELS: Record<string, string> = {
  'second-degre': 'second degré',
  'derivation': 'dérivation',
  'suites': 'suites numériques',
  'exponentielle': 'fonction exponentielle',
  'produit-scalaire': 'produit scalaire',
  'probabilites-conditionnelles': 'probabilités conditionnelles',
  'automatismes': 'automatismes et calculs',
  'redaction-justification': 'rédaction et justification mathématique',
  'gestion-du-temps': 'gestion du temps',
};

// New structured labels
const PROFILE_LABELS: Record<string, string> = {
  'RAPID_PROGRESS': 'progression rapide',
  'STEADY_PROGRESS': 'progression régulière',
  'UNEVEN_PROGRESS': 'progression inégale',
  'FRAGILE_BUT_MOTIVATED': 'fragile mais motivé',
  'FRAGILE_AND_DISCOURAGED': 'fragile et découragé',
};

const WORK_PACE_LABELS: Record<string, string> = {
  'FAST_AND_ACCURATE': 'rapide et précis',
  'FAST_BUT_CARELESS': 'rapide mais imprécis',
  'SLOW_BUT_ACCURATE': 'lent mais précis',
  'SLOW_AND_UNCERTAIN': 'lent et hésitant',
  'IRREGULAR': 'irrégulier',
};

const URGENCY_LABELS: Record<string, string> = {
  'NORMAL': 'pas d\'inquiétude particulière',
  'WATCH': 'à surveiller',
  'IMPORTANT': 'nécessite une action',
  'PRIORITY': 'intervention prioritaire',
};

const TONE_LABELS: Record<string, string> = {
  'REASSURING': 'rassurant',
  'BALANCED': 'équilibré',
  'FIRM_BUT_SUPPORTIVE': 'ferme mais bienveillant',
};

const CHAPTER_LABELS: Record<string, string> = {
  'secondDegree': 'Second degré',
  'derivation': 'Dérivation',
  'sequences': 'Suites numériques',
  'exponential': 'Fonction exponentielle',
  'scalarProduct': 'Produit scalaire',
  'probabilities': 'Probabilités conditionnelles',
};

// Anti-repetition utility
function deduplicateLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter(line => {
    const normalized = line.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalized.length === 0) return true;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/[.!?]$/, '').replace(/\s+/g, ' ');
}

function isRedundant(newText: string, existingTexts: string[]): boolean {
  const normalizedNew = normalizeText(newText);
  return existingTexts.some(existing => {
    const normalizedExisting = normalizeText(existing);
    // Exact match
    if (normalizedNew === normalizedExisting) return true;
    // One contains the other (for longer texts)
    if (normalizedNew.length > 20 && normalizedExisting.includes(normalizedNew.substring(0, 20))) return true;
    if (normalizedExisting.length > 20 && normalizedNew.includes(normalizedExisting.substring(0, 20))) return true;
    return false;
  });
}

function ratingToLabel(rating?: number): string {
  if (!rating) return 'non évalué';
  const labels = ['', 'insuffisant', 'fragile', 'en progression', 'satisfaisant', 'maîtrisé'];
  return labels[rating] ?? 'non évalué';
}

function studentName(student: StudentInfo): string {
  const parts = [student.firstName, student.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Votre enfant';
}

/**
 * Generate parent report with structured data and anti-repetition logic.
 * Uses structured fields, limits redundancy, produces concise synthesis.
 */
export function generateParentMathsStageReport(
  sourceData: Partial<CoachMathsSourceData>,
  student: StudentInfo,
  reportDate?: Date,
): string {
  const name = studentName(student);
  const date = reportDate ?? new Date();
  const dateStr = date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const lines: string[] = [];
  const usedTexts: string[] = []; // Track for anti-repetition

  // Helper to add line with redundancy check
  const addLine = (text: string, force = false) => {
    if (!text || text.trim().length === 0) return;
    if (!force && isRedundant(text, usedTexts)) return;
    lines.push(text);
    usedTexts.push(text);
  };

  // Header
  lines.push('BILAN PÉDAGOGIQUE — STAGE DE PRINTEMPS MATHÉMATIQUES');
  lines.push('Spécialité Mathématiques (Première EDS)');
  lines.push('');
  lines.push(`Élève : ${name}`);
  lines.push(`Stage : Mathématiques Première (Printemps 2026)`);
  lines.push(`Date du bilan : ${dateStr}`);
  lines.push('');
  lines.push('═'.repeat(60));

  // ===== 1. SYNTHÈSE GÉNÉRALE =====
  const globalDiag = sourceData.globalDiagnostic ?? {};
  const pra = sourceData.parentRecommendations ?? {};

  lines.push('');
  lines.push('1. SYNTHÈSE GÉNÉRALE');
  lines.push('');

  // Profile description
  if (globalDiag.overallProfile) {
    const profileLabel = PROFILE_LABELS[globalDiag.overallProfile] ?? globalDiag.overallProfile;
    addLine(`${name} présente une ${profileLabel} durant ce stage.`);
  }

  // Work pace
  if (globalDiag.workPace) {
    const paceLabel = WORK_PACE_LABELS[globalDiag.workPace] ?? globalDiag.workPace;
    addLine(`Rythme de travail observé : ${paceLabel}.`);
  }

  // Main coach message - prioritized over legacy parentSummaryMessage
  if (globalDiag.mainCoachMessage) {
    addLine('');
    addLine(globalDiag.mainCoachMessage);
  }

  // Parent urgency and tone
  if (pra.parentUrgency || pra.parentTone) {
    addLine('');
    const urgency = pra.parentUrgency ? URGENCY_LABELS[pra.parentUrgency] : '';
    const tone = pra.parentTone ? TONE_LABELS[pra.parentTone] : '';
    if (urgency && tone) {
      addLine(`Niveau d'attention : ${urgency} (ton ${tone}).`);
    } else if (urgency) {
      addLine(`Niveau d'attention : ${urgency}.`);
    }
  }

  // Parent main message - prioritized over legacy
  if (pra.parentMainMessage) {
    addLine('');
    addLine(pra.parentMainMessage);
  }

  // ===== 2. POINTS D'APPUI =====
  const strengths: string[] = [];

  // From automatismes
  const auto = sourceData.automatismes ?? {};
  if (auto.strongestAutomation && !isRedundant(auto.strongestAutomation, usedTexts)) {
    strengths.push(auto.strongestAutomation);
  }

  // From chapter diagnostics
  const chapterDiags = sourceData.chapterDiagnostics ?? {};
  for (const [key, chapter] of Object.entries(chapterDiags)) {
    if (chapter?.strength && !isRedundant(chapter.strength, usedTexts)) {
      strengths.push(`${CHAPTER_LABELS[key] ?? key} : ${chapter.strength}`);
    }
  }

  // From final assessment
  const fa = sourceData.finalAssessment ?? {};
  if (fa.strongestFinalTestPoint && !isRedundant(fa.strongestFinalTestPoint, usedTexts)) {
    strengths.push(`Épreuve finale : ${fa.strongestFinalTestPoint}`);
  }

  if (strengths.length > 0) {
    lines.push('');
    lines.push('2. POINTS D\'APPUI');
    lines.push('');
    strengths.slice(0, 4).forEach(s => addLine(`  • ${s}`));
  }

  // ===== 3. POINTS DE VIGILANCE =====
  const vigilance: string[] = [];

  // From automatismes
  if (auto.weakestAutomation && !isRedundant(auto.weakestAutomation, usedTexts)) {
    vigilance.push(auto.weakestAutomation);
  }

  // From chapter diagnostics
  for (const [key, chapter] of Object.entries(chapterDiags)) {
    if (chapter?.vigilancePoints) {
      chapter.vigilancePoints.forEach((v: string) => {
        if (!isRedundant(v, usedTexts)) vigilance.push(`${CHAPTER_LABELS[key] ?? key} : ${v}`);
      });
    }
  }

  // From final assessment
  if (fa.mostAvoidableMistake && !isRedundant(fa.mostAvoidableMistake, usedTexts)) {
    vigilance.push(`À éviter : ${fa.mostAvoidableMistake}`);
  }

  if (vigilance.length > 0) {
    lines.push('');
    lines.push('3. POINTS DE VIGILANCE');
    lines.push('');
    vigilance.slice(0, 4).forEach(v => addLine(`  • ${v}`));
  }

  // ===== 4. DIAGNOSTIC PAR CHAPITRE =====
  const chaptersWithData = Object.entries(chapterDiags).filter(([, c]) => c?.mastery !== undefined);

  if (chaptersWithData.length > 0) {
    lines.push('');
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push('4. DIAGNOSTIC PAR CHAPITRE');
    lines.push('');

    for (const [key, chapter] of chaptersWithData) {
      const label = CHAPTER_LABELS[key] ?? key;
      lines.push(`${label} : ${ratingToLabel(chapter?.mastery)}`);

      // Methods acquired
      if (chapter?.methodsAcquired && chapter.methodsAcquired.length > 0) {
        addLine(`  Méthodes : ${chapter.methodsAcquired.slice(0, 3).join(', ')}`);
      }

      // Recurring errors
      if (chapter?.recurringErrors && chapter.recurringErrors.length > 0) {
        const errorText = chapter.recurringErrors.slice(0, 2).join(', ');
        if (!isRedundant(errorText, usedTexts)) {
          addLine(`  Attention : ${errorText}`);
        }
      }

      // Priority remediation
      if (chapter?.priorityRemediation && !isRedundant(chapter.priorityRemediation, usedTexts)) {
        addLine(`  Priorité : ${chapter.priorityRemediation}`);
      }

      lines.push('');
    }
  }

  // ===== 5. ÉPREUVE FINALE =====
  if (fa.finalTestDone && fa.finalTestDone !== 'NOT_DONE') {
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push('5. ÉPREUVE FINALE');
    lines.push('');

    const statusLabel = fa.finalTestDone === 'DONE' ? 'réalisée complètement' : 'partiellement réalisée';
    addLine(`Épreuve ${statusLabel}.`);

    if (fa.approximateScore !== undefined) {
      addLine(`Score estimé : ${fa.approximateScore}/20.`);
    }

    const ratings: string[] = [];
    if (fa.timeManagement) ratings.push(`gestion du temps ${ratingToLabel(fa.timeManagement)}`);
    if (fa.writtenJustification) ratings.push(`rédaction ${ratingToLabel(fa.writtenJustification)}`);
    if (fa.methodSelection) ratings.push(`choix méthodes ${ratingToLabel(fa.methodSelection)}`);
    if (fa.resilience) ratings.push(`résilience ${ratingToLabel(fa.resilience)}`);

    if (ratings.length > 0) {
      addLine(`Compétences observées : ${ratings.join(', ')}.`);
    }

    if (fa.priorityBeforeExam && !isRedundant(fa.priorityBeforeExam, usedTexts)) {
      addLine('');
      addLine(`Priorité avant le bac : ${fa.priorityBeforeExam}`);
    }
  }

  // ===== 6. PRIORITÉS DES DEUX PROCHAINES SEMAINES =====
  const allPriorities: string[] = [];

  // From chapter diagnostics
  for (const [_key, chapter] of Object.entries(chapterDiags)) {
    if (chapter?.priorityRemediation && !isRedundant(chapter.priorityRemediation, allPriorities)) {
      allPriorities.push(chapter.priorityRemediation);
    }
  }

  // From final assessment
  if (fa.priorityBeforeExam && !isRedundant(fa.priorityBeforeExam, allPriorities)) {
    allPriorities.push(fa.priorityBeforeExam);
  }

  // From parent recommendations (max 3 axes)
  if (pra.priorityAxes && pra.priorityAxes.length > 0) {
    const axes = pra.priorityAxes.slice(0, 3).map((a: string) => AXIS_LABELS[a] ?? a);
    addLine('');
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push('6. PRIORITÉS DES DEUX PROCHAINES SEMAINES');
    lines.push('');
    axes.forEach((axis: string) => addLine(`  • ${axis}`));
  } else if (allPriorities.length > 0) {
    addLine('');
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push('6. PRIORITÉS DES DEUX PROCHAINES SEMAINES');
    lines.push('');
    allPriorities.slice(0, 3).forEach(p => addLine(`  • ${p}`));
  }

  // ===== 7. RECOMMANDATION FINALE =====
  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push('7. RECOMMANDATION FINALE');
  lines.push('');

  // Follow up recommendation
  if (pra.recommendedFollowUp) {
    addLine(FOLLOW_UP_LABELS[pra.recommendedFollowUp] ?? pra.recommendedFollowUp);
  }

  // Legacy parentSummaryMessage - only used if no new structured fields, and reformulated
  if (pra.parentSummaryMessage && !pra.parentMainMessage && !globalDiag.mainCoachMessage) {
    const summary = pra.parentSummaryMessage.trim();
    // Don't use if too similar to what's already been said
    if (!isRedundant(summary, usedTexts)) {
      addLine('');
      addLine('Note du coach :');
      // Truncate if too long and redundant with other sections
      const summaryShort = summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
      addLine(summaryShort);
    }
  }

  // What not to say
  if (pra.parentDoNotSay) {
    addLine('');
    addLine(`À éviter dans les échanges : ${pra.parentDoNotSay}`);
  }

  // Footer
  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push("Ce bilan a été rédigé par l'équipe pédagogique Nexus Réussite.");
  lines.push('Il est destiné aux familles et strictement confidentiel.');

  // Final deduplication pass
  return deduplicateLines(lines).join('\n');
}
