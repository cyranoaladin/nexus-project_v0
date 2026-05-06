import type { CoachEafSourceData } from './types';

type StudentInfo = {
  firstName?: string;
  lastName?: string;
  gradeLevel?: string;
};

// ─── Label maps ───────────────────────────────────────────────────────────────

const ATTENDANCE_PHRASES: Record<string, string> = {
  'excellente':   'une assiduité exemplaire, témoignant d\'un investissement personnel soutenu et constant',
  'reguliere':    'une assiduité régulière, reflétant un engagement sérieux sur la durée du stage',
  'irreguliere':  'une assiduité irrégulière qui a parfois nui à la continuité des apprentissages',
  'insuffisante': 'une assiduité insuffisante, ce qui a limité les bénéfices du stage',
};

const PUNCTUALITY_PHRASES: Record<string, string> = {
  'tres-satisfaisante': 'une ponctualité irréprochable, signe d\'un sens aigu de l\'organisation',
  'satisfaisante':      'une ponctualité satisfaisante, sans perturbation notable des séances',
  'a-ameliorer':        'une ponctualité à améliorer, qui a parfois empiété sur le temps de travail collectif',
};

const ATTITUDE_PHRASES: Record<string, string> = {
  'perseverant':              'une belle persévérance face aux difficultés — une qualité essentielle en français',
  'volontaire-mais-hesitant': 'une volonté sincère, même si des hésitations subsistent face à l\'exercice',
  'manque-de-confiance':      'un manque de confiance en ses capacités, sur lequel il conviendra de travailler',
  'se-decourage-rapidement':  'une tendance au découragement qui peut être surmontée avec un accompagnement adapté',
  'besoin-detre-guide':       'un besoin d\'être davantage guidé(e) — attitude normale à ce stade, qui peut évoluer favorablement',
};

const INVOLVEMENT_RICH: string[] = [
  '',
  'insuffisante — un engagement plus actif est attendu pour progresser',
  'fragile — des efforts sont encore nécessaires pour s\'impliquer pleinement',
  'en progression — une dynamique encourageante qui mérite d\'être poursuivie',
  'sérieuse et constante — un investissement à consolider pour l\'examen',
  'remarquable — un engagement exemplaire, moteur de progrès significatifs',
];

const CONCENTRATION_RICH: string[] = [
  '',
  'insuffisante — la distraction a nui à la qualité du travail',
  'fragile — des efforts de focalisation sont encore nécessaires',
  'en progression — une amélioration notable, à maintenir en conditions d\'examen',
  'satisfaisante — une bonne capacité à maintenir l\'attention sur les exercices',
  'excellente — une concentration soutenue tout au long des séances',
];

const ORAL_RICH: string[] = [
  '',
  'insuffisante — une participation orale plus active est attendue',
  'timide mais présente — une prise de parole à encourager davantage',
  'en progression — une participation de plus en plus affirmée et pertinente',
  'active et constructive — une contribution appréciée lors des échanges',
  'remarquable — des interventions pertinentes qui enrichissent le groupe',
];

const GENERIC_RICH: string[] = [
  '', 'insuffisant', 'fragile', 'en progression', 'satisfaisant', 'maîtrisé',
];

const PROGRESS_PHRASES: Record<string, string> = {
  'tres-nette':   'très nette, avec des sauts qualitatifs visibles d\'une séance à l\'autre',
  'nette':        'nette, avec des améliorations concrètes sur les compétences travaillées',
  'moderee':      'modérée — des bases ont été posées, mais le chemin reste à consolider',
  'legere':       'légère — des prémices positives, qui nécessitent un travail régulier à domicile',
  'insuffisante': 'insuffisante sur la durée du stage — un accompagnement renforcé est recommandé',
};

const SKILL_LABELS: Record<string, string> = {
  'comprehension-des-textes': 'la compréhension des textes littéraires',
  'analyse-des-citations':    "l'analyse et l'interprétation des citations",
  'construction-du-plan':     'la construction du plan',
  'redaction':                'la qualité de rédaction',
  'dissertation':             'la méthode de la dissertation',
  'commentaire':              'la méthode du commentaire',
  'gestion-du-temps':         "la gestion du temps en conditions d'examen",
  'confiance':                "la confiance à l'écrit",
  'methode':                  'la méthode de travail générale',
};

const LEVEL_PHRASES: Record<string, string> = {
  'tres-solide':            'très solide — votre enfant aborde l\'épreuve avec des bases sécurisées',
  'satisfaisant':           'satisfaisant — les fondamentaux sont en place, quelques points restent à renforcer',
  'fragile-mais-en-progres': 'fragile mais en progression — les efforts du stage portent leurs fruits',
  'fragile':                'fragile — une préparation ciblée et intensive reste nécessaire avant l\'épreuve',
  'preoccupant':            'préoccupant et nécessitant un travail intensif et structuré',
};

const FOLLOW_UP_FULL: Record<string, string> = {
  'autonomie-suffisante':
    "Votre enfant dispose d'une autonomie suffisante pour progresser par lui-même, à condition de maintenir un travail régulier et de continuer à s'entraîner sur des annales.",
  'consolidation-ponctuelle':
    "Une consolidation ponctuelle est recommandée pour ancrer les acquis du stage et combler les quelques lacunes identifiées. Quelques séances ciblées suffiront à sécuriser les bases.",
  'accompagnement-regulier':
    "Un accompagnement régulier est vivement recommandé pour ancrer les méthodes travaillées, maintenir la dynamique de progression et préparer efficacement les épreuves.",
  'entrainement-intensif':
    "Un entraînement intensif avant l'épreuve est indispensable pour consolider les bases, automatiser les méthodes et s'exercer dans les conditions réelles de l'examen. Chaque semaine compte.",
};

const AXIS_LABELS: Record<string, string> = {
  'commentaire':         'le commentaire de texte',
  'dissertation':        'la dissertation',
  'redaction':           'la qualité de rédaction',
  'grammaire':           'la correction grammaticale',
  'vocabulaire':         "l'enrichissement du vocabulaire",
  'lecture-analytique':  'la lecture analytique',
  'references-litteraires': 'les références littéraires',
  'gestion-du-temps':    'la gestion du temps',
  'methode-de-revision': 'la méthode de révision',
  'confiance-a-lecrit':  "la confiance à l'écrit",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function richRating(rating: number | undefined, labels: string[]): string {
  if (!rating || rating < 1 || rating > 5) return 'non évalué';
  return labels[rating] ?? 'non évalué';
}

function studentFirstName(s: StudentInfo): string {
  return s.firstName ?? 'votre enfant';
}

function studentFullName(s: StudentInfo): string {
  const parts = [s.firstName, s.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Votre enfant';
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generates a rich, Markdown-formatted parent report from coach EAF bilan data.
 * Pure function — deterministic, no external calls.
 */
export function generateParentEafStageReport(
  sourceData: Partial<CoachEafSourceData>,
  student: StudentInfo,
  reportDate?: Date,
): string {
  const name      = studentFullName(student);
  const firstName = studentFirstName(student);
  const date      = reportDate ?? new Date();
  const dateStr   = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const lines: string[] = [];

  // ── Document header ────────────────────────────────────────────────────────
  lines.push(`**BILAN PÉDAGOGIQUE — STAGE DE PRINTEMPS EAF**`);
  lines.push(`*Préparation à l'épreuve anticipée de français — Première*`);
  lines.push('');
  lines.push(`**Élève :** ${name}`);
  lines.push(`**Stage :** Préparation à l'épreuve anticipée de français (Première)`);
  lines.push(`**Durée :** 16 heures`);
  lines.push(`**Date du bilan :** ${dateStr}`);
  lines.push('');

  // ── Section 1 — Attitude et implication ────────────────────────────────────
  const ae = sourceData.attendanceAndEngagement ?? {};
  lines.push('## 1. Attitude et implication');
  lines.push('');

  const attendanceParts: string[] = [];
  if (ae.attendance) attendanceParts.push(ATTENDANCE_PHRASES[ae.attendance] ?? ae.attendance);
  if (ae.punctuality) attendanceParts.push(PUNCTUALITY_PHRASES[ae.punctuality] ?? ae.punctuality);

  if (attendanceParts.length > 0) {
    lines.push(
      `Tout au long de ce stage intensif, **${name}** a fait preuve de ${attendanceParts.join(', et ').replace(/^une /, '')}. `
      + `Ces premiers éléments témoignent d'une posture scolaire sur laquelle il est possible de s'appuyer pour progresser.`
    );
    lines.push('');
  }

  const engagementItems: string[] = [];
  if (ae.involvement    !== undefined) engagementItems.push(`**Implication générale** : ${richRating(ae.involvement, INVOLVEMENT_RICH)}`);
  if (ae.concentration  !== undefined) engagementItems.push(`**Concentration** : ${richRating(ae.concentration, CONCENTRATION_RICH)}`);
  if (ae.oralParticipation !== undefined) engagementItems.push(`**Participation orale** : ${richRating(ae.oralParticipation, ORAL_RICH)}`);

  if (engagementItems.length > 0) {
    lines.push('### Engagement observé au fil des séances');
    lines.push('');
    for (const item of engagementItems) lines.push(`- ${item}`);
    lines.push('');
  }

  if (ae.attitudeToDifficulty) {
    const phrase = ATTITUDE_PHRASES[ae.attitudeToDifficulty] ?? ae.attitudeToDifficulty;
    lines.push(
      `Face aux obstacles rencontrés au cours des séances, **${firstName}** a fait preuve de ${phrase}. `
      + `Identifier cette posture est essentiel pour adapter le travail personnel à venir.`
    );
    lines.push('');
  }

  // ae.coachComment is internal coach note — never exposed to parents in deterministic template

  // ── Section 2 — Compréhension des attentes de l'épreuve ───────────────────
  const ee = sourceData.examExpectations ?? {};
  lines.push('---');
  lines.push('');
  lines.push("## 2. Compréhension des attentes de l'épreuve");
  lines.push('');
  lines.push(
    `La maîtrise des exigences de l'épreuve anticipée de français conditionne largement la qualité des copies. `
    + `Voici les différentes dimensions évaluées au cours du stage :`
  );
  lines.push('');

  const eeMap: Array<[keyof typeof ee, string]> = [
    ['understandsWrittenExam',       "Compréhension générale des attentes de l'épreuve"],
    ['distinguishesAnalysisAndSummary', 'Distinction entre résumé, analyse et interprétation'],
    ['quoteVsAnalysis',              'Distinction entre citer et analyser'],
    ['subjectRequirements',          "Identification des exigences d'un sujet"],
    ['avoidsOffTopic',               'Capacité à éviter le hors-sujet'],
    ['successCriteria',              "Compréhension des critères de réussite d'une copie"],
  ];

  const strongEE: string[] = [];
  const weakEE:   string[] = [];
  for (const [key, label] of eeMap) {
    const val = (ee as Record<string, number | undefined>)[key as string];
    if (val === undefined) continue;
    if (val >= 4) strongEE.push(label);
    else if (val <= 2) weakEE.push(label);
    else lines.push(`- **${label}** : ${richRating(val, GENERIC_RICH)}`);
  }

  if (strongEE.length > 0) {
    lines.push('');
    lines.push(`**Points bien maîtrisés :** ${strongEE.join(', ')}.`);
  }
  if (weakEE.length > 0) {
    lines.push(`**Points à renforcer en priorité :** ${weakEE.join(', ')}.`);
  }
  lines.push('');

  // ee.coachComment is internal coach note — never exposed to parents

  // ── Section 3 — Commentaire de texte ──────────────────────────────────────
  const com = sourceData.commentary ?? {};
  lines.push('---');
  lines.push('');
  lines.push('## 3. Commentaire de texte');
  lines.push('');
  lines.push(
    `L'exercice du commentaire littéraire exige de comprendre un texte, d'identifier les procédés d'écriture `
    + `et d'en interpréter le sens avec précision. Voici ce qui a été observé :`
  );
  lines.push('');

  const comPositive: string[] = [];
  const comDifficult: string[] = [];
  if ((com.textUnderstanding ?? 0) >= 4) comPositive.push('la compréhension globale des textes');
  else if ((com.textUnderstanding ?? 0) > 0 && (com.textUnderstanding ?? 0) <= 2) comDifficult.push('la compréhension globale des textes');
  if ((com.organization ?? 0) >= 4) comPositive.push("l'organisation et la structure du commentaire");
  else if ((com.organization ?? 0) > 0 && (com.organization ?? 0) <= 2) comDifficult.push("l'organisation du commentaire");
  if ((com.noParaphrase ?? 0) >= 4) comPositive.push('la capacité à dépasser la paraphrase');
  else if ((com.noParaphrase ?? 0) > 0 && (com.noParaphrase ?? 0) <= 2) comDifficult.push('la capacité à dépasser la simple paraphrase');
  if ((com.interpretation ?? 0) >= 4) comPositive.push("l'interprétation et la mise en sens des citations");
  else if ((com.interpretation ?? 0) > 0 && (com.interpretation ?? 0) <= 2) comDifficult.push("l'interprétation des citations");

  if (comPositive.length > 0)  lines.push(`**Points forts :** ${comPositive.join(', ')}.`);
  if (comDifficult.length > 0) lines.push(`**Points à renforcer :** ${comDifficult.join(', ')}.`);

  // com.strengths/difficulties/priority are internal coach notes — not exposed in deterministic output
  lines.push('');

  // ── Section 4 — Dissertation ───────────────────────────────────────────────
  const dis = sourceData.dissertation ?? {};
  lines.push('---');
  lines.push('');
  lines.push('## 4. Dissertation');
  lines.push('');
  lines.push(
    `La dissertation est l'exercice central de l'EAF : elle mobilise la connaissance des œuvres, `
    + `la capacité à problématiser et l'art de construire une argumentation progressive. `
    + `Voici le bilan des compétences travaillées :`
  );
  lines.push('');

  const disPositive: string[] = [];
  const disDifficult: string[] = [];
  if ((dis.subjectUnderstanding ?? 0) >= 4) disPositive.push('la compréhension et l\'analyse du sujet');
  else if ((dis.subjectUnderstanding ?? 0) > 0 && (dis.subjectUnderstanding ?? 0) <= 2) disDifficult.push('la compréhension du sujet');
  if ((dis.progressivePlan ?? 0) >= 4) disPositive.push("la construction d'un plan progressif et cohérent");
  else if ((dis.progressivePlan ?? 0) > 0 && (dis.progressivePlan ?? 0) <= 2) disDifficult.push("la construction d'un plan progressif");
  if ((dis.problematique ?? 0) >= 4) disPositive.push('la formulation d\'une problématique pertinente');
  else if ((dis.problematique ?? 0) > 0 && (dis.problematique ?? 0) <= 2) disDifficult.push("la formulation de la problématique");

  if (disPositive.length > 0)  lines.push(`**Points forts :** ${disPositive.join(', ')}.`);
  if (disDifficult.length > 0) lines.push(`**Points à renforcer :** ${disDifficult.join(', ')}.`);

  // dis.strengths/difficulties/priority are internal coach notes — not exposed in deterministic output
  lines.push('');

  // ── Section 5 — Expression écrite ─────────────────────────────────────────
  const wr = sourceData.writing ?? {};
  lines.push('---');
  lines.push('');
  lines.push('## 5. Expression écrite');
  lines.push('');
  lines.push(
    `La qualité de l'expression écrite est déterminante pour convaincre les correcteurs. `
    + `Un style clair, une orthographe soignée et un vocabulaire précis valorisent considérablement une copie. `
    + `Voici le bilan des compétences rédactionnelles de **${firstName}** :`
  );
  lines.push('');

  const writingItems: string[] = [];
  if (wr.sentenceClarity    !== undefined) writingItems.push(`**Clarté des phrases** : ${richRating(wr.sentenceClarity, GENERIC_RICH)}`);
  if (wr.grammar            !== undefined) writingItems.push(`**Correction grammaticale** : ${richRating(wr.grammar, GENERIC_RICH)}`);
  if (wr.spelling           !== undefined) writingItems.push(`**Orthographe** : ${richRating(wr.spelling, GENERIC_RICH)}`);
  if (wr.literaryVocabulary !== undefined) writingItems.push(`**Vocabulaire d'analyse littéraire** : ${richRating(wr.literaryVocabulary, GENERIC_RICH)}`);

  for (const item of writingItems) lines.push(`- ${item}`);

  // wr.observations/frequentErrors/recommendations are internal coach notes — not exposed
  lines.push('');

  // ── Section 6 — Progrès observés ──────────────────────────────────────────
  const pr = sourceData.progress ?? {};
  lines.push('---');
  lines.push('');
  lines.push('## 6. Progrès observés');
  lines.push('');

  if (pr.globalProgress) {
    const progressPhrase = PROGRESS_PHRASES[pr.globalProgress] ?? pr.globalProgress;
    lines.push(
      `La progression de **${name}** au cours de ce stage a été **${progressPhrase}**. `
      + `Ce bilan chiffré doit être lu comme un point de départ, non comme un verdict : `
      + `la trajectoire compte davantage que le niveau de départ.`
    );
    lines.push('');
  }

  if (pr.mostImprovedSkill) {
    const skill = SKILL_LABELS[pr.mostImprovedSkill] ?? pr.mostImprovedSkill;
    lines.push(`La compétence ayant connu la progression la plus marquée est **${skill}**, ce qui constitue un signal encourageant pour la suite de la préparation.`);
    lines.push('');
  }

  // pr.observedProgressComment is internal coach note — not exposed

  // ── Section 7 — Priorités de travail ──────────────────────────────────────
  const am  = sourceData.autonomyAndMethod ?? {};
  const pra = sourceData.parentRecommendations ?? {};
  lines.push('---');
  lines.push('');
  lines.push('## 7. Priorités de travail');
  lines.push('');
  lines.push(
    `Pour maximiser les progrès de **${firstName}** avant l'épreuve, `
    + `voici les axes prioritaires à travailler dans les semaines à venir :`
  );
  lines.push('');

  const axes: string[] = [];
  if (pr.prioritySkill) axes.push(SKILL_LABELS[pr.prioritySkill] ?? pr.prioritySkill);
  if (pra.priorityAxes && pra.priorityAxes.length > 0) {
    for (const a of pra.priorityAxes) axes.push(AXIS_LABELS[a] ?? a);
  }

  const uniqueAxes = [...new Set(axes)];
  for (const ax of uniqueAxes) lines.push(`- **${ax.charAt(0).toUpperCase() + ax.slice(1)}**`);

  // am.advice is internal coach note — not exposed
  lines.push('');

  // ── Section 8 — Recommandation finale ─────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push('## 8. Recommandation finale');
  lines.push('');

  if (pra.estimatedCurrentLevel) {
    const levelPhrase = LEVEL_PHRASES[pra.estimatedCurrentLevel] ?? pra.estimatedCurrentLevel;
    lines.push(
      `À l'issue du stage, le niveau estimé de **${name}** est **${levelPhrase}**. `
      + `Cette évaluation repose sur les performances observées en séance et les compétences mobilisées lors des exercices.`
    );
    lines.push('');
  }

  if (pra.recommendedFollowUp) {
    const followUp = FOLLOW_UP_FULL[pra.recommendedFollowUp] ?? pra.recommendedFollowUp;
    lines.push(followUp);
    lines.push('');
  }

  if (pra.parentSummaryMessage) {
    lines.push(pra.parentSummaryMessage.replace(/%{3,}/g, '').trim());
    lines.push('');
  }

  if (pra.finalRecommendation) {
    lines.push(pra.finalRecommendation.replace(/%{3,}/g, '').trim());
    lines.push('');
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push("*Ce bilan a été rédigé par l'équipe pédagogique Nexus Réussite.*");
  lines.push('*Il est destiné aux familles et strictement confidentiel.*');

  return lines.join('\n');
}
