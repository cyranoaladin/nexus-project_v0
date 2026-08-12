import { z } from 'zod';

import { BILAN_PACK_SUBJECTS } from '../catalog/subjects';
import type { FactSheet } from '../facts/fact-sheet';
import { BILAN_REPORT_TEMPLATE_VERSION, type DeterministicBilanReportBundle } from '../render/report';
import { PAPER_ENTRY_DURATION_MEASUREMENT } from '../render/passation-presentation';

const technicalProfileSchema = z.enum([
  'NON_TRAITE',
  'ERREUR_CONFIANTE',
  'LACUNE_CONSCIENTE',
  'MAITRISE_FRAGILE',
  'MAITRISE',
]);

const familyProfileSchema = z.enum([
  'solide',
  'fragile / à consolider',
  'à combler (déjà repéré)',
  'sûr mais à revoir',
  'non évalué',
]);

const identitySchema = z.object({
  displayName: z.string().trim().min(1),
  level: z.string().trim().min(1),
  subject: z.enum(BILAN_PACK_SUBJECTS),
  date: z.string().trim().min(1),
  stageLabel: z.string().trim().min(1),
  durationMeasurement: z.literal(PAPER_ENTRY_DURATION_MEASUREMENT).optional(),
}).strict();

const narrativeSchema = z.object({
  headline: z.string().trim().min(1),
  introduction: z.string().trim().min(1),
  methodNote: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)),
  priorities: z.array(z.string().trim().min(1)),
  actionPlan: z.array(z.string().trim().min(1)).min(1),
  calibration: z.string().trim().min(1),
  conclusion: z.string().trim().min(1),
}).strict();

const publicDomainSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  profileLabel: familyProfileSchema,
  gesture: z.string().trim().min(1),
  narrative: z.string().trim().min(1),
}).strict();

const nexusDomainSchema = publicDomainSchema.extend({
  profile: technicalProfileSchema,
  score: z.number().min(0).max(100),
}).strict();

const publicLearningStepSchema = z.object({
  domainId: z.string().trim().min(1),
  domainTitle: z.string().trim().min(1),
  phaseDidactique: z.enum(['Confronter', 'Installer', 'Consolider', 'Diagnostiquer']),
  objectif: z.string().trim().min(1),
  demarche: z.string().trim().min(1),
  seanceLabel: z.string().trim().min(1),
  profileLabel: familyProfileSchema,
}).strict();

const nexusLearningStepSchema = z.object({
  domainId: z.string().trim().min(1),
  domainTitle: z.string().trim().min(1),
  profil: z.enum(['ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE', 'MAITRISE_FRAGILE', 'NON_TRAITE']),
  phaseDidactique: z.enum(['Confronter', 'Installer', 'Consolider', 'Diagnostiquer']),
  objectif: z.string().trim().min(1),
  demarche: z.string().trim().min(1),
  seanceLabel: z.string().trim().min(1),
  score: z.number().min(0).max(100),
}).strict();

const internalFactsSchema = z.object({
  globalScore: z.number().min(0).max(100),
  coverage: z.number().min(0).max(100),
  calibrationIndex: z.number().min(0).max(100).nullable(),
  domainScores: z.array(z.object({
    id: z.string().trim().min(1),
    score: z.number().min(0).max(100),
  }).strict()),
}).strict();

function reportSchema(audience: 'ELEVE' | 'PARENTS' | 'NEXUS') {
  const isNexus = audience === 'NEXUS';
  const content = z.object({
    narrative: narrativeSchema,
    domains: z.array(isNexus ? nexusDomainSchema : publicDomainSchema),
    learningPath: z.object({
      version: z.literal('learning-path.v2'),
      steps: z.array(isNexus ? nexusLearningStepSchema : publicLearningStepSchema),
    }).strict(),
    ...(isNexus ? { internalFacts: internalFactsSchema } : {}),
  }).strict();

  return z.object({
    status: z.literal('REPORT_PENDING_REVIEW'),
    audience: z.literal(audience),
    templateVersion: z.literal(BILAN_REPORT_TEMPLATE_VERSION),
    identity: identitySchema,
    contextChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    content,
  }).strict();
}

function containsForbiddenPublicFact(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenPublicFact);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => (
    ['globalScore', 'coverage', 'calibrationIndex', 'domainScores', 'score', 'profile', 'profil'].includes(key)
    || containsForbiddenPublicFact(child)
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
      || renderedDomains.some((id, index) => id !== factSheet.domains[index]?.id)
    ) {
      throw new Error(`REPORT_DOMAIN_COVERAGE_MISMATCH:${audience}`);
    }
    if (audience !== 'NEXUS' && containsForbiddenPublicFact(report)) {
      throw new Error(`REPORT_PUBLIC_RAW_SCORE_FORBIDDEN:${audience}`);
    }
    // Une section « Forces » vide est un défaut de restitution pour une
    // famille : le moteur doit toujours fournir au moins un point d'appui.
    if (audience !== 'NEXUS' && report.content.narrative.strengths.length === 0) {
      throw new Error(`REPORT_PUBLIC_STRENGTHS_EMPTY:${audience}`);
    }
  }
}
