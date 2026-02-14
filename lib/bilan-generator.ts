import { ollamaChat } from '@/lib/ollama-client';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';
import type { BilanDiagnosticMathsData } from '@/lib/validations';
import type { ScoringResult } from '@/lib/bilan-scoring';

/**
 * Bilan Generator — Generates 3 audience-specific reports using:
 * - Ollama + Qwen 2.5:32b (local LLM on server)
 * - RAG Ingestor (ChromaDB + nomic-embed-text) for pedagogical context
 *
 * Pipeline: RAG search → build context → Ollama chat → parse JSON → 3 bilans
 */

const BILAN_SYSTEM_PROMPT = `Tu es un expert pédagogique en mathématiques de niveau lycée (programme français, Première spécialité).
Tu travailles pour Nexus Réussite, un centre de soutien scolaire en Tunisie.
Tu reçois les données structurées d'un bilan diagnostic pré-stage (v1.3) ainsi que les scores calculés.
Tu peux aussi recevoir du contexte pédagogique issu de la base de connaissances Nexus Réussite.

Tu dois générer 3 versions du bilan en JSON avec les clés: "eleve", "parents", "nexus".
Chaque valeur est une chaîne de texte en Markdown.

## VERSION ÉLÈVE ("Mon Diagnostic Maths")
- Ton : bienveillant, direct, motivant. Tutoiement.
- Contenu : score de préparation, top 3 forces, top 5 priorités avec conseils concrets, profil d'apprentissage, objectifs du stage.
- Format : sections courtes, bullet points, pas de jargon.
- Longueur : ~400 mots.

## VERSION PARENTS ("Rapport de positionnement")
- Ton : professionnel, rassurant, transparent. Vouvoiement.
- Contenu : synthèse globale, points forts, points d'attention, signaux d'alerte si applicable, recommandation pallier avec justification, bénéfices concrets du stage, conseils pour accompagner.
- Format : sections structurées, langage accessible (pas de M/C/F, pas de skillId).
- Longueur : ~500 mots.

## VERSION NEXUS ("Fiche pédagogique")
- Ton : technique, factuel.
- Contenu : scores bruts, cartographie par domaine, profil cognitif, signaux d'alerte, plan de stage suggéré, verbatims élève.
- Format : tableaux markdown, données structurées.
- Longueur : ~600 mots.

Règles :
- Ne jamais inventer de données. Utiliser uniquement les données fournies.
- Si une section manque de données, indiquer "Données insuffisantes".
- Ne pas exposer les scores bruts (ReadinessScore, RiskIndex) dans la version parents — utiliser des termes qualitatifs.
- Si du contexte pédagogique est fourni, l'utiliser pour enrichir les conseils et recommandations.
- Toujours retourner un JSON valide avec exactement les 3 clés "eleve", "parents", "nexus".`;

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
 */
function buildRAGQueries(data: BilanDiagnosticMathsData, scoring: ScoringResult): string[] {
  const queries: string[] = [];

  // Query for weak domains
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

  // Query for dominant error types
  const errorTypes = data.methodology.errorTypes || [];
  if (errorTypes.length > 0) {
    queries.push(`erreurs fréquentes ${errorTypes.slice(0, 2).join(' ')} méthode correction`);
  }

  // Query for exam preparation if risk is high
  if (scoring.riskIndex > 60) {
    queries.push('épreuve anticipée mathématiques préparation automatismes');
  }

  return queries.slice(0, 4);
}

/**
 * Generate the 3 audience-specific bilans using Ollama (Qwen 2.5:32b) + RAG.
 * Pipeline: RAG search → build context → Ollama chat → parse JSON → 3 bilans.
 * Falls back to template-based generation if LLM is unavailable.
 */
export async function generateBilans(
  data: BilanDiagnosticMathsData,
  scoring: ScoringResult
): Promise<GeneratedBilans> {
  const diagnosticContext = prepareLLMContext(data, scoring);

  // 1. RAG: retrieve relevant pedagogical content
  let ragContext = '';
  try {
    const ragQueries = buildRAGQueries(data, scoring);
    const allHits = [];
    for (const query of ragQueries) {
      const hits = await ragSearch({ query, k: 2 });
      allHits.push(...hits);
    }
    // Deduplicate by ID
    const uniqueHits = Array.from(
      new Map(allHits.map((h) => [h.id, h])).values()
    ).slice(0, 6);
    ragContext = buildRAGContext(uniqueHits);
  } catch (error) {
    console.warn('RAG search failed, proceeding without pedagogical context:', error);
  }

  // 2. LLM: generate bilans via Ollama/Qwen
  try {
    const raw = await ollamaChat({
      model: process.env.OLLAMA_MODEL || 'qwen2.5:32b',
      messages: [
        { role: 'system', content: BILAN_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Voici les données du diagnostic pré-stage. Génère les 3 bilans en JSON (clés: "eleve", "parents", "nexus"):\n\n${diagnosticContext}${ragContext}`,
        },
      ],
      temperature: 0.5,
      numPredict: 4096,
      format: 'json',
      timeout: 180000,
    });

    if (!raw) {
      throw new Error('Empty LLM response from Ollama');
    }

    const parsed = JSON.parse(raw) as GeneratedBilans;

    if (!parsed.eleve || !parsed.parents || !parsed.nexus) {
      throw new Error('Missing bilan sections in LLM response');
    }

    return parsed;
  } catch (error) {
    console.error('Erreur génération bilan LLM (Ollama/Qwen):', error);
    return generateFallbackBilans(data, scoring);
  }
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
