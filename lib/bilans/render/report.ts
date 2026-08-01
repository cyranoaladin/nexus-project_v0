import type { FactSheet } from '../facts/fact-sheet';
import { sha256Canonical } from '../local-first/hash';
import type { AgentBundle } from '../validators';

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
    narrative: AgentBundle['eleve'] | AgentBundle['parents'] | AgentBundle['nexus'];
    domains: readonly QualitativeDomain[];
    internalFacts?: Readonly<{
      globalScore: number;
      coverage: number;
      calibrationIndex: number | null;
      domainScores: readonly Readonly<{ id: string; score: number }>[];
    }>;
  }>;
}>;

export function buildDeterministicReport(
  factSheet: FactSheet,
  bundle: AgentBundle,
  audience: BilanReportAudience,
): DeterministicBilanReport {
  const domains = Object.freeze(factSheet.domains.map(({ id, profile }) => Object.freeze({ id, profile })));
  const narrative = audience === 'ELEVE'
    ? bundle.eleve
    : audience === 'PARENTS'
      ? bundle.parents
      : bundle.nexus;
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
