import type { CoachMathsSourceData } from './types';

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

const LEVEL_LABELS: Record<string, string> = {
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

function ratingToLabel(rating?: number): string {
  if (!rating) return 'non évalué';
  const labels = ['', 'insuffisant', 'fragile', 'en progression', 'satisfaisant', 'maîtrisé'];
  return labels[rating] ?? 'non évalué';
}

function studentName(student: StudentInfo): string {
  const parts = [student.firstName, student.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Votre enfant';
}

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

  // Header
  lines.push('BILAN PÉDAGOGIQUE — STAGE DE PRINTEMPS MATHÉMATIQUES');
  lines.push('Spécialité Mathématiques (Première EDS)');
  lines.push('');
  lines.push(`Élève : ${name}`);
  lines.push(`Stage : Mathématiques Première (Printemps 2026)`);
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

  if (ae.involvement || ae.concentration) {
    const involvementParts: string[] = [];
    if (ae.involvement !== undefined) {
      involvementParts.push(`son implication (${ratingToLabel(ae.involvement)})`);
    }
    if (ae.concentration !== undefined) {
      involvementParts.push(`sa concentration (${ratingToLabel(ae.concentration)})`);
    }
    if (involvementParts.length > 0) {
      lines.push(`Sur le plan de l'engagement, nous avons observé : ${involvementParts.join(', ')}.`);
    }
  }

  if (ae.coachComment) {
    lines.push('');
    lines.push(ae.coachComment);
  }

  // Section 2 — Automatismes et calculs
  const auto = sourceData.automatismes ?? {};
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('2. AUTOMATISMES ET CALCULS');
  lines.push('');

  const autoRatings = {
    calculationFluency: 'fluidité des calculs algébriques',
    identities: 'identités remarquables et factorisation',
    linearEquation: 'résolution d\'équations du premier degré',
    sign: 'étude de signe d\'expressions simples',
    derivatives: 'calcul des dérivées usuelles',
    exponentialRules: 'propriétés de l\'exponentielle',
  } as const;

  const autoLines: string[] = [];
  for (const [key, label] of Object.entries(autoRatings)) {
    const val = (auto as Record<string, number | undefined>)[key];
    if (val !== undefined) {
      autoLines.push(`  • ${label} : ${ratingToLabel(val)}`);
    }
  }
  if (autoLines.length > 0) {
    lines.push(autoLines.join('\n'));
  }

  if (auto.strongestAutomation) {
    lines.push(`Point fort sur les automatismes : ${auto.strongestAutomation}`);
  }
  if (auto.weakestAutomation) {
    lines.push(`Point à travailler sur les automatismes : ${auto.weakestAutomation}`);
  }

  // Section 3 — Analyse, Suites et Géométrie
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('3. ANALYSE, SUITES ET GÉOMÉTRIE');
  lines.push('');

  const analysis = sourceData.analysis ?? {};
  const sequences = sourceData.sequences ?? {};
  const scalarProduct = sourceData.scalarProduct ?? {};

  const mathRatings = {
    productDerivative: 'dérivation de fonctions (produits/quotients)',
    variationTable: 'étude de variations',
    arithmeticSequence: 'suites arithmétiques et géométriques',
    auxiliarySequence: 'suites auxiliaires et limites',
    coordinates: 'produit scalaire par coordonnées',
    alKashi: 'formule d\'Al-Kashi et géométrie',
  } as const;

  const mathLines: string[] = [];
  for (const [key, label] of Object.entries(mathRatings)) {
    let val: number | undefined;
    if (key in analysis) val = (analysis as Record<string, number | undefined>)[key];
    else if (key in sequences) val = (sequences as Record<string, number | undefined>)[key];
    else if (key in scalarProduct) val = (scalarProduct as Record<string, number | undefined>)[key];

    if (val !== undefined) {
      mathLines.push(`  • ${label} : ${ratingToLabel(val)}`);
    }
  }
  if (mathLines.length > 0) {
    lines.push(mathLines.join('\n'));
  }

  // Section 4 — Recommandation finale
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push('4. RECOMMANDATION FINALE');
  lines.push('');

  const pra = sourceData.parentRecommendations ?? {};
  if (pra.estimatedCurrentLevel) {
    lines.push(`Le niveau actuel estimé de ${name} est : ${LEVEL_LABELS[pra.estimatedCurrentLevel] ?? pra.estimatedCurrentLevel}.`);
  }

  if (pra.recommendedFollowUp) {
    lines.push('');
    lines.push(FOLLOW_UP_LABELS[pra.recommendedFollowUp] ?? pra.recommendedFollowUp);
  }

  if (pra.priorityAxes && pra.priorityAxes.length > 0) {
    const axes = pra.priorityAxes.map((a: string) => AXIS_LABELS[a] ?? a);
    lines.push(`Les axes prioritaires de travail identifiés sont : ${axes.join(', ')}.`);
  }

  if (pra.parentSummaryMessage) {
    lines.push('');
    lines.push(pra.parentSummaryMessage);
  }

  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push("Ce bilan a été rédigé par l'équipe pédagogique Nexus Réussite.");
  lines.push('Il est destiné aux familles et strictement confidentiel.');

  return lines.join('\n');
}
