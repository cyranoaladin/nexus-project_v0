import type { FactSheet } from '../facts/fact-sheet';
import { sha256Canonical } from '../local-first/hash';

export const BILAN_REPORT_TEMPLATE_VERSION = 'nexus-bilan-facts-v1';
export type BilanReportAudience = 'ELEVE' | 'PARENTS' | 'NEXUS';

type QualitativeDomain = Readonly<{
  id: string;
  profile: FactSheet['domains'][number]['profile'];
}>;

export type DeterministicBilanReport = Readonly<{
  status: 'REPORT_PENDING_REVIEW';
  audience: BilanReportAudience;
  templateVersion: typeof BILAN_REPORT_TEMPLATE_VERSION;
  contextChecksum: string;
  content: Readonly<{
    narrative: Readonly<Record<string, unknown>>;
    domains: readonly QualitativeDomain[];
    internalFacts?: Readonly<{
      globalScore: number;
      coverage: number;
      calibrationIndex: number | null;
      domainScores: readonly Readonly<{ id: string; score: number }>[];
    }>;
  }>;
}>;

export type DeterministicBilanReportBundle = Readonly<Record<
  BilanReportAudience,
  DeterministicBilanReport
>>;

function domainTitle(domainId: string): string {
  return domainId.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
}

function deterministicNarrative(
  factSheet: FactSheet,
  audience: BilanReportAudience,
): Readonly<Record<string, unknown>> {
  const domains = factSheet.domains.map(({ id }) => ({ id, title: domainTitle(id) }));
  if (audience === 'ELEVE') {
    return Object.freeze({
      accroche: 'Ton travail montre des appuis utiles pour progresser avec méthode.',
      forces: Object.freeze(['Une démarche engagée.', 'Des acquis mobilisables.', 'Une attention aux consignes.']),
      priorites: Object.freeze(domains.map(({ id, title }) => Object.freeze({
        domainId: id,
        titre: title,
        pourquoi: 'Stabiliser les démarches utiles.',
        comment: 'Reprendre les raisonnements puis varier les exercices.',
      }))),
      microPlan: Object.freeze([Object.freeze({
        action: 'Revoir une démarche puis expliquer son raisonnement.',
        dureeMin: 20,
      })]),
      motDeFin: 'Le travail peut avancer de façon progressive et structurée.',
    });
  }
  if (audience === 'PARENTS') {
    return Object.freeze({
      cadre: 'La passation fournit des repères utiles pour organiser la suite du travail.',
      pointsAppui: Object.freeze(domains.slice(0, 3).map(({ id, title }) => Object.freeze({
        domainId: id,
        texte: `${title} constitue un point d'appui à mobiliser.`,
      }))),
      priorites: Object.freeze(domains.slice(3).map(({ id, title }) => Object.freeze({
        domainId: id,
        titre: title,
        ceQuiSeraFait: 'Les démarches seront reprises avec des exercices progressifs.',
      }))),
      etapeSuivante: Object.freeze({
        texte: 'Un échange permettra de préciser le parcours pédagogique.',
        cta: 'Être conseillé',
      }),
    });
  }
  return Object.freeze({
    syntheseProfil: 'Profil synthétique fondé sur la FactSheet.',
    diagnosticPedagogique: 'Les priorités sont ordonnées par domaine et par profil observé.',
    planQuatreSemaines: 'Prévoir une reprise guidée, une verbalisation et un entraînement progressif.',
    alertes: Object.freeze([]),
    ragReferences: Object.freeze([]),
  });
}

export function buildDeterministicReport(
  factSheet: FactSheet,
  audience: BilanReportAudience,
): DeterministicBilanReport {
  const domains = Object.freeze(factSheet.domains.map(({ id, profile }) => Object.freeze({ id, profile })));
  const narrative = deterministicNarrative(factSheet, audience);
  const content = audience === 'NEXUS'
    ? Object.freeze({
      narrative,
      domains,
      internalFacts: Object.freeze({
        globalScore: factSheet.globalScore,
        coverage: factSheet.coverage,
        calibrationIndex: factSheet.calibrationIndex,
        domainScores: Object.freeze(factSheet.domains.map(({ id, score }) => Object.freeze({ id, score }))),
      }),
    })
    : Object.freeze({ narrative, domains });
  const identity = {
    audience,
    bankSlug: factSheet.bankSlug,
    bankVersion: factSheet.bankVersion,
    content,
    engineVersion: factSheet.engineVersion,
    templateVersion: BILAN_REPORT_TEMPLATE_VERSION,
  };
  return Object.freeze({
    status: 'REPORT_PENDING_REVIEW',
    audience,
    templateVersion: BILAN_REPORT_TEMPLATE_VERSION,
    contextChecksum: sha256Canonical(identity),
    content,
  });
}

export function buildDeterministicReports(factSheet: FactSheet): DeterministicBilanReportBundle {
  return Object.freeze({
    ELEVE: buildDeterministicReport(factSheet, 'ELEVE'),
    PARENTS: buildDeterministicReport(factSheet, 'PARENTS'),
    NEXUS: buildDeterministicReport(factSheet, 'NEXUS'),
  });
}
