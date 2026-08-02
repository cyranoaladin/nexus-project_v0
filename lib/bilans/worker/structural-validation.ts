import { z } from 'zod';

import type { FactSheet } from '../facts/fact-sheet';
import type { DeterministicBilanReportBundle } from '../render/report';

const profileSchema = z.enum([
  'NON_TRAITE',
  'ERREUR_CONFIANTE',
  'LACUNE_CONSCIENTE',
  'MAITRISE_FRAGILE',
  'MAITRISE',
]);
const domainSchema = z.object({ id: z.string().min(1), profile: profileSchema }).strict();
const narrativeSchema = z.record(z.unknown());
const publicContentSchema = z.object({
  narrative: narrativeSchema,
  domains: z.array(domainSchema).min(1),
}).strict();
const internalContentSchema = publicContentSchema.extend({
  internalFacts: z.object({
    globalScore: z.number().finite(),
    coverage: z.number().finite(),
    calibrationIndex: z.number().finite().nullable(),
    domainScores: z.array(z.object({ id: z.string().min(1), score: z.number().finite() }).strict()),
  }).strict(),
}).strict();

function reportSchema(audience: 'ELEVE' | 'PARENTS' | 'NEXUS') {
  return z.object({
    status: z.literal('REPORT_PENDING_REVIEW'),
    audience: z.literal(audience),
    templateVersion: z.literal('nexus-bilan-facts-v1'),
    contextChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    content: audience === 'NEXUS' ? internalContentSchema : publicContentSchema,
  }).strict();
}

function containsRawScore(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsRawScore);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => (
    ['globalScore', 'coverage', 'calibrationIndex', 'domainScores', 'score'].includes(key)
    || containsRawScore(child)
  ));
}

export function validateDeterministicReports(
  factSheet: FactSheet,
  reports: DeterministicBilanReportBundle,
): void {
  for (const audience of ['ELEVE', 'PARENTS', 'NEXUS'] as const) {
    const report = reportSchema(audience).parse(reports[audience]);
    const renderedDomains = report.content.domains.map(({ id }) => id);
    if (
      renderedDomains.length !== factSheet.domains.length
      || factSheet.domains.some(({ id }) => !renderedDomains.includes(id))
    ) throw new Error(`A86_REPORT_DOMAIN_MISSING:${audience}`);
    if (audience !== 'NEXUS' && containsRawScore(report.content)) {
      throw new Error(`A86_PUBLIC_RAW_SCORE:${audience}`);
    }
  }
}
