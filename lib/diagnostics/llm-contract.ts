/**
 * LLM Output Contract — Zod validation for structured LLM responses.
 *
 * After generation, the LLM output is validated against this contract
 * to ensure all required sections are present and well-formed.
 */

import { z } from 'zod';

/** Structured analysis JSON schema (for analysisJson field) */
export const structuredAnalysisSchema = z.object({
  forces: z.array(z.object({
    domain: z.string(),
    label: z.string(),
    detail: z.string(),
    evidence: z.string().optional(),
  })).min(1),
  faiblesses: z.array(z.object({
    domain: z.string(),
    label: z.string(),
    detail: z.string(),
    evidence: z.string().optional(),
  })).min(1),
  plan: z.array(z.object({
    week: z.number().min(1).max(4),
    objective: z.string(),
    actions: z.array(z.string()).min(1),
    indicator: z.string(),
  })).min(1),
  ressources: z.array(z.object({
    type: z.enum(['exercice', 'methode', 'fiche', 'sujet0', 'programme']),
    label: z.string(),
    source: z.string().optional(),
    ragChunkId: z.string().optional(),
  })),
  qualityFlags: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })),
  citations: z.array(z.object({
    index: z.number(),
    source: z.string(),
    chunkId: z.string().optional(),
    excerpt: z.string(),
  })),
});

export type StructuredAnalysisData = z.infer<typeof structuredAnalysisSchema>;

/**
 * Validate markdown output: check minimum length and required sections.
 */
export function validateMarkdownOutput(
  markdown: string,
  audience: 'eleve' | 'parents' | 'nexus'
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!markdown || markdown.trim().length < 100) {
    issues.push(`Markdown trop court (${markdown?.length ?? 0} chars, minimum 100)`);
  }

  // Check for required heading sections per audience
  const requiredSections: Record<string, string[]> = {
    eleve: ['priorité', 'plan', 'méthode'],
    parents: ['synthèse', 'risque', 'progrès'],
    nexus: ['score', 'domaine', 'alerte'],
  };

  const sections = requiredSections[audience] || [];
  const lowerMarkdown = (markdown || '').toLowerCase();

  for (const section of sections) {
    if (!lowerMarkdown.includes(section)) {
      issues.push(`Section manquante ou non détectée : "${section}" (audience: ${audience})`);
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Build quality flags from generation context.
 */
export function buildQualityFlags(context: {
  ragAvailable: boolean;
  ragHitCount: number;
  llmSuccessCount: number;
  dataQuality: string;
  coverageIndex: number;
}): Array<{ code: string; message: string }> {
  const flags: Array<{ code: string; message: string }> = [];

  if (!context.ragAvailable) {
    flags.push({ code: 'RAG_EMPTY', message: 'Aucun contexte pédagogique RAG disponible — bilan basé uniquement sur les données élève' });
  } else if (context.ragHitCount < 2) {
    flags.push({ code: 'RAG_LOW', message: `Peu de contexte RAG (${context.ragHitCount} résultats) — recommandations moins spécifiques` });
  }

  if (context.llmSuccessCount < 3) {
    flags.push({ code: 'LLM_PARTIAL', message: `${3 - context.llmSuccessCount} section(s) générée(s) par template de secours` });
  }

  if (context.dataQuality === 'insufficient') {
    flags.push({ code: 'LOW_DATA', message: 'Données insuffisantes — scoring et recommandations à confirmer en séance' });
  } else if (context.dataQuality === 'partial') {
    flags.push({ code: 'PARTIAL_DATA', message: 'Données partielles — certains domaines non évalués' });
  }

  if (context.coverageIndex < 50) {
    flags.push({ code: 'LOW_COVERAGE', message: `Couverture programme faible (${context.coverageIndex}%) — beaucoup de chapitres non abordés` });
  }

  return flags;
}
