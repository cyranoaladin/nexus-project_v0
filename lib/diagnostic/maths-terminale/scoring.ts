import {
  CHAPTERS, DOMAINS, QUESTIONS_QCM, QUESTIONS_OPEN, DISCOVERY_CLUSTERS
} from './data';
import type {
  ChapterProgress, TeacherGrade, DiagnosticResult,
  ChapterResult, PedagogicalStatus, SessionPlan, WeekPlan, Recommendation
} from './types';

export function clampScore(value: number | string, min: number, max: number): number {
  const n = parseFloat(String(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

export function aggregateTeacherErrors(
  teacherGrades: Record<string, TeacherGrade>
): [string, number][] {
  const counts: Record<string, number> = {};
  Object.values(teacherGrades || {}).forEach(g => {
    (g.errors || []).forEach(err => {
      counts[err] = (counts[err] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export function computeDiagnostics(
  progress: Record<string, ChapterProgress>,
  qcmAnswers: Record<string, number>,
  teacherGrades: Record<string, TeacherGrade>,
  isTeacherGraded: boolean
): DiagnosticResult {
  let qcmRawScore = 0;
  let openRawScore = 0;
  let qcmDontKnowCount = 0;
  let qcmUnansweredCount = 0;
  const qcmMaxScore = 48;
  const openMaxScore = 52;
  const globalMaxScore = 100;

  const chapStats: Record<string, { id: string; domainId: string; title: string; bacPriority: number; score: number; max: number; evaluated: boolean }> = {};
  CHAPTERS.forEach(c => {
    chapStats[c.id] = { id: c.id, domainId: c.domainId, title: c.title, bacPriority: c.bacPriority, score: 0, max: 0, evaluated: false };
  });

  QUESTIONS_QCM.forEach(q => {
    chapStats[q.chapterId].max += 1;
    chapStats[q.chapterId].evaluated = true;
    const ans = qcmAnswers[q.id];
    if (ans === q.correct) {
      chapStats[q.chapterId].score += 1;
      qcmRawScore += 1;
    } else if (ans === -1) {
      qcmDontKnowCount += 1;
    } else if (ans === undefined || ans === null) {
      qcmUnansweredCount += 1;
    }
  });

  qcmRawScore = clampScore(qcmRawScore, 0, qcmMaxScore);

  if (isTeacherGraded) {
    QUESTIONS_OPEN.forEach(q => {
      const gradeData = teacherGrades[q.id];
      const points = clampScore(gradeData?.score ?? 0, 0, q.maxPoints);
      openRawScore += points;
      const pointsPerChap = points / q.chapterIds.length;
      const maxPerChap = q.maxPoints / q.chapterIds.length;
      q.chapterIds.forEach(cId => {
        if (chapStats[cId]) {
          chapStats[cId].max += maxPerChap;
          chapStats[cId].score += pointsPerChap;
          chapStats[cId].evaluated = true;
        }
      });
    });
  }

  openRawScore = clampScore(openRawScore, 0, openMaxScore);

  const qcmPercentage = Math.round((qcmRawScore / qcmMaxScore) * 100);
  const openPercentage = isTeacherGraded ? Math.round((openRawScore / openMaxScore) * 100) : null;
  const globalRawScore = clampScore(qcmRawScore + openRawScore, 0, globalMaxScore);
  const globalPercentage = isTeacherGraded
    ? Math.round((globalRawScore / globalMaxScore) * 100)
    : qcmPercentage;

  const chapterResults: ChapterResult[] = CHAPTERS.map(c => {
    const stats = chapStats[c.id];
    const prog = progress[c.id];
    const isDeclared = prog !== undefined && prog.declared !== null && prog.declared !== undefined;
    const declaredVal = isDeclared ? prog.declared : null;
    const confVal = isDeclared ? prog.confidence : null;

    let percentage: number | null = null;
    if (stats.evaluated && stats.max > 0) percentage = (stats.score / stats.max) * 100;

    let pedagogicalStatus: PedagogicalStatus = 'Non renseigné';
    let declaredNotSeenButSucceeded = false;

    if (!isDeclared) {
      pedagogicalStatus = 'Non renseigné';
    } else if (declaredVal === 0) {
      if (stats.evaluated && percentage !== null && percentage >= 65) {
        pedagogicalStatus = 'Non vu déclaré, réussite observée';
        declaredNotSeenButSucceeded = true;
      } else {
        pedagogicalStatus = c.bacPriority >= 5 ? 'Découverte prioritaire' : 'Non encore vu';
      }
    } else if (!stats.evaluated) {
      pedagogicalStatus = 'Déclaré vu mais non évalué';
    } else {
      if (percentage === null) pedagogicalStatus = 'Non renseigné';
      else if (percentage < 25) pedagogicalStatus = 'Lacune critique';
      else if (percentage < 45) pedagogicalStatus = 'Très fragile';
      else if (percentage < 65) pedagogicalStatus = 'Fragile';
      else if (percentage < 80) pedagogicalStatus = 'À consolider';
      else if (percentage < 90) pedagogicalStatus = 'Maîtrisé';
      else pedagogicalStatus = 'Point fort';
    }

    const weaknessF: Record<PedagogicalStatus, number> = {
      'Non renseigné': 0, 'Non encore vu': 3, 'Découverte prioritaire': 4.5,
      'Déclaré vu mais non évalué': 2.5, 'Lacune critique': 5, 'Très fragile': 4,
      'Fragile': 3, 'À consolider': 2, 'Maîtrisé': 1, 'Point fort': 0.5,
      'Non vu déclaré, réussite observée': 1
    };

    let programF = 1;
    if (declaredVal === 0 && !declaredNotSeenButSucceeded) programF = 1.2;
    if (!stats.evaluated && declaredVal !== null && declaredVal > 0) programF = 1.1;
    if (stats.evaluated && confVal !== null && confVal >= 4 && percentage !== null && percentage < 50) programF = 1.5;
    if (declaredVal === 5) programF = 0.8;

    const wF = weaknessF[pedagogicalStatus] ?? 1;
    const priorityScore = pedagogicalStatus === 'Non renseigné' ? 0 : (c.bacPriority * wF * programF);
    const isIllusion = stats.evaluated && confVal !== null && confVal >= 4 && percentage !== null && percentage < 50;
    const lacksConfidence = stats.evaluated && confVal !== null && confVal <= 2 && percentage !== null && percentage >= 70;

    return {
      chapterId: c.id,
      domainId: c.domainId,
      title: c.title,
      domainTitle: DOMAINS.find(d => d.id === c.domainId)?.title ?? '',
      declared: declaredVal,
      confidence: confVal,
      percentage,
      isEvaluated: stats.evaluated,
      pedagogicalStatus,
      priorityScore,
      isIllusion,
      lacksConfidence,
      declaredNotSeenButSucceeded
    };
  });

  const domainStatsObj: Record<string, { raw: number; max: number }> = {};
  DOMAINS.forEach(d => { domainStatsObj[d.id] = { raw: 0, max: 0 }; });
  CHAPTERS.forEach(c => {
    const stats = chapStats[c.id];
    if (stats.evaluated) {
      domainStatsObj[c.domainId].raw += stats.score;
      domainStatsObj[c.domainId].max += stats.max;
    }
  });

  const domainScores: Record<string, number> = {};
  DOMAINS.forEach(d => {
    domainScores[d.id] = domainStatsObj[d.id].max > 0
      ? Math.round((domainStatsObj[d.id].raw / domainStatsObj[d.id].max) * 100)
      : 0;
  });

  const criticalCount = chapterResults.filter(c => c.pedagogicalStatus === 'Lacune critique').length;
  let calculatedProfile = { label: "Élève en cours d'évaluation", desc: 'Profil provisoire basé uniquement sur le QCM.' };

  if (isTeacherGraded) {
    if (globalPercentage < 35 || criticalCount >= 5) calculatedProfile = { label: 'Base très fragile', desc: "Objectif : sécuriser les automatismes essentiels et méthodes de base." };
    else if (globalPercentage < 50) calculatedProfile = { label: 'Élève fragile', desc: "Niveau irrégulier. Les méthodes ne sont pas stabilisées et doivent être structurées." };
    else if (globalPercentage < 65) calculatedProfile = { label: 'Élève moyen', desc: "Bases existantes. Nécessité de renforcer la rédaction et d'éviter les erreurs d'étourderie." };
    else if (globalPercentage >= 80) calculatedProfile = { label: 'Élève solide', desc: "Objectif performance : sujets bac complets, questions difficiles et rédaction experte." };
    else calculatedProfile = { label: 'Élève correct', desc: "Bases saines. Doit consolider pour gagner en fluidité sur les problèmes ouverts." };
  }

  return {
    chapterResults, domainScores,
    qcmRawScore, qcmMaxScore, qcmPercentage, qcmDontKnowCount, qcmUnansweredCount,
    openRawScore, openMaxScore, openPercentage,
    globalRawScore, globalMaxScore, globalPercentage,
    isProvisional: !isTeacherGraded, calculatedProfile
  };
}

export function generateAdvancedPath(chapterResults: ChapterResult[]): SessionPlan[] {
  const priorities = chapterResults.filter(c =>
    !['Point fort', 'Maîtrisé', 'Non encore vu', 'Découverte prioritaire', 'Non renseigné', 'Non vu déclaré, réussite observée'].includes(c.pedagogicalStatus)
  );
  const decouvertes = chapterResults.filter(c => c.pedagogicalStatus === 'Découverte prioritaire');
  const nonRenseignes = chapterResults.filter(c => c.pedagogicalStatus === 'Non renseigné');
  const reussitesInattendues = chapterResults.filter(c => c.declaredNotSeenButSucceeded);

  const clarificationTime = nonRenseignes.length > 0 ? 10 : 0;
  const unexpectedTime = reussitesInattendues.length > 0 ? 10 : 0;
  const remainingTime = 120 - 5 - 20 - clarificationTime - unexpectedTime;
  const qcmTime = Math.floor(remainingTime * 0.45);
  const redacTime = remainingTime - qcmTime;

  const sessions: SessionPlan[] = [{
    num: 1, duration: '2h', type: 'Méthodologie', title: 'Diagnostic & Erreurs critiques',
    objectives: ['Restitution du bilan', "Création du carnet d'erreurs", 'Correction des questions bloquantes'],
    skills: ["Analyse de l'énoncé", 'Autocorrection'],
    activities: [
      '5 min : Accueil et lecture du bilan',
      ...(clarificationTime > 0 ? ["10 min : Clarification de l'avancement sur les chapitres non renseignés"] : []),
      ...(unexpectedTime > 0 ? ["10 min : Vérification à l'oral des réussites inattendues"] : []),
      `${qcmTime} min : Reprise à chaud des QCM échoués`,
      `${redacTime} min : Méthodologie de rédaction (Exercice type)`,
      '20 min : Planification et stratégie'
    ],
    homework: "Refaire un exercice type bac échoué en diagnostic",
    criteria: "L'élève comprend son profil et ses objectifs de progression.",
    writtenTrace: "Création du carnet d'erreur et méthode d'autocorrection.",
    oralCheck: "L'élève verbalise son objectif principal pour le stage.",
    chapters: [], teacherNotes: "Le temps est ajusté mathématiquement pour durer exactement 120 minutes."
  }];

  const usedIds = new Set<string>();
  let sNum = 2;

  DISCOVERY_CLUSTERS.forEach(cluster => {
    const clusterChaps = decouvertes.filter(c => cluster.ids.includes(c.chapterId) && !usedIds.has(c.chapterId));
    if (clusterChaps.length > 0 && sNum <= 7) {
      sessions.push({
        num: sNum++, duration: '2h', type: 'Découverte structurée', title: cluster.title,
        objectives: ['Acquisition des notions clés du cluster', 'Modélisation et approche conceptuelle'],
        skills: ['Modélisation', 'Raisonnement'],
        activities: ["30 min : Cours interactif", "45 min : Exercices d'application directe", '45 min : Problème guidé'],
        homework: `Créer une fiche de synthèse sur : ${cluster.title}`,
        criteria: 'Compréhension du concept fondamental et réussite des applications directes.',
        writtenTrace: 'Formules clés à retenir par coeur.',
        oralCheck: "L'élève explique pourquoi la formule s'applique sur un exemple simple.",
        chapters: clusterChaps.map(c => c.title), teacherNotes: "Garder un rythme fluide, première approche de ces notions."
      });
      clusterChaps.forEach(c => usedIds.add(c.chapterId));
    }
  });

  DISCOVERY_CLUSTERS.forEach(cluster => {
    const clusterChaps = priorities.filter(c => cluster.ids.includes(c.chapterId) && !usedIds.has(c.chapterId));
    const hasCritical = clusterChaps.some(c => ['Lacune critique', 'Très fragile'].includes(c.pedagogicalStatus));
    if (hasCritical && sNum <= 7) {
      sessions.push({
        num: sNum++, duration: '2h', type: 'Consolidation intensive', title: cluster.title,
        objectives: ['Sécuriser les méthodes essentielles', 'Débloquer les automatismes transversaux'],
        skills: ['Calcul', 'Méthode'],
        activities: ['15 min : Flash automatismes', '30 min : Reprise de méthode', '45 min : Exercice guidé pas-à-pas', '30 min : Exercice type Bac'],
        homework: `Exercice d'application type Bac sur ${cluster.title}`,
        criteria: 'Fluidité retrouvée sur les calculs et enclenchement sans blocage.',
        writtenTrace: 'Méthode pas-à-pas rédigée dans le cahier.',
        oralCheck: "L'élève reformule la méthode de résolution en 2 minutes.",
        chapters: clusterChaps.map(c => c.title), teacherNotes: ""
      });
      clusterChaps.forEach(c => usedIds.add(c.chapterId));
    }
  });

  while (sNum <= 7) {
    const remaining = priorities.filter(c => !usedIds.has(c.chapterId)).sort((a, b) => b.priorityScore - a.priorityScore);
    if (remaining.length > 0) {
      sessions.push({
        num: sNum++, duration: '2h', type: 'Renforcement', title: remaining[0].domainTitle,
        objectives: ['Exercices de synthèse type Bac'],
        skills: ['Rédaction', 'Raisonnement'],
        activities: ['20 min : Questions flash', '60 min : Problème ouvert multi-chapitres', '40 min : Rédaction experte'],
        homework: "Revoir les erreurs de rédaction de la séance",
        criteria: 'Autonomie sur problème ouvert.',
        writtenTrace: 'Exemples de rédaction parfaite recopiés.',
        oralCheck: "L'élève verbalise le plan de résolution avant de l'écrire.",
        chapters: [remaining[0].title], teacherNotes: "Insister sur la rigueur de la copie."
      });
      usedIds.add(remaining[0].chapterId);
    } else {
      sessions.push({
        num: sNum++, duration: '2h', type: 'Entraînement', title: 'Exercices transversaux',
        objectives: ['Mélange de domaines'], skills: ['Adaptabilité'],
        activities: ['120 min : Traitement de sujets'], homework: '', criteria: 'Autonomie générale',
        writtenTrace: 'Correction des sujets', oralCheck: "Analyse d'erreur à l'oral", chapters: [], teacherNotes: ""
      });
    }
  }

  sessions.push({
    num: 8, duration: '2h', type: 'Entraînement Bac', title: 'Bac Blanc Ciblé & Stratégie',
    objectives: ['Mini-sujet transversal', 'Gestion du temps', 'Plan de révision post-stage'],
    skills: ['Gestion du stress', 'Organisation'],
    activities: ['10 min : Consignes et stratégie', "90 min : Épreuve blanche chronométrée", "20 min : Correction flash & Stratégie Juin"],
    homework: 'Suivre plan de révision Post-Stage',
    criteria: 'Gestion du temps maîtrisée et copie propre.',
    writtenTrace: 'Plan de révision des 4 semaines noté.',
    oralCheck: "L'élève exprime son ressenti sur sa progression.",
    chapters: ['Toutes notions'], teacherNotes: "Simuler les conditions d'examen réelles."
  });

  return sessions;
}

export function generatePostStagePlan(
  evaluatedData: DiagnosticResult,
  teacherGrades: Record<string, TeacherGrade>
): WeekPlan[] {
  const { chapterResults, domainScores } = evaluatedData;
  const topErrors = aggregateTeacherErrors(teacherGrades || {}).slice(0, 2);
  const urgencies = chapterResults
    .filter(c => c.pedagogicalStatus === 'Lacune critique' || c.pedagogicalStatus === 'Très fragile')
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3);

  let weakestDomainId = DOMAINS[0].id;
  let minScore = 100;
  DOMAINS.forEach(d => {
    if (domainScores[d.id] !== undefined && domainScores[d.id] < minScore) {
      minScore = domainScores[d.id];
      weakestDomainId = d.id;
    }
  });
  const weakestDomainTitle = DOMAINS.find(d => d.id === weakestDomainId)?.title ?? 'Analyse';

  return [
    {
      week: "Semaine 1",
      title: "Consolidation des Urgences Personnalisées",
      desc: urgencies.length > 0
        ? `Reprendre impérativement : ${urgencies.map(u => u.title).join(', ')}.`
        : "Retravailler les exercices ouverts les moins bien réussis en se concentrant sur la méthode.",
      deliverable: "Fiche méthode + correction propre"
    },
    {
      week: "Semaine 2",
      title: `Focus Domaine Faible : ${weakestDomainTitle}`,
      desc: `Faire 2 annales de Bac thématisées spécifiquement sur : ${weakestDomainTitle}. ${topErrors.length > 0 ? `Attention particulièrement à : ${topErrors.map(e => e[0]).join(', ')}.` : ''}`,
      deliverable: "Copies corrigées et annotées"
    },
    {
      week: "Semaine 3",
      title: "Entraînement Conditions Réelles",
      desc: "Faire 1 sujet de Bac complet en temps limité strict (4h). Ne regarder la correction qu'à la fin.",
      deliverable: "Bilan des erreurs d'étourderie"
    },
    {
      week: "Dernière semaine",
      title: "Révisions Légères & Sécurisation",
      desc: "Relire le carnet d'erreurs constitué. Revoir par cœur les formules essentielles et automatismes.",
      deliverable: "Dernière liste de questions au prof"
    }
  ];
}

export function generateRecommendations(
  chapterResults: ChapterResult[],
  teacherGrades: Record<string, TeacherGrade>
): Recommendation[] {
  const recs: Recommendation[] = [];
  const topErrors = aggregateTeacherErrors(teacherGrades).slice(0, 3);

  if (topErrors.length > 0) {
    if (topErrors[0][0] === "Absence de justification" && topErrors[0][1] >= 3) {
      recs.push({ type: 'alerte', title: 'Problème de Rédaction', text: `L'élève peine à justifier (${topErrors[0][1]} occ.). Prévoir un travail spécifique sur la rédaction.` });
    } else if (topErrors[0][0] === "Blocage au démarrage" && topErrors[0][1] >= 2) {
      recs.push({ type: 'alerte', title: "Manque d'Autonomie", text: `L'élève bloque face à la feuille blanche (${topErrors[0][1]} occ.). Installer une méthode de brouillon exploratoire.` });
    } else {
      recs.push({ type: 'info', title: 'Erreurs fréquentes', text: `Erreurs dominantes : ${topErrors.map(e => e[0]).join(', ')}.` });
    }
  }

  const illusions = chapterResults.filter(c => c.isIllusion);
  if (illusions.length > 0) {
    recs.push({ type: 'alerte', title: 'Illusion de maîtrise', text: `Surestime fortement son niveau sur : ${illusions.map(c => c.title).join(', ')}.` });
  }

  const manquesConfiance = chapterResults.filter(c => c.lacksConfidence);
  if (manquesConfiance.length > 0) {
    recs.push({ type: 'succes', title: 'Potentiel sous-exploité', text: `L'élève réussit mieux qu'il ne le croit sur : ${manquesConfiance.map(c => c.title).join(', ')}.` });
  }

  const nonRenseignes = chapterResults.filter(c => c.pedagogicalStatus === 'Non renseigné');
  if (nonRenseignes.length > 0) {
    recs.push({ type: 'info', title: 'Alerte Déclaratif', text: `${nonRenseignes.length} chapitres n'ont pas de statut renseigné. Clarifier absolument en séance 1.` });
  }

  const reussitesInattendues = chapterResults.filter(c => c.declaredNotSeenButSucceeded);
  if (reussitesInattendues.length > 0) {
    recs.push({ type: 'info', title: 'Acquisition hors-cadre', text: `L'élève déclare ne pas avoir vu : ${reussitesInattendues.map(c => c.title).join(', ')} mais réussit les items associés.` });
  }

  return recs;
}
