import { createHash } from 'node:crypto';

import type { FactSheet } from '../facts/fact-sheet';
import type { NodeProfile } from '../facts/types';
import { buildLearningPath, type LearningPath } from './learning-path';
import {
  PROFILE_FAMILY_LABELS,
  buildProfiledNarrative,
  renderProfileNarrativeEntry,
  type ReportAudience,
} from './profile-copy';
import { assertPseudonymousRenderIdentity, type RenderIdentity } from './render-identity';

export const BILAN_REPORT_TEMPLATE_VERSION = 'nexus-bilan-profile-v2' as const;

export const PARENT_GROUP_CONSTRUCTION_COPY = "Les repères observés seront croisés avec ceux du groupe constitué afin de régler l'ordre, le temps et la profondeur du travail pendant cinq séances de deux heures. Aucun module n'est fixé avant cette lecture collective.";

type PublicLearningPathStep = Omit<LearningPath['steps'][number], 'profil'> & Readonly<{
  profileLabel: string;
}>;

type NexusLearningPathStep = LearningPath['steps'][number] & Readonly<{ score: number }>;

export type RenderedLearningPath = Readonly<{
  version: LearningPath['version'];
  steps: readonly (PublicLearningPathStep | NexusLearningPathStep)[];
}>;

export type DeterministicBilanReport = Readonly<{
  status: 'REPORT_PENDING_REVIEW';
  audience: ReportAudience;
  templateVersion: typeof BILAN_REPORT_TEMPLATE_VERSION;
  identity: RenderIdentity;
  contextChecksum: string;
  content: Readonly<{
    narrative: Readonly<{
      headline: string;
      introduction: string;
      strengths: readonly string[];
      priorities: readonly string[];
      actionPlan: readonly string[];
      conclusion: string;
    }>;
    domains: readonly Readonly<{
      id: string;
      profileLabel: string;
      profile?: NodeProfile;
      score?: number;
      narrative: string;
    }>[];
    learningPath: RenderedLearningPath;
    internalFacts?: Readonly<{
      globalScore: number;
      coverage: number;
      calibrationIndex: number | null;
      domainScores: readonly Readonly<{ id: string; score: number }>[];
    }>;
  }>;
}>;

export type DeterministicBilanReportBundle = Readonly<Record<ReportAudience, DeterministicBilanReport>>;

function renderLearningPath(
  learningPath: LearningPath,
  factSheet: FactSheet,
  audience: ReportAudience,
): RenderedLearningPath {
  const scores = new Map(factSheet.domains.map(({ id, score }) => [id, score]));
  const steps = learningPath.steps.map((step) => {
    if (audience === 'NEXUS') {
      return Object.freeze({ ...step, score: scores.get(step.domainId) ?? 0 });
    }
    const { profil, ...publicStep } = step;
    return Object.freeze({ ...publicStep, profileLabel: PROFILE_FAMILY_LABELS[profil] });
  });
  return Object.freeze({ version: learningPath.version, steps: Object.freeze(steps) });
}

function audienceFrame(audience: ReportAudience): Readonly<{
  headline: string;
  introduction: string;
  conclusion: string;
}> {
  if (audience === 'ELEVE') {
    return Object.freeze({
      headline: 'Ton parcours de progression',
      introduction: 'Ce bilan distingue tes points solides et les étapes à travailler dans un ordre utile.',
      conclusion: 'Chaque étape franchie rendra la suivante plus accessible.',
    });
  }
  if (audience === 'PARENTS') {
    return Object.freeze({
      headline: 'Le parcours de progression de votre enfant',
      introduction: 'Le bilan distingue les acquis solides et organise les priorités pédagogiques du stage.',
      conclusion: 'Ce parcours guidera le travail du stage et permettra d’en suivre les progrès.',
    });
  }
  return Object.freeze({
    headline: 'Synthèse pédagogique Nexus',
    introduction: 'Lecture technique des profils, priorités et phases didactiques.',
    conclusion: 'La revue humaine reste obligatoire avant publication.',
  });
}

export function buildDeterministicReport(
  factSheet: FactSheet,
  audience: ReportAudience,
  suppliedIdentity: RenderIdentity,
): DeterministicBilanReport {
  const identity = assertPseudonymousRenderIdentity(suppliedIdentity);
  const narrative = buildProfiledNarrative(factSheet, identity, audience);
  const learningPath = buildLearningPath(factSheet, identity);
  const frame = audienceFrame(audience);
  const domains = factSheet.domains.map((domain) => {
    const entry = renderProfileNarrativeEntry(domain, audience);
    return Object.freeze({
      id: domain.id,
      profileLabel: entry.profileLabel,
      ...('profile' in entry ? { profile: entry.profile, score: entry.score } : {}),
      narrative: entry.text,
    });
  });

  const renderedPath = audience === 'PARENTS'
    ? Object.freeze({ version: learningPath.version, steps: Object.freeze([]) })
    : renderLearningPath(learningPath, factSheet, audience);
  const narrativeContent = Object.freeze({
    ...frame,
    strengths: Object.freeze(narrative.forces.map(({ text }) => text)),
    priorities: Object.freeze(narrative.priorities.map(({ text }) => text)),
    actionPlan: Object.freeze(audience === 'PARENTS'
      ? [PARENT_GROUP_CONSTRUCTION_COPY]
      : renderedPath.steps.map(({ seanceLabel, objectif, demarche }) => `${seanceLabel} — ${objectif} ${demarche}`)),
  });
  const base = {
    status: 'REPORT_PENDING_REVIEW' as const,
    audience,
    templateVersion: BILAN_REPORT_TEMPLATE_VERSION,
    identity,
  };
  const contextChecksum = createHash('sha256')
    .update(JSON.stringify({ factSheet, identity, audience, templateVersion: BILAN_REPORT_TEMPLATE_VERSION }))
    .digest('hex');

  if (audience !== 'NEXUS') {
    return Object.freeze({
      ...base,
      contextChecksum,
      content: Object.freeze({
        narrative: narrativeContent,
        domains: Object.freeze(domains),
        learningPath: renderedPath,
      }),
    });
  }
  return Object.freeze({
    ...base,
    contextChecksum,
    content: Object.freeze({
      narrative: narrativeContent,
      domains: Object.freeze(domains),
      learningPath: renderedPath,
      internalFacts: Object.freeze({
        globalScore: factSheet.globalScore,
        coverage: factSheet.coverage,
        calibrationIndex: factSheet.calibrationIndex,
        domainScores: Object.freeze(factSheet.domains.map(({ id, score }) => Object.freeze({ id, score }))),
      }),
    }),
  });
}

export function buildDeterministicReports(
  factSheet: FactSheet,
  identity: RenderIdentity,
): DeterministicBilanReportBundle {
  return Object.freeze({
    ELEVE: buildDeterministicReport(factSheet, 'ELEVE', identity),
    PARENTS: buildDeterministicReport(factSheet, 'PARENTS', identity),
    NEXUS: buildDeterministicReport(factSheet, 'NEXUS', identity),
  });
}
