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
};

/**
 * Render the élève bilan (student-facing).
 */
export function renderEleveBilan(
  scoring: ScoringV2Result,
  ctx: RenderContext,
  enrichment?: LLMEnrichment
): string {
  const lines: string[] = [];

  lines.push(`# 📊 Mon Diagnostic Maths`);
  lines.push('');
  lines.push(enrichment?.eleveIntro || `Bonjour ${ctx.firstName} ! Voici ton bilan personnalisé pour préparer l'épreuve anticipée de mathématiques.`);
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

  // Routine
  lines.push(`## 📅 Ta routine avant le stage`);
  lines.push('');
  lines.push(`1. **15 min/jour** : exercices d'automatismes sans calculatrice`);
  lines.push(`2. **20 min/jour** : reprendre 1 compétence prioritaire`);
  lines.push(`3. **1 sujet type** par semaine en conditions d'examen`);
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

  lines.push(`# Rapport de Positionnement — Mathématiques`);
  lines.push('');
  lines.push(enrichment?.parentsIntro || `Madame, Monsieur,`);
  lines.push('');
  lines.push(`Voici le bilan diagnostic de ${ctx.firstName} ${ctx.lastName} en mathématiques, réalisé dans le cadre de la préparation à l'épreuve anticipée 2026.`);
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
  lines.push(`- Renforcement des automatismes pour l'épreuve sans calculatrice`);
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
