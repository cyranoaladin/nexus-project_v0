/**
 * Bilan Renderer — Converts structured scoring data into audience-specific Markdown.
 *
 * Pipeline: ScoringV2Result + DiagnosticData → structured sections → Markdown per audience.
 * The LLM enriches the content, but the renderer guarantees invariant structure.
 *
 * Audiences:
 *   - élève: bienveillant, tutoiement, actionnable, ~400 mots
 *   - parents: professionnel, vouvoiement, rassurant, ~500 mots
 *   - nexus: technique, factuel, tableaux, ~600 mots
 */

import type { ScoringV2Result } from './types';

/** Minimal diagnostic identity for rendering */
export interface RenderContext {
  firstName: string;
  lastName: string;
  /** Discipline: maths | nsi (defaults to maths for backward compat) */
  discipline?: 'maths' | 'nsi';
  /** Level: premiere | terminale */
  level?: 'premiere' | 'terminale';
  establishment?: string;
  mathAverage?: string;
  classRanking?: string;
  learningStyle?: string;
  problemReflex?: string;
  maxConcentration?: string;
  weeklyWork?: string;
  targetMention?: string;
  postBac?: string;
  miniTestScore: number;
  miniTestTime: number;
  miniTestCompleted: boolean;
  mainRisk?: string;
  verbatims: Record<string, string>;
  /** Core prerequisite skills with low mastery (for 'Bases à consolider' block) */
  weakPrerequisites?: Array<{ skillLabel: string; domain: string; mastery: number }>;
}

/** LLM-enriched sections (optional — renderer works without them) */
export interface LLMEnrichment {
  eleveIntro?: string;
  parentsIntro?: string;
  nexusNotes?: string;
  customAdvice?: string[];
  resourceSuggestions?: string[];
}

/**
 * Qualitative label for a score (avoids exposing raw numbers to parents).
 */
function qualitativeLabel(score: number): string {
  if (score >= 80) return 'très bon';
  if (score >= 65) return 'bon';
  if (score >= 50) return 'intermédiaire';
  if (score >= 35) return 'fragile';
  return 'insuffisant';
}

/**
 * Domain label mapping.
 */
const DOMAIN_LABELS: Record<string, string> = {
  algebra: 'Algèbre',
  analysis: 'Analyse',
  geometry: 'Géométrie',
  probabilities: 'Probabilités',
  python: 'Python / Algorithmique',
  data_representation: 'Représentation des données',
  data_processing: 'Traitement des données',
  algorithms: 'Algorithmique',
  python_programming: 'Langage Python',
  systems_architecture: 'Architecture & OS',
  data_structures: 'Structures de données',
  algorithmic_advanced: 'Algorithmique avancée',
  databases: 'Bases de données',
  networks: 'Réseaux & OS',
  systems_os: 'Systèmes d\'exploitation',
  python_advanced: 'POO & Projets',
  prob_stats: 'Probabilités & statistiques',
  algo_prog: 'Algorithmique & programmation',
  logic_sets: 'Logique & ensembles',
  algorithmic: 'Algorithmique & programmation',
};

/**
 * Discipline label for dynamic titles.
 */
function disciplineLabel(discipline?: string): string {
  if (discipline === 'nsi') return 'NSI';
  return 'Mathématiques';
}

/**
 * Level label for display.
 */
function levelLabel(level?: string): string {
  if (level === 'terminale') return 'Terminale';
  return 'Première';
}

/**
 * Render the élève bilan (student-facing).
 */
export function renderEleveBilan(
  scoring: ScoringV2Result,
  ctx: RenderContext,
  enrichment?: LLMEnrichment
): string {
  const lines: string[] = [];

  const disc = disciplineLabel(ctx.discipline);
  const lvl = levelLabel(ctx.level);
  lines.push(`# 📊 Mon Diagnostic ${disc}`);
  lines.push('');
  lines.push(enrichment?.eleveIntro || `Bonjour ${ctx.firstName} ! Voici ton bilan personnalisé pour préparer l'épreuve de ${disc} en ${lvl}.`);
  lines.push('');

  // Résumé 60 secondes
  lines.push(`## En résumé`);
  lines.push('');
  lines.push(`- **Score de préparation** : ${scoring.readinessScore}/100`);
  lines.push(`- **Maîtrise** : ${scoring.masteryIndex}/100`);
  lines.push(`- **Couverture du programme** : ${scoring.coverageIndex}/100`);
  lines.push(`- **Préparation épreuve** : ${scoring.examReadinessIndex}/100`);
  lines.push(`- **Décision** : ${scoring.recommendationMessage}`);
  lines.push('');

  // TrustScore indicator
  if (scoring.trustLevel === 'red') {
    lines.push(`> ⚠️ *Certaines données sont incomplètes — ce bilan est à confirmer en séance.*`);
    lines.push('');
  }

  // Top 3 forces
  const strengths = scoring.domainScores
    .filter((d) => d.priority === 'low' || d.priority === 'medium')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (strengths.length > 0) {
    lines.push(`## ✅ Tes points forts`);
    lines.push('');
    for (const s of strengths) {
      lines.push(`- **${DOMAIN_LABELS[s.domain] || s.domain}** : ${s.score}% — continue comme ça !`);
    }
    lines.push('');
  }

  // Top 5 priorités
  if (scoring.topPriorities.length > 0) {
    lines.push(`## 🎯 Tes priorités`);
    lines.push('');
    for (const p of scoring.topPriorities.slice(0, 5)) {
      lines.push(`- **${p.skillLabel}** (${DOMAIN_LABELS[p.domain] || p.domain}) — ${p.reason}`);
      if (p.exerciseType) lines.push(`  → *${p.exerciseType}*`);
    }
    lines.push('');
  }

  // Quick wins
  if (scoring.quickWins.length > 0) {
    lines.push(`## 💡 Gains rapides`);
    lines.push('');
    for (const q of scoring.quickWins) {
      lines.push(`- **${q.skillLabel}** — ${q.reason}`);
      if (q.exerciseType) lines.push(`  → *${q.exerciseType}*`);
    }
    lines.push('');
  }

  // Profil d'apprentissage
  lines.push(`## 🧠 Ton profil`);
  lines.push('');
  if (ctx.learningStyle) lines.push(`- Style d'apprentissage : **${ctx.learningStyle}**`);
  if (ctx.maxConcentration) lines.push(`- Concentration max : **${ctx.maxConcentration}**`);
  if (ctx.weeklyWork) lines.push(`- Travail hebdo : **${ctx.weeklyWork}**`);
  lines.push('');

  // Bases à consolider (prérequis faibles)
  if (ctx.weakPrerequisites && ctx.weakPrerequisites.length > 0) {
    lines.push(`## 🧱 Bases à consolider`);
    lines.push('');
    lines.push(`Ces fondamentaux sont importants pour la suite du programme, même si tu ne les as pas encore abordés en classe cette année :`);
    lines.push('');
    for (const p of ctx.weakPrerequisites) {
      const masteryPct = Math.round((p.mastery / 4) * 100);
      lines.push(`- **${p.skillLabel}** (${DOMAIN_LABELS[p.domain] || p.domain}) — maîtrise actuelle : ${masteryPct}%`);
    }
    lines.push('');
  }

  // Micro-plan adapté EDS/niveau
  lines.push(`## 📅 Ton micro-plan d'entraînement`);
  lines.push('');
  if (ctx.discipline === 'nsi') {
    lines.push(`**⏱ 5 min** : relire 1 fiche mémo (structure de données, complexité, ou SQL)`);
    lines.push(`**⏱ 15 min** : résoudre 1 exercice de code ou 1 requête SQL sur papier`);
    lines.push(`**⏱ 30 min** : implémenter 1 algorithme complet (tri, parcours, ou requête multi-tables)`);
  } else {
    lines.push(`**⏱ 5 min** : 3 calculs d'automatismes sans calculatrice`);
    lines.push(`**⏱ 15 min** : reprendre 1 compétence prioritaire (exercice type)`);
    lines.push(`**⏱ 30 min** : 1 exercice complet en conditions d'examen (rédaction soignée)`);
  }
  lines.push('');
  lines.push(`> Adapte ce plan à ton rythme : l'important est la **régularité**, pas la durée.`);
  lines.push('');

  // Alerts
  const studentAlerts = scoring.alerts.filter((a) => a.type === 'danger' || a.type === 'warning');
  if (studentAlerts.length > 0) {
    lines.push(`## ⚡ Points d'attention`);
    lines.push('');
    for (const a of studentAlerts) {
      lines.push(`- ${a.message}`);
    }
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`*${scoring.recommendationMessage}*`);

  return lines.join('\n');
}

/**
 * Render the parents bilan (parent-facing).
 */
export function renderParentsBilan(
  scoring: ScoringV2Result,
  ctx: RenderContext,
  enrichment?: LLMEnrichment
): string {
  const lines: string[] = [];

  const disc = disciplineLabel(ctx.discipline);
  const lvl = levelLabel(ctx.level);
  lines.push(`# Rapport de Positionnement — ${disc}`);
  lines.push('');
  lines.push(enrichment?.parentsIntro || `Madame, Monsieur,`);
  lines.push('');
  lines.push(`Voici le bilan diagnostic de ${ctx.firstName} ${ctx.lastName} en ${disc.toLowerCase()}, réalisé dans le cadre de la préparation à l'épreuve de ${lvl} 2026.`);
  lines.push('');

  // Synthèse globale (qualitative, pas de scores bruts)
  lines.push(`## Synthèse globale`);
  lines.push('');
  const level = qualitativeLabel(scoring.readinessScore);
  lines.push(`Le niveau de préparation de ${ctx.firstName} est **${level}**. ${scoring.recommendationMessage}.`);
  lines.push('');

  // Fiabilité
  if (scoring.trustLevel !== 'green') {
    lines.push(`> *Note : certaines données du questionnaire sont incomplètes. Les conclusions ci-dessous sont à confirmer lors de la première séance de stage.*`);
    lines.push('');
  }

  // Points forts
  const strengths = scoring.domainScores
    .filter((d) => d.priority === 'low' || d.priority === 'medium')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (strengths.length > 0) {
    lines.push(`## Ce qui va bien`);
    lines.push('');
    for (const s of strengths) {
      lines.push(`- **${DOMAIN_LABELS[s.domain] || s.domain}** : niveau de maîtrise ${qualitativeLabel(s.score)}`);
    }
    lines.push('');
  }

  // Points d'attention
  const weakDomains = scoring.domainScores
    .filter((d) => d.priority === 'critical' || d.priority === 'high')
    .sort((a, b) => a.score - b.score);
  if (weakDomains.length > 0) {
    lines.push(`## Points d'attention`);
    lines.push('');
    for (const w of weakDomains) {
      const gapText = w.gaps.length > 0 ? ` (${w.gaps.slice(0, 3).join(', ')})` : '';
      lines.push(`- **${DOMAIN_LABELS[w.domain] || w.domain}** : des lacunes identifiées nécessitant un travail ciblé${gapText}`);
    }
    lines.push('');
  }

  // Signaux d'alerte
  const dangerAlerts = scoring.alerts.filter((a) => a.type === 'danger');
  if (dangerAlerts.length > 0) {
    lines.push(`## Signaux d'alerte`);
    lines.push('');
    for (const a of dangerAlerts) {
      lines.push(`- ${a.message}`);
    }
    lines.push('');
  }

  // Recommandation
  lines.push(`## Recommandation`);
  lines.push('');
  lines.push(scoring.recommendationMessage);
  if (scoring.justification) {
    lines.push('');
    lines.push(`*${scoring.justification}*`);
  }
  lines.push('');

  // Upgrade conditions
  if (scoring.upgradeConditions.length > 0) {
    lines.push(`## Conditions de progression`);
    lines.push('');
    for (const c of scoring.upgradeConditions) {
      lines.push(`- ${c}`);
    }
    lines.push('');
  }

  // Ce que le stage apporte
  lines.push(`## Ce que le stage va apporter`);
  lines.push('');
  lines.push(`- Travail ciblé sur les lacunes identifiées`);
  lines.push(ctx.discipline === 'nsi'
    ? `- Renforcement des compétences en programmation et algorithmique`
    : `- Renforcement des automatismes pour l'épreuve sans calculatrice`);
  lines.push(`- Accompagnement méthodologique personnalisé`);
  if (scoring.quickWins.length > 0) {
    lines.push(`- Gains rapides identifiés : ${scoring.quickWins.map((q) => q.skillLabel).join(', ')}`);
  }
  lines.push('');

  // Conseils
  lines.push(`## Comment accompagner ${ctx.firstName}`);
  lines.push('');
  lines.push(`- Encourager une routine quotidienne de 15-20 minutes`);
  lines.push(`- Valoriser les progrès, même petits`);
  if (scoring.alerts.some((a) => a.code === 'HIGH_STRESS' || a.code === 'PANIC_SIGNAL')) {
    lines.push(`- Attention au stress : un accompagnement bienveillant est essentiel`);
  }
  lines.push('');

  lines.push(`---`);
  lines.push(`*Bilan réalisé par Nexus Réussite — Centre de soutien scolaire*`);

  return lines.join('\n');
}

/**
 * Render the Nexus bilan (staff-facing, technical).
 */
export function renderNexusBilan(
  scoring: ScoringV2Result,
  ctx: RenderContext,
  enrichment?: LLMEnrichment
): string {
  const lines: string[] = [];

  lines.push(`# Fiche Pédagogique — ${ctx.firstName} ${ctx.lastName}`);
  lines.push('');

  // Data quality
  lines.push(`## Qualité des données`);
  lines.push('');
  lines.push(`| Métrique | Valeur |`);
  lines.push(`|----------|--------|`);
  lines.push(`| TrustScore | **${scoring.trustScore}/100** (${scoring.trustLevel}) |`);
  lines.push(`| Domaines actifs | ${scoring.dataQuality.activeDomains}/5 |`);
  lines.push(`| Compétences évaluées | ${scoring.dataQuality.evaluatedCompetencies} |`);
  lines.push(`| Non étudiées | ${scoring.dataQuality.notStudiedCompetencies} |`);
  lines.push(`| Inconnues | ${scoring.dataQuality.unknownCompetencies} |`);
  lines.push(`| Qualité | ${scoring.dataQuality.quality} |`);
  lines.push(`| Incohérences | ${scoring.inconsistencies.length} |`);
  lines.push('');

  // Scores
  lines.push(`## Scores`);
  lines.push('');
  lines.push(`| Indice | Score |`);
  lines.push(`|--------|-------|`);
  lines.push(`| ReadinessScore | **${scoring.readinessScore}/100** |`);
  lines.push(`| MasteryIndex | ${scoring.masteryIndex}/100 |`);
  lines.push(`| CoverageIndex | ${scoring.coverageIndex}/100 |`);
  lines.push(`| ExamReadinessIndex | ${scoring.examReadinessIndex}/100 |`);
  lines.push(`| RiskIndex | ${scoring.riskIndex}/100 |`);
  lines.push(`| Recommandation | ${scoring.recommendation} |`);
  lines.push('');

  // Coverage programme
  if (scoring.coverageProgramme) {
    const cp = scoring.coverageProgramme;
    lines.push(`## Couverture du programme`);
    lines.push('');
    lines.push(`| Métrique | Valeur |`);
    lines.push(`|----------|--------|`);
    lines.push(`| Chapitres vus | ${cp.seenChapters}/${cp.totalChapters} |`);
    lines.push(`| Chapitres en cours | ${cp.inProgressChapters} |`);
    lines.push(`| Ratio couverture | **${Math.round(cp.seenChapterRatio * 100)}%** |`);
    lines.push(`| Skills évalués (chapitres vus) | ${Math.round(cp.evaluatedSkillRatio * 100)}% |`);
    lines.push('');
  }

  // Domain map
  lines.push(`## Cartographie par domaine`);
  lines.push('');
  lines.push(`| Domaine | Score | Évalués | Gaps | Erreurs | Priorité |`);
  lines.push(`|---------|-------|---------|------|---------|----------|`);
  for (const d of scoring.domainScores) {
    lines.push(`| ${DOMAIN_LABELS[d.domain] || d.domain} | ${d.score}% | ${d.evaluatedCount}/${d.totalCount} | ${d.gaps.length > 0 ? d.gaps.join(', ') : '—'} | ${d.dominantErrors.length > 0 ? d.dominantErrors.join(', ') : '—'} | ${d.priority} |`);
  }
  lines.push('');

  // Priorities
  if (scoring.highRisk.length > 0) {
    lines.push(`## 🔴 Points bloquants`);
    lines.push('');
    for (const p of scoring.highRisk) {
      lines.push(`- **${p.skillLabel}** (${p.domain}) — ${p.reason}`);
    }
    lines.push('');
  }

  if (scoring.topPriorities.length > 0) {
    lines.push(`## 🟠 Priorités pédagogiques`);
    lines.push('');
    for (const p of scoring.topPriorities) {
      lines.push(`- **${p.skillLabel}** (${p.domain}) — ${p.reason} → ${p.exerciseType || 'exercices ciblés'}`);
    }
    lines.push('');
  }

  if (scoring.quickWins.length > 0) {
    lines.push(`## 🟢 Gains rapides`);
    lines.push('');
    for (const p of scoring.quickWins) {
      lines.push(`- **${p.skillLabel}** (${p.domain}) — ${p.reason}`);
    }
    lines.push('');
  }

  // Alerts
  lines.push(`## Alertes`);
  lines.push('');
  if (scoring.alerts.length > 0) {
    for (const a of scoring.alerts) {
      lines.push(`- [${a.type.toUpperCase()}] **${a.code}** : ${a.message}`);
      if (a.impact) lines.push(`  → ${a.impact}`);
    }
  } else {
    lines.push('Aucune alerte.');
  }
  lines.push('');

  // Inconsistencies
  if (scoring.inconsistencies.length > 0) {
    lines.push(`## Incohérences détectées`);
    lines.push('');
    for (const inc of scoring.inconsistencies) {
      lines.push(`- [${inc.severity.toUpperCase()}] **${inc.code}** : ${inc.message}`);
      lines.push(`  Champs : ${inc.fields.join(', ')}`);
    }
    lines.push('');
  }

  // Profil cognitif
  lines.push(`## Profil cognitif`);
  lines.push('');
  lines.push(`- Style : ${ctx.learningStyle || '—'}`);
  lines.push(`- Réflexe blocage : ${ctx.problemReflex || '—'}`);
  lines.push(`- Concentration : ${ctx.maxConcentration || '—'}`);
  lines.push(`- Travail hebdo : ${ctx.weeklyWork || '—'}`);
  lines.push(`- Mini-test : ${ctx.miniTestScore}/6 en ${ctx.miniTestTime}min (${ctx.miniTestCompleted ? 'terminé' : 'non terminé'})`);
  lines.push('');

  // Verbatims
  const verbatimEntries = Object.entries(ctx.verbatims).filter(([, v]) => v);
  if (verbatimEntries.length > 0) {
    lines.push(`## Verbatims élève`);
    lines.push('');
    for (const [key, value] of verbatimEntries) {
      lines.push(`- **${key}** : « ${value} »`);
    }
    lines.push('');
  }

  // Justification
  lines.push(`## Justification décision`);
  lines.push('');
  lines.push(scoring.justification);
  if (scoring.upgradeConditions.length > 0) {
    lines.push('');
    lines.push('**Conditions d\'upgrade :**');
    for (const c of scoring.upgradeConditions) {
      lines.push(`- ${c}`);
    }
  }
  lines.push('');

  if (enrichment?.nexusNotes) {
    lines.push(`## Notes complémentaires (LLM)`);
    lines.push('');
    lines.push(enrichment.nexusNotes);
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`*Généré automatiquement — données à valider en séance*`);

  return lines.join('\n');
}

/**
 * Render all 3 audience bilans from scoring data.
 * This is the deterministic fallback that works without LLM.
 */
export function renderAllBilans(
  scoring: ScoringV2Result,
  ctx: RenderContext,
  enrichment?: LLMEnrichment
): { eleve: string; parents: string; nexus: string } {
  return {
    eleve: renderEleveBilan(scoring, ctx, enrichment),
    parents: renderParentsBilan(scoring, ctx, enrichment),
    nexus: renderNexusBilan(scoring, ctx, enrichment),
  };
}
