/**
 * LLM-powered EAF parent report generator.
 *
 * Pipeline:
 *   RAG search (rag_francais_premiere) → structured prompt → Ollama → Markdown
 *   Fallback: deterministic template if LLM unavailable or response too short.
 *
 * Design rules enforced via system prompt:
 *  - Professional French, vouvoiement for parents
 *  - Coach raw notes are NEVER reproduced verbatim — rewritten as professional prose
 *  - No numerical scores exposed to parents
 *  - Constructive framing even for severe difficulties
 *  - Concrete, actionable pedagogical recommendations from RAG context
 */

import { ollamaChat } from '@/lib/ollama-client';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';
import type { CoachEafSourceData } from './types';
import { generateParentEafStageReport } from './generate-parent-report';

const RAG_COLLECTION = 'rag_francais_premiere';

export type EafStudentInfo = {
  firstName?: string;
  lastName?: string;
  gradeLevel?: string;
};

export type EafLLMResult = {
  markdown: string;
  llmUsed: boolean;
  ragHitCount: number;
};

// ─── Rating labels ────────────────────────────────────────────────────────────

function ratingLabel(n: number | undefined): string {
  const labels: Record<number, string> = {
    1: 'insuffisant',
    2: 'fragile',
    3: 'en progression',
    4: 'satisfaisant',
    5: 'maîtrisé',
  };
  return n ? (labels[n] ?? 'non évalué') : 'non évalué';
}

const ATTENDANCE_FR: Record<string, string> = {
  'excellente':   'excellente',
  'reguliere':    'régulière',
  'irreguliere':  'irrégulière',
  'insuffisante': 'insuffisante',
};
const PUNCTUALITY_FR: Record<string, string> = {
  'tres-satisfaisante': 'très satisfaisante',
  'satisfaisante':      'satisfaisante',
  'a-ameliorer':        'à améliorer',
};
const ATTITUDE_FR: Record<string, string> = {
  'perseverant':              'persévérant(e) face aux obstacles',
  'volontaire-mais-hesitant': 'volontaire mais encore hésitant(e)',
  'manque-de-confiance':      'manquant de confiance en ses capacités',
  'se-decourage-rapidement':  'ayant tendance à se décourager face aux difficultés',
  'besoin-detre-guide':       'ayant besoin d\'un guidage régulier pour avancer',
};
const PROGRESS_FR: Record<string, string> = {
  'tres-nette': 'très nette',
  'nette':      'nette',
  'moderee':    'modérée',
  'legere':     'légère',
  'insuffisante': 'insuffisante sur la durée du stage',
};
const SKILL_FR: Record<string, string> = {
  'comprehension-des-textes': 'la compréhension des textes',
  'analyse-des-citations':    'l\'analyse des citations',
  'construction-du-plan':     'la construction du plan',
  'redaction':                'la qualité de rédaction',
  'dissertation':             'la méthode de dissertation',
  'commentaire':              'la méthode du commentaire',
  'gestion-du-temps':         'la gestion du temps',
  'confiance':                'la confiance à l\'écrit',
  'methode':                  'la méthode de travail',
};
const LEVEL_FR: Record<string, string> = {
  'tres-solide':            'très solide',
  'satisfaisant':           'satisfaisant',
  'fragile-mais-en-progres': 'fragile mais en progression',
  'fragile':                'fragile',
  'preoccupant':            'préoccupant',
};
const FOLLOW_UP_FR: Record<string, string> = {
  'autonomie-suffisante':   'autonomie suffisante pour progresser en travail personnel',
  'consolidation-ponctuelle': 'consolidation ponctuelle recommandée',
  'accompagnement-regulier':  'accompagnement régulier vivement recommandé',
  'entrainement-intensif':    'entraînement intensif avant l\'épreuve indispensable',
};
const AXIS_FR: Record<string, string> = {
  'commentaire':           'commentaire de texte',
  'dissertation':          'dissertation',
  'redaction':             'qualité de rédaction',
  'grammaire':             'correction grammaticale',
  'vocabulaire':           'enrichissement du vocabulaire',
  'lecture-analytique':    'lecture analytique',
  'references-litteraires': 'références littéraires',
  'gestion-du-temps':      'gestion du temps',
  'methode-de-revision':   'méthode de révision',
  'confiance-a-lecrit':    'confiance à l\'écrit',
};

// ─── RAG query builder ────────────────────────────────────────────────────────

function buildRAGQueries(sourceData: Partial<CoachEafSourceData>): string[] {
  const queries: string[] = [
    'préparation épreuve anticipée français EAF première méthode lycée',
  ];

  const com = sourceData.commentary ?? {};
  const wr  = sourceData.writing ?? {};
  const dis = sourceData.dissertation ?? {};

  // Commentaire weak?
  const comScores = [com.textUnderstanding, com.processAnalysis, com.interpretation, com.organization]
    .filter((v): v is number => typeof v === 'number');
  const comAvg = comScores.length ? comScores.reduce((a, b) => a + b, 0) / comScores.length : 3;
  if (comAvg < 3.5) {
    queries.push('méthode commentaire composé procédés littéraires analyse lycée première');
  }

  // Dissertation evaluated?
  const disHasData = typeof dis.subjectUnderstanding === 'number' || typeof dis.progressivePlan === 'number';
  if (disHasData) {
    queries.push('méthode dissertation littéraire plan problématique argumentation lycée');
  }

  // Writing weak?
  const wrScores = [wr.grammar, wr.spelling, wr.literaryVocabulary, wr.sentenceClarity]
    .filter((v): v is number => typeof v === 'number');
  const wrAvg = wrScores.length ? wrScores.reduce((a, b) => a + b, 0) / wrScores.length : 3;
  if (wrAvg < 3) {
    queries.push('expression écrite vocabulaire littéraire rédaction lycée français orthographe');
  }

  return queries.slice(0, 4);
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert pédagogique spécialisé en langue française et en préparation à l'Épreuve Anticipée de Français (EAF) dans les lycées français.

Tu rédiges des bilans de stage professionnels et bienveillants destinés aux parents d'élèves de Première. Ces bilans sont transmis aux familles qui attendent clarté, professionnalisme et conseils concrets pour accompagner leur enfant.

RÈGLES ABSOLUES — respecte-les sans exception :
1. **Français soutenu et professionnel.** Vouvoiement systématique pour les parents. Phrases complètes et bien construites.
2. **Prénom uniquement.** Utilise UNIQUEMENT le prénom de l'élève, jamais le nom complet.
3. **Jamais de reproduction des notes brutes du coach.** Tu transformes chaque observation en prose professionnelle et nuancée. Toute formulation informelle (ex: "Insuffisant !", "Tout revoir !", "Elle ne maîtrise pas l'exercice !") est réécrite en langage pédagogique.
4. **Constructivité obligatoire.** Toute difficulté identifiée est immédiatement suivie d'une piste d'amélioration concrète et réaliste.
5. **Zéro score numérique exposé.** Les parents ne voient que des termes qualitatifs, jamais de "3/5" ou de pourcentages.
6. **Markdown structuré.** Utilise ## pour les sections, ### pour les sous-sections, **gras** pour les termes clés pédagogiques, - pour les listes.
7. **Section non travaillée.** Si la dissertation ou un exercice n'a pas été abordé dans le stage, rédige une courte phrase l'indiquant sobrement.
8. **Recommandations ancrées.** S'appuie sur le contexte pédagogique fourni pour proposer des conseils spécifiques et actionnables.
9. **Longueur cible : 700 à 900 mots.** Sections équilibrées, chacune apportant une valeur ajoutée réelle.
10. **Ton adapté au profil.** Encourageant et mobilisateur pour un élève en difficulté ; valorisant et ambitieux pour un bon niveau.

STRUCTURE OBLIGATOIRE — 8 sections dans cet ordre :
## 1. Attitude et implication
## 2. Compréhension des attentes de l'épreuve
## 3. Commentaire de texte
## 4. Dissertation
## 5. Expression écrite
## 6. Progrès observés
## 7. Priorités de travail
## 8. Recommandation finale

Retourne UNIQUEMENT le Markdown du bilan, sans préambule, sans balise de code, sans commentaire.`;

// ─── User prompt builder ──────────────────────────────────────────────────────

function buildUserPrompt(
  sourceData: Partial<CoachEafSourceData>,
  student: EafStudentInfo,
  ragContext: string,
  date: Date,
): string {
  const firstName = student.firstName ?? "l'élève";
  const dateStr   = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const ae  = sourceData.attendanceAndEngagement ?? {};
  const ee  = sourceData.examExpectations ?? {};
  const com = sourceData.commentary ?? {};
  const dis = sourceData.dissertation ?? {};
  const wr  = sourceData.writing ?? {};
  const am  = sourceData.autonomyAndMethod ?? {};
  const pr  = sourceData.progress ?? {};
  const pra = sourceData.parentRecommendations ?? {};

  // Detect if dissertation was not part of this student's stage
  const disNotConcerned =
    [dis.strengths, dis.difficulties, dis.priority].some(s =>
      s?.toLowerCase().includes('pas concern') ||
      s?.toLowerCase().includes('non concern') ||
      s?.toLowerCase().includes('pas travail')
    );
  const disHasRatings = [
    dis.subjectUnderstanding, dis.keywordsAnalysis, dis.problematique,
    dis.progressivePlan, dis.arguments,
  ].some(v => typeof v === 'number');

  const lines: string[] = [];

  lines.push(`BILAN DE STAGE EAF — ${dateStr}`);
  lines.push(`Prénom : ${firstName}`);
  lines.push(`Durée : 16 heures — Préparation à l'EAF, Première`);
  lines.push('');

  // Section 1
  lines.push('=== PRÉSENCE ET ENGAGEMENT ===');
  if (ae.attendance)         lines.push(`Assiduité : ${ATTENDANCE_FR[ae.attendance] ?? ae.attendance}`);
  if (ae.punctuality)        lines.push(`Ponctualité : ${PUNCTUALITY_FR[ae.punctuality] ?? ae.punctuality}`);
  if (ae.involvement)        lines.push(`Implication : ${ratingLabel(ae.involvement)}`);
  if (ae.concentration)      lines.push(`Concentration : ${ratingLabel(ae.concentration)}`);
  if (ae.oralParticipation)  lines.push(`Participation orale : ${ratingLabel(ae.oralParticipation)}`);
  if (ae.attitudeToDifficulty) lines.push(`Attitude face aux difficultés : ${ATTITUDE_FR[ae.attitudeToDifficulty] ?? ae.attitudeToDifficulty}`);
  if (ae.coachComment?.trim()) lines.push(`Observations du coach (à reformuler) : ${ae.coachComment.trim()}`);
  lines.push('');

  // Section 2
  lines.push("=== COMPRÉHENSION DES ATTENTES DE L'EAF ===");
  if (ee.understandsWrittenExam)            lines.push(`Compréhension générale : ${ratingLabel(ee.understandsWrittenExam)}`);
  if (ee.distinguishesAnalysisAndSummary)   lines.push(`Distinction résumé/analyse : ${ratingLabel(ee.distinguishesAnalysisAndSummary)}`);
  if (ee.quoteVsAnalysis)                   lines.push(`Distinction citer/analyser : ${ratingLabel(ee.quoteVsAnalysis)}`);
  if (ee.subjectRequirements)               lines.push(`Exigences d'un sujet : ${ratingLabel(ee.subjectRequirements)}`);
  if (ee.avoidsOffTopic)                    lines.push(`Éviter le hors-sujet : ${ratingLabel(ee.avoidsOffTopic)}`);
  if (ee.successCriteria)                   lines.push(`Critères de réussite d'une copie : ${ratingLabel(ee.successCriteria)}`);
  if (ee.coachComment?.trim())              lines.push(`Observations (à reformuler) : ${ee.coachComment.trim()}`);
  lines.push('');

  // Section 3
  lines.push('=== COMMENTAIRE DE TEXTE ===');
  if (com.textUnderstanding)  lines.push(`Compréhension globale du texte : ${ratingLabel(com.textUnderstanding)}`);
  if (com.textIssues)         lines.push(`Repérage des enjeux : ${ratingLabel(com.textIssues)}`);
  if (com.readingProject)     lines.push(`Projet de lecture : ${ratingLabel(com.readingProject)}`);
  if (com.relevantQuotes)     lines.push(`Pertinence des citations : ${ratingLabel(com.relevantQuotes)}`);
  if (com.processAnalysis)    lines.push(`Analyse des procédés : ${ratingLabel(com.processAnalysis)}`);
  if (com.interpretation)     lines.push(`Interprétation : ${ratingLabel(com.interpretation)}`);
  if (com.organization)       lines.push(`Organisation : ${ratingLabel(com.organization)}`);
  if (com.paragraphs)         lines.push(`Construction des paragraphes : ${ratingLabel(com.paragraphs)}`);
  if (com.transitions)        lines.push(`Transitions : ${ratingLabel(com.transitions)}`);
  if (com.noParaphrase)       lines.push(`Distance avec la paraphrase : ${ratingLabel(com.noParaphrase)}`);
  if (com.strengths?.trim())  lines.push(`Points forts observés : ${com.strengths.trim()}`);
  if (com.difficulties?.trim()) lines.push(`Difficultés : ${com.difficulties.trim()}`);
  if (com.priority?.trim())   lines.push(`Priorité identifiée : ${com.priority.trim()}`);
  lines.push('');

  // Section 4
  lines.push('=== DISSERTATION ===');
  if (disNotConcerned) {
    lines.push('Cet exercice ne faisait pas partie du programme de travail de ce stage pour cet(te) élève.');
  } else if (disHasRatings) {
    if (dis.subjectUnderstanding)  lines.push(`Compréhension du sujet : ${ratingLabel(dis.subjectUnderstanding)}`);
    if (dis.keywordsAnalysis)      lines.push(`Analyse des mots-clés : ${ratingLabel(dis.keywordsAnalysis)}`);
    if (dis.problematique)         lines.push(`Formulation de la problématique : ${ratingLabel(dis.problematique)}`);
    if (dis.progressivePlan)       lines.push(`Plan progressif : ${ratingLabel(dis.progressivePlan)}`);
    if (dis.arguments)             lines.push(`Construction des arguments : ${ratingLabel(dis.arguments)}`);
    if (dis.workMobilization)      lines.push(`Mobilisation des œuvres : ${ratingLabel(dis.workMobilization)}`);
    if (dis.examplesUse)           lines.push(`Utilisation des exemples : ${ratingLabel(dis.examplesUse)}`);
    if (dis.answersSubject)        lines.push(`Réponse au sujet : ${ratingLabel(dis.answersSubject)}`);
    if (dis.introduction)          lines.push(`Introduction : ${ratingLabel(dis.introduction)}`);
    if (dis.conclusion)            lines.push(`Conclusion : ${ratingLabel(dis.conclusion)}`);
    if (dis.strengths?.trim())     lines.push(`Points forts : ${dis.strengths.trim()}`);
    if (dis.difficulties?.trim())  lines.push(`Difficultés : ${dis.difficulties.trim()}`);
    if (dis.priority?.trim())      lines.push(`Priorité : ${dis.priority.trim()}`);
  } else {
    lines.push('Non évaluée.');
  }
  lines.push('');

  // Section 5
  lines.push('=== EXPRESSION ÉCRITE ===');
  if (wr.sentenceClarity)    lines.push(`Clarté des phrases : ${ratingLabel(wr.sentenceClarity)}`);
  if (wr.grammar)            lines.push(`Correction grammaticale : ${ratingLabel(wr.grammar)}`);
  if (wr.spelling)           lines.push(`Orthographe : ${ratingLabel(wr.spelling)}`);
  if (wr.lexicalPrecision)   lines.push(`Précision lexicale : ${ratingLabel(wr.lexicalPrecision)}`);
  if (wr.literaryVocabulary) lines.push(`Vocabulaire littéraire : ${ratingLabel(wr.literaryVocabulary)}`);
  if (wr.fluency)            lines.push(`Fluidité : ${ratingLabel(wr.fluency)}`);
  if (wr.paragraphStructure) lines.push(`Structure des paragraphes : ${ratingLabel(wr.paragraphStructure)}`);
  if (wr.ideaExplanation)    lines.push(`Développement des idées : ${ratingLabel(wr.ideaExplanation)}`);
  if (wr.timedWriting)       lines.push(`Écriture en temps limité : ${ratingLabel(wr.timedWriting)}`);
  if (wr.observations?.trim())    lines.push(`Observations : ${wr.observations.trim()}`);
  if (wr.frequentErrors?.trim())  lines.push(`Erreurs fréquentes : ${wr.frequentErrors.trim()}`);
  if (wr.recommendations?.trim()) lines.push(`Recommandations : ${wr.recommendations.trim()}`);
  lines.push('');

  // Section 6 — Autonomy
  lines.push('=== AUTONOMIE ET MÉTHODE ===');
  if (am.autonomy)               lines.push(`Autonomie : ${ratingLabel(am.autonomy)}`);
  if (am.methodApplication)      lines.push(`Application de la méthode : ${ratingLabel(am.methodApplication)}`);
  if (am.errorCorrection)        lines.push(`Correction des erreurs : ${ratingLabel(am.errorCorrection)}`);
  if (am.correctionReuse)        lines.push(`Réutilisation des corrections : ${ratingLabel(am.correctionReuse)}`);
  if (am.timeManagement)         lines.push(`Gestion du temps : ${ratingLabel(am.timeManagement)}`);
  if (am.personalWorkRegularity) lines.push(`Régularité du travail personnel : ${ratingLabel(am.personalWorkRegularity)}`);
  if (am.revisionOrganization)   lines.push(`Organisation des révisions : ${ratingLabel(am.revisionOrganization)}`);
  if (am.observedMethod?.trim()) lines.push(`Méthode observée : ${am.observedMethod.trim()}`);
  if (am.advice?.trim())         lines.push(`Conseils du coach (à reformuler si besoin) : ${am.advice.trim()}`);
  lines.push('');

  // Section 7 — Progress
  lines.push('=== PROGRESSION ===');
  if (pr.globalProgress)         lines.push(`Progression globale : ${PROGRESS_FR[pr.globalProgress] ?? pr.globalProgress}`);
  if (pr.mostImprovedSkill)      lines.push(`Compétence la plus améliorée : ${SKILL_FR[pr.mostImprovedSkill] ?? pr.mostImprovedSkill}`);
  if (pr.prioritySkill)          lines.push(`Compétence prioritaire : ${SKILL_FR[pr.prioritySkill] ?? pr.prioritySkill}`);
  if (pr.observedProgressComment?.trim()) lines.push(`Commentaire de progression : ${pr.observedProgressComment.trim()}`);
  lines.push('');

  // Section 8 — Recommendations
  lines.push('=== RECOMMANDATIONS PARENTALES ===');
  if (pra.estimatedCurrentLevel)  lines.push(`Niveau estimé : ${LEVEL_FR[pra.estimatedCurrentLevel] ?? pra.estimatedCurrentLevel}`);
  if (pra.recommendedFollowUp)    lines.push(`Suivi recommandé : ${FOLLOW_UP_FR[pra.recommendedFollowUp] ?? pra.recommendedFollowUp}`);
  if (pra.priorityAxes?.length)   lines.push(`Axes prioritaires : ${pra.priorityAxes.map(a => AXIS_FR[a] ?? a).join(', ')}`);
  if (pra.parentSummaryMessage?.trim())  lines.push(`Message de synthèse du coach : ${pra.parentSummaryMessage.trim()}`);
  if (pra.finalRecommendation?.trim())   lines.push(`Recommandation finale du coach : ${pra.finalRecommendation.trim()}`);

  if (ragContext) {
    lines.push('');
    lines.push(ragContext);
  }

  return lines.join('\n');
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate a professional Markdown parent bilan via Ollama + RAG.
 * Falls back to the deterministic template if the LLM is unavailable.
 */
export async function generateLLMParentEafReport(
  sourceData: Partial<CoachEafSourceData>,
  student: EafStudentInfo,
  reportDate?: Date,
): Promise<EafLLMResult> {
  const date = reportDate ?? new Date();

  try {
    // 1. Parallel RAG searches
    const queries  = buildRAGQueries(sourceData);
    const rawHits  = await Promise.all(
      queries.map(q =>
        ragSearch({ query: q, collection: RAG_COLLECTION, k: 3 }).catch(() => [])
      )
    );
    const allHits    = rawHits.flat();
    const uniqueHits = allHits
      .filter((h, i) => allHits.findIndex(x => x.id === h.id) === i)
      .slice(0, 6);
    const ragContext = buildRAGContext(uniqueHits);

    // 2. Build prompt
    const userPrompt = buildUserPrompt(sourceData, student, ragContext, date);

    // 3. LLM call
    const raw = await ollamaChat({
      model: process.env.OLLAMA_MODEL || 'qwen2.5:32b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.4,
      numPredict:  3072,
      timeout:     180_000, // 3 min — large model on long report
    });

    const markdown = raw?.trim() ?? '';
    if (markdown.length < 300) {
      throw new Error(`LLM response too short (${markdown.length} chars)`);
    }

    return { markdown, llmUsed: true, ragHitCount: uniqueHits.length };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    const markdown = generateParentEafStageReport(sourceData, student, date);
    return { markdown, llmUsed: false, ragHitCount: 0 };
  }
}
