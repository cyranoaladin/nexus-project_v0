import { ollamaChat } from '@/lib/ollama-client';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';
import type { BilanDiagnosticMathsData } from '@/lib/validations';
import type { ScoringResult } from '@/lib/bilan-scoring';
import type { ScoringV2Result, DiagnosticDefinition } from '@/lib/diagnostics/types';
import {
  buildPromptContextPack,
  renderPromptContext,
  buildChapterAwareRAGQueries,
} from '@/lib/diagnostics/prompt-context';

/**
 * Bilan Generator — Generates 3 audience-specific reports using:
 * - Ollama + Qwen 2.5:32b (local LLM on server)
 * - RAG Ingestor (ChromaDB + nomic-embed-text) for pedagogical context
 *
 * Pipeline: RAG search → build context → Ollama chat → parse JSON → 3 bilans
 */

export interface GeneratedBilans {
  eleve: string;
  parents: string;
  nexus: string;
}

/**
 * Prepare a concise data summary for the LLM prompt (avoid sending raw arrays).
 */
function prepareLLMContext(
  data: BilanDiagnosticMathsData,
  scoring: ScoringResult
): string {
  const domainSummary = scoring.domainScores
    .map(
      (d) =>
        `${d.domain}: ${d.score}% (${d.evaluatedCount}/${d.totalCount} évalués, gaps: ${d.gaps.length > 0 ? d.gaps.join(', ') : 'aucun'}, erreurs: ${d.dominantErrors.length > 0 ? d.dominantErrors.join(', ') : 'aucune'}, priorité: ${d.priority})`
    )
    .join('\n  ');

  const alertsSummary = scoring.alerts
    .map((a) => `[${a.type.toUpperCase()}] ${a.message}`)
    .join('\n  ');

  const verbatims = [
    data.openQuestions.algebraUnderstanding
      ? `Compréhension: "${data.openQuestions.algebraUnderstanding}"`
      : null,
    data.openQuestions.hardestAnalysisChapter
      ? `Difficulté analyse: "${data.openQuestions.hardestAnalysisChapter}"`
      : null,
    data.openQuestions.probabilityQuestion
      ? `Probas: "${data.openQuestions.probabilityQuestion}"`
      : null,
    data.freeText.mustImprove
      ? `À améliorer: "${data.freeText.mustImprove}"`
      : null,
    data.freeText.invisibleDifficulties
      ? `Difficultés invisibles: "${data.freeText.invisibleDifficulties}"`
      : null,
    data.freeText.message
      ? `Message libre: "${data.freeText.message}"`
      : null,
    data.examPrep.mainRisk
      ? `Risque principal: "${data.examPrep.mainRisk}"`
      : null,
  ]
    .filter(Boolean)
    .join('\n  ');

  return `
ÉLÈVE: ${data.identity.firstName} ${data.identity.lastName}
ÉTABLISSEMENT: ${data.schoolContext.establishment || 'Non renseigné'}
FILIÈRE: ${data.schoolContext.mathTrack || 'Non renseigné'}
MOYENNE MATHS: ${data.performance.mathAverage || 'Non renseigné'}
MOYENNE GÉNÉRALE: ${data.performance.generalAverage || 'Non renseigné'}
CLASSEMENT: ${data.performance.classRanking || 'Non renseigné'}

SCORES:
  ReadinessScore: ${scoring.readinessScore}/100
  RiskIndex: ${scoring.riskIndex}/100
  Recommandation: ${scoring.recommendation} — ${scoring.recommendationMessage}
  Qualité données: ${scoring.dataQuality.activeDomains}/5 domaines, ${scoring.dataQuality.evaluatedCompetencies} compétences évaluées

DOMAINES:
  ${domainSummary}

ÉPREUVE ANTICIPÉE:
  Mini-test: ${data.examPrep.miniTest.score}/6 (${data.examPrep.miniTest.completedInTime ? 'terminé' : 'non terminé'} en ${data.examPrep.miniTest.timeUsedMinutes}min)
  Rapidité: ${data.examPrep.selfRatings.speedNoCalc}/4
  Fiabilité calculs: ${data.examPrep.selfRatings.calcReliability}/4
  Rédaction: ${data.examPrep.selfRatings.redaction}/4
  Justifications: ${data.examPrep.selfRatings.justifications}/4
  Stress: ${data.examPrep.selfRatings.stress}/4
  Ressenti: ${data.examPrep.signals.feeling || 'Non renseigné'}
  Erreur dominante: ${data.examPrep.signals.dominantErrorType || 'Non renseigné'}
  Sujets zéro: ${data.examPrep.zeroSubjects || 'Non renseigné'}

MÉTHODOLOGIE:
  Style: ${data.methodology.learningStyle || 'Non renseigné'}
  Réflexe blocage: ${data.methodology.problemReflex || 'Non renseigné'}
  Travail hebdo: ${data.methodology.weeklyWork || 'Non renseigné'}
  Concentration max: ${data.methodology.maxConcentration || 'Non renseigné'}
  Erreurs fréquentes: ${(data.methodology.errorTypes || []).join(', ') || 'Non renseigné'}

AMBITION:
  Mention visée: ${data.ambition.targetMention || 'Non renseigné'}
  Post-bac: ${data.ambition.postBac || 'Non renseigné'}
  Rythme intensif: ${data.ambition.pallier2Pace || 'Non renseigné'}

QUESTIONS OUVERTES:
  Démo (u·v)': ${data.openQuestions.canDemonstrateProductRule || 'Non renseigné'}
  Exercice mixte géo: ${data.openQuestions.geometryMixedExercise || 'Non renseigné'}

ALERTES:
  ${alertsSummary || 'Aucune'}

VERBATIMS:
  ${verbatims || 'Aucun'}
`.trim();
}

/**
 * Build RAG queries from the diagnostic data to retrieve relevant pedagogical content.
 * Falls back to legacy logic if no definition is provided.
 */
function buildRAGQueries(
  data: BilanDiagnosticMathsData,
  scoring: ScoringResult | ScoringV2Result,
  definition?: DiagnosticDefinition | null
): string[] {
  // Use chapter-aware builder if definition is available
  if (definition && 'topPriorities' in scoring) {
    return buildChapterAwareRAGQueries(data, scoring as ScoringV2Result, definition);
  }

  // Legacy fallback
  const queries: string[] = [];
  const weakDomains = scoring.domainScores
    .filter((d) => d.priority === 'high' && d.score > 0)
    .slice(0, 3);

  for (const domain of weakDomains) {
    if (domain.gaps.length > 0) {
      queries.push(`${domain.domain} ${domain.gaps.slice(0, 2).join(' ')} exercices méthode`);
    } else {
      queries.push(`${domain.domain} première spécialité maths méthode`);
    }
  }

  const errorTypes = data.methodology?.errorTypes || [];
  if (errorTypes.length > 0) {
    queries.push(`erreurs fréquentes ${errorTypes.slice(0, 2).join(' ')} méthode correction`);
  }

  if (scoring.riskIndex > 60) {
    queries.push('épreuve anticipée mathématiques préparation automatismes');
  }

  return queries.slice(0, 4);
}

/**
 * Audience-specific prompt fragments (shorter = faster generation).
 * Enhanced with chapter-awareness and micro-plan requirements.
 */
const AUDIENCE_PROMPTS: Record<string, string> = {
  eleve: `Tu es un expert pédagogique bienveillant. Génère un bilan pour l'ÉLÈVE en Markdown.
Ton : bienveillant, direct, motivant. Tutoiement.
Contenu :
- Score de préparation
- 3 points forts
- 3 points faibles prioritaires (uniquement sur chapitres vus)
- 2 erreurs typiques (liées aux errorTypes)
- 1 recommandation méthodologique adaptée
- 1 micro-plan d'entraînement (5 min / 15 min / 30 min) adapté au programme
- Objectifs 7 jours + 30 jours
IMPORTANT: Ne pas exiger de notions issues des chapitres non encore vus.
Distinguer: "sécuriser les acquis" vs "préparer les prochains chapitres".
Format : sections courtes, bullet points, pas de jargon. ~400 mots.
Retourne UNIQUEMENT le texte Markdown du bilan, rien d'autre.`,

  parents: `Tu es un expert pédagogique professionnel. Génère un rapport pour les PARENTS en Markdown.
Ton : professionnel, rassurant, transparent. Vouvoiement.
Contenu :
- Synthèse globale du diagnostic
- Points forts identifiés
- Points d'attention (sans culpabiliser)
- Recommandation pallier avec justification
- Conseils d'accompagnement réalistes
- Bénéfices concrets du stage
Ne pas exposer les scores bruts — utiliser des termes qualitatifs.
IMPORTANT: Mentionner que certains chapitres n'ont pas encore été abordés en classe (si applicable).
Format : sections structurées, langage accessible. ~500 mots.
Retourne UNIQUEMENT le texte Markdown du rapport, rien d'autre.`,

  nexus: `Tu es un expert pédagogique technique. Génère une fiche pédagogique pour l'ÉQUIPE NEXUS en Markdown.
Ton : technique, factuel.
Contenu :
- Scores bruts + TrustScore
- Cartographie par domaine (tableau)
- Couverture programme (chapitres vus/non vus)
- Profil cognitif + profil de travail
- Signaux d'alerte
- Priorités (skills + justifications)
- Plan avant/durant/après stage
- Risques (temps, rédaction, compréhension, code)
- Ressources recommandées (issues RAG + fallback interne)
- Verbatims élève
Format : tableaux markdown, données structurées. ~600 mots.
Retourne UNIQUEMENT le texte Markdown de la fiche, rien d'autre.`,
};

/**
 * Generate a single audience bilan via Ollama.
 */
async function generateSingleBilan(
  audience: string,
  diagnosticContext: string,
  ragContext: string
): Promise<string> {
  const systemPrompt = AUDIENCE_PROMPTS[audience];
  if (!systemPrompt) throw new Error(`Unknown audience: ${audience}`);

  const raw = await ollamaChat({
    model: process.env.OLLAMA_MODEL || 'llama3.2:latest',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Voici les données du diagnostic pré-stage :\n\n${diagnosticContext}${ragContext}`,
      },
    ],
    temperature: 0.5,
    numPredict: 2048,
    format: '',
    timeout: 120000,
  });

  if (!raw || raw.trim().length < 50) {
    throw new Error(`Empty or too short LLM response for ${audience}`);
  }

  return raw.trim();
}

/**
 * Generate the 3 audience-specific bilans using Ollama + RAG.
 * Supports both legacy ScoringResult and new ScoringV2Result.
 * When a DiagnosticDefinition is provided, uses chapter-aware prompts and RAG queries.
 */
export async function generateBilans(
  data: BilanDiagnosticMathsData,
  scoring: ScoringResult | ScoringV2Result,
  definition?: DiagnosticDefinition | null
): Promise<GeneratedBilans> {
  const isV2 = 'topPriorities' in scoring;

  // 1. RAG: retrieve relevant pedagogical content
  let ragContext = '';
  const ragCollections = definition?.ragPolicy?.collections ?? [];
  try {
    const ragQueries = buildRAGQueries(data, scoring, definition);
    const allHits = [];
    for (const query of ragQueries) {
      const hits = await ragSearch({
        query,
        k: 2,
        ...(ragCollections.length > 0 ? { collection: ragCollections[0] } : {}),
      });
      allHits.push(...hits);
    }
    const uniqueHits = Array.from(
      new Map(allHits.map((h) => [h.id, h])).values()
    ).slice(0, 6);
    ragContext = buildRAGContext(uniqueHits);
  } catch (error) {
    console.warn('RAG search failed, proceeding without pedagogical context:', error);
  }

  // 2. Build context: use prompt context pack if V2 + definition available
  let diagnosticContext: string;
  if (isV2 && definition) {
    const ctxPack = buildPromptContextPack(data, scoring as ScoringV2Result, definition, ragContext);
    diagnosticContext = renderPromptContext(ctxPack);
    // Also prepend student identity + performance
    const identityBlock = `ÉLÈVE: ${data.identity.firstName} ${data.identity.lastName}
ÉTABLISSEMENT: ${data.schoolContext?.establishment || 'Non renseigné'}
MOYENNE: ${data.performance?.mathAverage || 'Non renseigné'}
AMBITION: ${data.ambition?.targetMention || 'Non renseigné'} / ${data.ambition?.postBac || 'Non renseigné'}

MÉTHODOLOGIE:
  Style: ${data.methodology?.learningStyle || 'Non renseigné'}
  Travail hebdo: ${data.methodology?.weeklyWork || 'Non renseigné'}
  Concentration max: ${data.methodology?.maxConcentration || 'Non renseigné'}
  Erreurs fréquentes: ${(data.methodology?.errorTypes || []).join(', ') || 'Non renseigné'}

VERBATIMS:
  ${data.freeText?.mustImprove ? `À améliorer: "${data.freeText.mustImprove}"` : ''}
  ${data.freeText?.invisibleDifficulties ? `Difficultés invisibles: "${data.freeText.invisibleDifficulties}"` : ''}
  ${data.freeText?.message ? `Message libre: "${data.freeText.message}"` : ''}
`;
    diagnosticContext = identityBlock + '\n' + diagnosticContext;
  } else {
    diagnosticContext = prepareLLMContext(data, scoring as ScoringResult);
  }

  const fallback = generateFallbackBilans(data, scoring as ScoringResult);

  // 3. LLM: generate 3 bilans SEQUENTIALLY
  let eleve = fallback.eleve;
  let parents = fallback.parents;
  let nexus = fallback.nexus;
  let llmSuccessCount = 0;

  for (const audience of ['eleve', 'parents', 'nexus'] as const) {
    try {
      const result = await generateSingleBilan(audience, diagnosticContext, isV2 ? '' : ragContext);
      if (audience === 'eleve') eleve = result;
      else if (audience === 'parents') parents = result;
      else nexus = result;
      llmSuccessCount++;
    } catch (error) {
      console.error(`LLM ${audience} failed, using fallback:`, error);
    }
  }

  console.log(`Bilan generation: ${llmSuccessCount}/3 sections generated by LLM`);

  return { eleve, parents, nexus };
}

/**
 * Fallback template-based bilan generation when LLM is unavailable.
 */
function generateFallbackBilans(
  data: BilanDiagnosticMathsData,
  scoring: ScoringResult
): GeneratedBilans {
  const firstName = data.identity.firstName;
  const topDomains = scoring.domainScores
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score);
  const strengths = topDomains.slice(0, 3);
  const weaknesses = [...topDomains].sort((a, b) => a.score - b.score).slice(0, 3);

  const eleve = `# Mon Diagnostic Maths

Bonjour ${firstName} !

## Ton score de préparation : ${scoring.readinessScore}/100

${strengths.length > 0 ? `### Tes points forts\n${strengths.map((d) => `- **${d.domain}** : ${d.score}%`).join('\n')}` : 'Données insuffisantes pour identifier tes points forts.'}

${weaknesses.length > 0 ? `### Tes priorités\n${weaknesses.map((d) => `- **${d.domain}** : ${d.score}% — ${d.gaps.length > 0 ? `à revoir : ${d.gaps.slice(0, 3).join(', ')}` : 'à consolider'}`).join('\n')}` : ''}

### Ton profil
- Style d'apprentissage : ${data.methodology.learningStyle || 'à déterminer'}
- Concentration max : ${data.methodology.maxConcentration || 'à déterminer'}

${scoring.alerts.length > 0 ? `### Points d'attention\n${scoring.alerts.map((a) => `- ${a.message}`).join('\n')}` : ''}

**Recommandation** : ${scoring.recommendationMessage}`;

  const parents = `# Rapport de Positionnement — Mathématiques

## Synthèse

Votre enfant ${firstName} se situe à un niveau ${scoring.readinessScore >= 70 ? 'solide' : scoring.readinessScore >= 50 ? 'intermédiaire' : 'à consolider'} en mathématiques pour la préparation de l'épreuve anticipée 2026.

${strengths.length > 0 ? `## Ce qui va bien\n${strengths.map((d) => `- **${d.domain}** : bon niveau de maîtrise`).join('\n')}` : ''}

${weaknesses.length > 0 ? `## Points d'attention\n${weaknesses.map((d) => `- **${d.domain}** : des lacunes identifiées nécessitant un travail ciblé`).join('\n')}` : ''}

${scoring.alerts.filter((a) => a.type === 'danger' || a.type === 'warning').length > 0 ? `## Signaux d'alerte\n${scoring.alerts.filter((a) => a.type !== 'info').map((a) => `- ${a.message}`).join('\n')}` : ''}

## Recommandation
${scoring.recommendationMessage}

## Ce que le stage va apporter
- Travail ciblé sur les lacunes identifiées
- Renforcement des automatismes pour l'épreuve sans calculatrice
- Accompagnement méthodologique personnalisé`;

  const nexus = `# Fiche Pédagogique — Diagnostic Pré-Stage

## Scores
- **ReadinessScore** : ${scoring.readinessScore}/100
- **RiskIndex** : ${scoring.riskIndex}/100
- **Recommandation** : ${scoring.recommendation}
- **Qualité données** : ${scoring.dataQuality.activeDomains}/5 domaines, ${scoring.dataQuality.evaluatedCompetencies} compétences

## Cartographie par domaine
${scoring.domainScores.map((d) => `| ${d.domain} | ${d.score}% | ${d.gaps.length} gaps | ${d.dominantErrors.join(', ') || '—'} | ${d.priority} |`).join('\n')}

## Profil cognitif
- Style : ${data.methodology.learningStyle || '—'}
- Réflexe blocage : ${data.methodology.problemReflex || '—'}
- Concentration : ${data.methodology.maxConcentration || '—'}
- Travail hebdo : ${data.methodology.weeklyWork || '—'}

## Alertes
${scoring.alerts.map((a) => `- [${a.type.toUpperCase()}] ${a.message}`).join('\n') || 'Aucune'}

## Verbatims
${data.freeText.mustImprove ? `- À améliorer : "${data.freeText.mustImprove}"` : ''}
${data.freeText.invisibleDifficulties ? `- Difficultés invisibles : "${data.freeText.invisibleDifficulties}"` : ''}
${data.examPrep.mainRisk ? `- Risque principal : "${data.examPrep.mainRisk}"` : ''}`;

  return { eleve, parents, nexus };
}
