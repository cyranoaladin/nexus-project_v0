import type { CoachEafSourceData } from './types';

type StudentInfo = {
  firstName?: string;
  lastName?: string;
  gradeLevel?: string;
};

const ATTENDANCE_LABELS: Record<string, string> = {
  'excellente': 'excellente',
  'reguliere': 'régulière',
  'irreguliere': 'irrégulière',
  'insuffisante': 'insuffisante',
};

const PUNCTUALITY_LABELS: Record<string, string> = {
  'tres-satisfaisante': 'très satisfaisante',
  'satisfaisante': 'satisfaisante',
  'a-ameliorer': 'à améliorer',
};

const ATTITUDE_LABELS: Record<string, string> = {
  'perseverant': 'persévérant(e)',
  'volontaire-mais-hesitant': 'volontaire mais parfois hésitant(e)',
  'manque-de-confiance': 'manquant encore de confiance en ses capacités',
  'se-decourage-rapidement': 'ayant tendance à se décourager face aux difficultés',
  'besoin-detre-guide': "ayant besoin d'être davantage guidé(e)",
};

const PROGRESS_LABELS: Record<string, string> = {
  'tres-nette': 'très nette',
  'nette': 'nette',
  'moderee': 'modérée',
  'legere': 'légère',
  'insuffisante': 'insuffisante sur la durée du stage',
};

const SKILL_LABELS: Record<string, string> = {
  'comprehension-des-textes': 'la compréhension des textes littéraires',
  'analyse-des-citations': "l'analyse et l'interprétation des citations",
  'construction-du-plan': 'la construction du plan',
  'redaction': 'la qualité de rédaction',
  'dissertation': 'la méthode de la dissertation',
  'commentaire': 'la méthode du commentaire',
  'gestion-du-temps': "la gestion du temps en conditions d'examen",
  'confiance': "la confiance à l'écrit",
  'methode': 'la méthode de travail générale',
};

const LEVEL_LABELS: Record<string, string> = {
  'tres-solide': 'très solide',
  'satisfaisant': 'satisfaisant',
  'fragile-mais-en-progres': 'fragile mais en progression',
  'fragile': 'fragile',
  'preoccupant': 'préoccupant et nécessitant un travail intensif',
};

const FOLLOW_UP_LABELS: Record<string, string> = {
  'autonomie-suffisante': "Votre enfant dispose d'une autonomie suffisante pour progresser seul(e) à condition de maintenir un travail régulier.",
  'consolidation-ponctuelle': 'Une consolidation ponctuelle est recommandée pour renforcer les acquis du stage.',
  'accompagnement-regulier': 'Un accompagnement régulier est recommandé pour ancrer les méthodes travaillées et poursuivre la progression.',
  'entrainement-intensif': "Un entraînement intensif avant l'épreuve est vivement recommandé pour consolider les bases et s'exercer dans les conditions de l'examen.",
};

const AXIS_LABELS: Record<string, string> = {
  'commentaire': 'commentaire de texte',
  'dissertation': 'dissertation',
  'redaction': 'qualité de rédaction',
  'grammaire': 'correction grammaticale',
  'vocabulaire': 'enrichissement du vocabulaire',
  'lecture-analytique': 'lecture analytique',
  'references-litteraires': 'références littéraires',
  'gestion-du-temps': 'gestion du temps',
  'methode-de-revision': 'méthode de révision',
  'confiance-a-lecrit': "confiance à l'écrit",
};

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
 * Generates a structured parent report from coach EAF bilan data.
 * Pure function — deterministic, no external calls.
 */
export function generateParentEafStageReport(
  sourceData: Partial<CoachEafSourceData>,
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

  // Header
  lines.push('BILAN PÉDAGOGIQUE — STAGE DE PRINTEMPS EAF');
  lines.push("Préparation à l'épreuve anticipée de français");
  lines.push('');
  lines.push(`Élève : ${name}`);
  lines.push(`Stage : Préparation à l'épreuve anticipée de français (Première)`);
  lines.push(`Durée : 16h`);
  lines.push(`Date du bilan : ${dateStr}`);
  lines.push('');
  lines.push('─'.repeat(60));

  // Section 1 — Attitude et implication
  const ae = sourceData.attendanceAndEngagement ?? {};
  lines.push('');
  lines.push('1. ATTITUDE ET IMPLICATION');
  lines.push('');

  const attendanceParts: string[] = [];
  if (ae.attendance) {
    attendanceParts.push(`L'assiduité de ${name} a été ${ATTENDANCE_LABELS[ae.attendance] ?? ae.attendance}`);
  }
  if (ae.punctuality) {
    attendanceParts.push(`la ponctualité ${PUNCTUALITY_LABELS[ae.punctuality] ?? ae.punctuality}`);
  }
  if (attendanceParts.length > 0) {
    lines.push(attendanceParts.join(', et ') + '.');
  }

  if (ae.involvement || ae.concentration || ae.oralParticipation) {
    const involvementParts: string[] = [];
    if (ae.involvement !== undefined) {
      involvementParts.push(`son implication (${ratingToLabel(ae.involvement)})`);
    }
    if (ae.concentration !== undefined) {
      involvementParts.push(`sa concentration (${ratingToLabel(ae.concentration)})`);
    }
    if (ae.oralParticipation !== undefined) {
      involvementParts.push(`sa participation orale (${ratingToLabel(ae.oralParticipation)})`);
    }
    if (involvementParts.length > 0) {
      lines.push(`Sur le plan de l'engagement, nous avons observé ${involvementParts.join(', ')}.`);
    }
  }

  if (ae.attitudeToDifficulty) {
    lines.push(`Face aux difficultés, ${name} s'est montré(e) ${ATTITUDE_LABELS[ae.attitudeToDifficulty] ?? ae.attitudeToDifficulty}.`);
  }

  if (ae.coachComment) {
    lines.push('');
    lines.push(ae.coachComment);
  }

  // Section 2 — Compréhension des attentes de l'épreuve
  const ee = sourceData.examExpectations ?? {};
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push("2. COMPRÉHENSION DES ATTENTES DE L'ÉPREUVE");
  lines.push('');

  const eeRatings = {
    understandsWrittenExam: "compréhension générale des attentes de l'épreuve",
    distinguishesAnalysisAndSummary: 'distinction entre résumé, analyse et interprétation',
    quoteVsAnalysis: 'distinction entre citer et analyser',
    subjectRequirements: "identification des exigences d'un sujet",
    avoidsOffTopic: 'capacité à éviter le hors-sujet',
    successCriteria: "compréhension des critères de réussite d'une copie",
  } as const;

  const ratingLines: string[] = [];
  for (const [key, label] of Object.entries(eeRatings)) {
    const val = (ee as Record<string, number | undefined>)[key];
    if (val !== undefined) {
      ratingLines.push(`  • ${label} : ${ratingToLabel(val)}`);
    }
  }
  if (ratingLines.length > 0) {
    lines.push(ratingLines.join('\n'));
  }

  if (ee.coachComment) {
    lines.push('');
    lines.push(ee.coachComment);
  }

  // Section 3 — Commentaire de texte
  const com = sourceData.commentary ?? {};
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('3. COMMENTAIRE DE TEXTE');
  lines.push('');

  const comPositive: string[] = [];
  const comDifficult: string[] = [];

  if ((com.textUnderstanding ?? 0) >= 4) comPositive.push('la compréhension globale des textes');
  else if ((com.textUnderstanding ?? 0) > 0 && (com.textUnderstanding ?? 0) <= 2) comDifficult.push('la compréhension globale des textes');

  if ((com.organization ?? 0) >= 4) comPositive.push("l'organisation du commentaire");
  else if ((com.organization ?? 0) > 0 && (com.organization ?? 0) <= 2) comDifficult.push("l'organisation du commentaire");

  if ((com.noParaphrase ?? 0) >= 4) comPositive.push('la capacité à dépasser la paraphrase');
  else if ((com.noParaphrase ?? 0) > 0 && (com.noParaphrase ?? 0) <= 2) comDifficult.push('la capacité à dépasser la paraphrase');

  if ((com.interpretation ?? 0) >= 4) comPositive.push("l'interprétation des citations");
  else if ((com.interpretation ?? 0) > 0 && (com.interpretation ?? 0) <= 2) comDifficult.push("l'interprétation des citations");

  if (comPositive.length > 0) {
    lines.push(`Points forts : ${comPositive.join(', ')}.`);
  }
  if (comDifficult.length > 0) {
    lines.push(`Points à renforcer : ${comDifficult.join(', ')}.`);
  }

  if (com.strengths) {
    lines.push('');
    lines.push(`Points forts observés : ${com.strengths}`);
  }
  if (com.difficulties) {
    lines.push(`Difficultés restantes : ${com.difficulties}`);
  }
  if (com.priority) {
    lines.push(`Priorité de travail : ${com.priority}`);
  }

  // Section 4 — Dissertation
  const dis = sourceData.dissertation ?? {};
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('4. DISSERTATION');
  lines.push('');

  const disPositive: string[] = [];
  const disDifficult: string[] = [];

  if ((dis.subjectUnderstanding ?? 0) >= 4) disPositive.push('la compréhension du sujet');
  else if ((dis.subjectUnderstanding ?? 0) > 0 && (dis.subjectUnderstanding ?? 0) <= 2) disDifficult.push('la compréhension du sujet');

  if ((dis.progressivePlan ?? 0) >= 4) disPositive.push("la construction d'un plan progressif");
  else if ((dis.progressivePlan ?? 0) > 0 && (dis.progressivePlan ?? 0) <= 2) disDifficult.push("la construction d'un plan progressif");

  if ((dis.problematique ?? 0) >= 4) disPositive.push('la formulation de la problématique');
  else if ((dis.problematique ?? 0) > 0 && (dis.problematique ?? 0) <= 2) disDifficult.push('la formulation de la problématique');

  if (disPositive.length > 0) {
    lines.push(`Points forts : ${disPositive.join(', ')}.`);
  }
  if (disDifficult.length > 0) {
    lines.push(`Points à renforcer : ${disDifficult.join(', ')}.`);
  }

  if (dis.strengths) {
    lines.push('');
    lines.push(`Points forts observés : ${dis.strengths}`);
  }
  if (dis.difficulties) {
    lines.push(`Difficultés restantes : ${dis.difficulties}`);
  }
  if (dis.priority) {
    lines.push(`Priorité de travail : ${dis.priority}`);
  }

  // Section 5 — Expression écrite
  const wr = sourceData.writing ?? {};
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('5. EXPRESSION ÉCRITE');
  lines.push('');

  const writingParts: string[] = [];
  if (wr.sentenceClarity !== undefined) writingParts.push(`clarté des phrases (${ratingToLabel(wr.sentenceClarity)})`);
  if (wr.grammar !== undefined) writingParts.push(`correction grammaticale (${ratingToLabel(wr.grammar)})`);
  if (wr.spelling !== undefined) writingParts.push(`orthographe (${ratingToLabel(wr.spelling)})`);
  if (wr.literaryVocabulary !== undefined) writingParts.push(`vocabulaire d'analyse littéraire (${ratingToLabel(wr.literaryVocabulary)})`);

  if (writingParts.length > 0) {
    lines.push(`Sur le plan de l'expression écrite : ${writingParts.join(', ')}.`);
  }

  if (wr.observations) {
    lines.push('');
    lines.push(wr.observations);
  }
  if (wr.frequentErrors) {
    lines.push(`Erreurs fréquentes observées : ${wr.frequentErrors}`);
  }
  if (wr.recommendations) {
    lines.push(`Recommandations : ${wr.recommendations}`);
  }

  // Section 6 — Progrès observés
  const pr = sourceData.progress ?? {};
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('6. PROGRÈS OBSERVÉS');
  lines.push('');

  if (pr.globalProgress) {
    lines.push(`La progression de ${name} au cours du stage a été ${PROGRESS_LABELS[pr.globalProgress] ?? pr.globalProgress}.`);
  }
  if (pr.mostImprovedSkill) {
    lines.push(`La compétence la plus améliorée est : ${SKILL_LABELS[pr.mostImprovedSkill] ?? pr.mostImprovedSkill}.`);
  }
  if (pr.observedProgressComment) {
    lines.push('');
    lines.push(pr.observedProgressComment);
  }

  // Section 7 — Priorités de travail
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('7. PRIORITÉS DE TRAVAIL');
  lines.push('');

  const priorities: string[] = [];
  if (pr.prioritySkill) {
    priorities.push(SKILL_LABELS[pr.prioritySkill] ?? pr.prioritySkill);
  }

  const pra = sourceData.parentRecommendations ?? {};
  if (pra.priorityAxes && pra.priorityAxes.length > 0) {
    const axes = pra.priorityAxes.map(a => AXIS_LABELS[a] ?? a);
    lines.push(`Les axes prioritaires à travailler dans les prochaines semaines sont : ${axes.join(', ')}.`);
  } else if (priorities.length > 0) {
    lines.push(`La priorité de travail identifiée est : ${priorities.join(', ')}.`);
  }

  const am = sourceData.autonomyAndMethod ?? {};
  if (am.advice) {
    lines.push('');
    lines.push(am.advice);
  }

  // Section 8 — Recommandation finale
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('8. RECOMMANDATION FINALE');
  lines.push('');

  if (pra.estimatedCurrentLevel) {
    lines.push(`Le niveau actuel estimé de ${name} est : ${LEVEL_LABELS[pra.estimatedCurrentLevel] ?? pra.estimatedCurrentLevel}.`);
  }

  if (pra.recommendedFollowUp) {
    lines.push('');
    lines.push(FOLLOW_UP_LABELS[pra.recommendedFollowUp] ?? pra.recommendedFollowUp);
  }

  if (pra.parentSummaryMessage) {
    lines.push('');
    lines.push(pra.parentSummaryMessage);
  }

  if (pra.finalRecommendation) {
    lines.push('');
    lines.push(pra.finalRecommendation);
  }

  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push("Ce bilan a été rédigé par l'équipe pédagogique Nexus Réussite.");
  lines.push('Il est destiné aux familles et strictement confidentiel.');

  return lines.join('\n');
}
