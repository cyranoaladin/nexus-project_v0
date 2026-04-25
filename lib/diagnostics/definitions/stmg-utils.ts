import type { ChapterDefinition, DiagnosticDefinition } from '../types';

type CompiledDomain = {
  domainId: string;
  domainLabel: string;
  weight: number;
  skills: Array<{
    skillId: string;
    skillLabel: string;
    chapterId?: string;
    prerequisite?: boolean;
    prerequisiteLevel?: 'core' | 'recommended';
  }>;
};

type CompiledPayload = {
  label: string;
  schemaVersion: string;
  domains: CompiledDomain[];
  chapters?: ChapterDefinition[];
};

function buildSkills(compiled: CompiledPayload): DiagnosticDefinition['skills'] {
  const skills: DiagnosticDefinition['skills'] = {};
  for (const domain of compiled.domains) {
    skills[domain.domainId] = domain.skills.map((skill) => ({
      skillId: skill.skillId,
      label: skill.skillLabel,
      domain: domain.domainId,
      chapterId: skill.chapterId,
      prerequisite: skill.prerequisite,
      prerequisiteLevel: skill.prerequisiteLevel,
    }));
  }
  return skills;
}

function buildWeights(compiled: CompiledPayload): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const domain of compiled.domains) {
    weights[domain.domainId] = domain.weight;
  }
  return weights;
}

export function buildStmgDefinition(
  key: string,
  track: DiagnosticDefinition['track'],
  compiled: CompiledPayload,
  options: {
    promptSubject: string;
    ragCollections: string[];
    riskFactors: string[];
    examStructure: string;
  }
): DiagnosticDefinition {
  return {
    key,
    version: compiled.schemaVersion,
    label: compiled.label,
    track,
    level: 'premiere',
    stage: 'pallier2',
    skills: buildSkills(compiled),
    chapters: compiled.chapters ?? [],
    scoringPolicy: {
      domainWeights: buildWeights(compiled),
      thresholds: {
        confirmed: { readiness: 58, risk: 58 },
        conditional: { readiness: 45, risk: 72 },
      },
    },
    prompts: {
      version: 'v1.0',
      eleve: `Tu es un coach Nexus Réussite spécialiste ${options.promptSubject} en Première STMG.

Génère un bilan Markdown pour l'élève. Respecte strictement le parcours STMG, sans mélanger avec les spécialités EDS.
Appuie chaque priorité sur les compétences évaluées et cite les sources RAG si elles sont fournies.
Structure : résumé, forces, priorités, plan 2 semaines, méthode de travail.`,
      parents: `Tu es un expert pédagogique Nexus Réussite spécialiste ${options.promptSubject} en Première STMG.

Génère un rapport Markdown pour les parents. Explique le niveau, les risques et le plan d'accompagnement sans jargon inutile.
Ne mélange jamais le parcours STMG avec le programme EDS. Cite les sources RAG si elles sont disponibles.`,
      nexus: `Tu es un expert pédagogique technique Nexus Réussite spécialiste ${options.promptSubject} en Première STMG.

Génère une fiche interne Markdown : data quality, forces/faiblesses, priorités, plan de séances, alertes.
Cite les chunk IDs RAG si disponibles et distingue explicitement les compétences non vues des compétences fragiles.`,
    },
    ragPolicy: {
      collections: options.ragCollections,
      maxQueries: 4,
      topK: 3,
    },
    riskModel: {
      factors: options.riskFactors,
    },
    examFormat: {
      duration: 120,
      calculatorAllowed: true,
      structure: options.examStructure,
      totalPoints: 20,
    },
  };
}
