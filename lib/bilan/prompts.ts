/**
 * F50: Canonical Bilan Prompts
 * Centralized prompt templates for tri-destinataire generation
 * Audience: student (bienveillant/tutoiement), parents (professionnel/vouvoiement), nexus (technique/factuel)
 */

import type { BilanGenerationContext } from './generator';

/**
 * Build prompt for a specific audience
 */
export function buildPromptForAudience(
  audience: 'student' | 'parents' | 'nexus',
  context: BilanGenerationContext,
  ragContext: string
): string {
  switch (audience) {
    case 'student':
      return buildStudentPrompt(context, ragContext);
    case 'parents':
      return buildParentsPrompt(context, ragContext);
    case 'nexus':
      return buildNexusPrompt(context, ragContext);
    default:
      throw new Error(`Unknown audience: ${audience}`);
  }
}

/**
 * Student prompt — Bienveillant, tutoiement, encourageant
 */
function buildStudentPrompt(context: BilanGenerationContext, ragContext: string): string {
  const { studentName, subject, globalScore = 0, domainScores = [], sourceData } = context;
  const shortName = studentName.split(' ')[0];

  // Extract relevant data from sourceData based on type
  const competences = extractCompetences(sourceData);
  const forces = extractForces(sourceData);
  const axes = extractAxes(sourceData);

  return `Rédige un bilan personnalisé pour ${shortName} en ${subject}.

**TON**: Bienveillant, encourageant, tutoie l'élève. Ne sois pas paternaliste.

**SCORE GLOBAL**: ${globalScore}/100

**DOMAINES ÉVALUÉS**:
${domainScores.map(d => `- ${d.domain}: ${d.score}/100`).join('\n')}

**COMPÉTENCES DÉTECTÉES**:
${competences.join('\n')}

**POINTS FORTS**:
${forces.join('\n')}

**AXES DE PROGRESSION**:
${axes.join('\n')}

${ragContext ? `**CONTEXTE PÉDAGOGIQUE**:\n${ragContext}\n` : ''}

**STRUCTURE ATTENDUE**:
1. Accroche personnalisée avec le prénom
2. Bilan des forces (ce qui fonctionne bien)
3. 2-3 points concrets à améliorer
4. Plan d'action réaliste pour la semaine
5. Message de confiance

**CONTRAINTES**:
- Maximum 400 mots
- Pas de jargon technique inutile
- Phrases courtes et dynamiques
- Un seul emoji pertinent maximum`;
}

/**
 * Parents prompt — Professionnel, vouvoiement, factuel
 */
function buildParentsPrompt(context: BilanGenerationContext, ragContext: string): string {
  const { studentName, subject, globalScore = 0, confidenceIndex, domainScores = [], sourceData } = context;

  const competences = extractCompetences(sourceData);
  const forces = extractForces(sourceData);
  const axes = extractAxes(sourceData);

  return `Rédige un bilan scolaire pour les parents de ${studentName} en ${subject}.

**TON**: Professionnel, factuel, bienveillant. Vouvoyez les parents.

**PERFORMANCES**:
- Score global: ${globalScore}/100
- Indice de confiance: ${confidenceIndex || 'N/A'}/100

**RÉSULTATS PAR DOMAINE**:
${domainScores.map(d => `- ${d.domain}: ${d.score}/100`).join('\n')}

**COMPÉTENCES ACQUISES**:
${competences.join('\n')}

**POINTS FORTS**:
${forces.join('\n')}

**POINTS D'ATTENTION**:
${axes.join('\n')}

${ragContext ? `**CONTEXTE PÉDAGOGIQUE**:\n${ragContext}\n` : ''}

**STRUCTURE ATTENDUE**:
1. Résumé synthétique des résultats
2. Analyse détaillée par domaine
3. Recommandations concrètes pour accompagner
4. Proposition de suivi si pertinent

**CONTRAINTES**:
- Maximum 500 mots
- Ton rassurant mais honnête
- Évitez les jugements de valeur
- Proposez des actions concrètes`;
}

/**
 * Nexus prompt — Technique, structuré, pour l'équipe pédagogique
 */
function buildNexusPrompt(context: BilanGenerationContext, ragContext: string): string {
  const { studentName, subject, globalScore = 0, confidenceIndex, ssn, uai, domainScores = [], sourceData, type } = context;

  const competences = extractCompetences(sourceData);
  const forces = extractForces(sourceData);
  const axes = extractAxes(sourceData);
  const metadonnees = extractMetadonnees(sourceData);

  return `Bilan technique pour l'équipe Nexus — ${type} ${subject}

**IDENTIFICATION**:
- Élève: ${studentName}
- Type: ${type}
- Matière: ${subject}

**SCORES NORMALISÉS**:
- Global: ${globalScore}/100
- Confiance: ${confidenceIndex || 'N/A'}/100
- SSN: ${ssn || 'N/A'}/100
- UAI: ${uai || 'N/A'}/100

**SCORES PAR DOMAINE**:
${domainScores.map(d => `- ${d.domain}: ${d.score}/100`).join('\n')}

**COMPÉTENCES ÉVALUÉES**:
${competences.join('\n')}

**FORCES**:
${forces.join('\n')}

**FAIBLESSES**:
${axes.join('\n')}

**MÉTADONNÉES SOURCE**:
${metadonnees.map(m => `- ${m}`).join('\n')}

${ragContext ? `**RAG CONTEXT**:\n${ragContext}\n` : ''}

**STRUCTURE ATTENDUE**:
1. Synthèse technique (2-3 lignes)
2. Analyse par domaine avec recommandations pédagogiques
3. Stratégie de remédiation personnalisée
4. Ressources recommandées
5. Flags qualité / points de vigilance

**CONTRAINTES**:
- Maximum 600 mots
- Langage technique accepté
- Structurez avec des listes à puces
- Incluez les scores bruts pour traçabilité`;
}

/**
 * Extract competences from sourceData based on type
 */
function extractCompetences(sourceData: unknown): string[] {
  if (!sourceData || typeof sourceData !== 'object') return [];
  const data = sourceData as Record<string, unknown>;

  // For Diagnostic type
  if (data.competencies && typeof data.competencies === 'object') {
    const comps = data.competencies as Record<string, unknown>;
    return Object.entries(comps)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${JSON.stringify(v).slice(0, 50)}`);
  }

  // For Assessment type
  if (data.answers && typeof data.answers === 'object') {
    return ['QCM évalué', 'Réponses analysées'];
  }

  return [];
}

/**
 * Extract forces from sourceData
 */
function extractForces(sourceData: unknown): string[] {
  if (!sourceData || typeof sourceData !== 'object') return [];
  const data = sourceData as Record<string, unknown>;

  // For Diagnostic with scoring
  if (data.scoring && typeof data.scoring === 'object') {
    const scoring = data.scoring as Record<string, unknown>;
    if (scoring.strengths && Array.isArray(scoring.strengths)) {
      return scoring.strengths as string[];
    }
  }

  // For Assessment with analysis
  if (data.analysis && typeof data.analysis === 'object') {
    const analysis = data.analysis as Record<string, unknown>;
    if (analysis.forces && Array.isArray(analysis.forces)) {
      return analysis.forces as string[];
    }
  }

  return ['Motivation', 'Participation active'];
}

/**
 * Extract axes for growth from sourceData
 */
function extractAxes(sourceData: unknown): string[] {
  if (!sourceData || typeof sourceData !== 'object') return [];
  const data = sourceData as Record<string, unknown>;

  // For Diagnostic with scoring
  if (data.scoring && typeof data.scoring === 'object') {
    const scoring = data.scoring as Record<string, unknown>;
    if (scoring.gaps && Array.isArray(scoring.gaps)) {
      return scoring.gaps as string[];
    }
    if (scoring.weaknesses && Array.isArray(scoring.weaknesses)) {
      return scoring.weaknesses as string[];
    }
  }

  // For Assessment with analysis
  if (data.analysis && typeof data.analysis === 'object') {
    const analysis = data.analysis as Record<string, unknown>;
    if (analysis.faiblesses && Array.isArray(analysis.faiblesses)) {
      return analysis.faiblesses as string[];
    }
  }

  return ['Méthodologie', 'Automatismes'];
}

/**
 * Extract metadata from sourceData
 */
function extractMetadonnees(sourceData: unknown): string[] {
  if (!sourceData || typeof sourceData !== 'object') return [];
  const data = sourceData as Record<string, unknown>;

  const metas: string[] = [];

  if (data.version) metas.push(`Version: ${data.version}`);
  if (data.submittedAt) metas.push(`Soumis: ${data.submittedAt}`);
  if (data.duration) metas.push(`Durée: ${data.duration}`);
  if (data.questionBankId) metas.push(`Bank: ${data.questionBankId}`);

  return metas;
}
