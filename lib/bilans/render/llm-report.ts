import type { FactSheet } from '../facts/fact-sheet';
import type { AgentBundle } from '../validators';
import { assertPseudonymousRenderIdentity, type RenderIdentity } from './render-identity';
import {
  buildDeterministicReport,
  type DeterministicBilanReport,
  type DeterministicBilanReportBundle,
} from './report';
import type { ReportAudience } from './profile-copy';

/**
 * Builds the same DeterministicBilanReportBundle shape the app already
 * renders and serves, but with narrative prose sourced from a validated
 * LLM AgentBundle instead of the templated profile-copy generator.
 *
 * Numbers never come from the bundle: domain scores/profiles, the learning
 * path and internalFacts are all recomputed straight from the FactSheet,
 * exactly as buildDeterministicReport does. The LLM narrates; it cannot
 * inject or alter a single score — there is no code path here that reads a
 * number out of `bundle`.
 */
export function buildLlmReport(
  factSheet: FactSheet,
  audience: ReportAudience,
  identity: RenderIdentity,
  bundle: AgentBundle,
): DeterministicBilanReport {
  const base = buildDeterministicReport(factSheet, audience, assertPseudonymousRenderIdentity(identity));

  if (audience === 'ELEVE') {
    return Object.freeze({
      ...base,
      content: Object.freeze({
        ...base.content,
        narrative: Object.freeze({
          headline: bundle.eleve.accroche,
          introduction: bundle.preAnalysis.synthese,
          strengths: Object.freeze([...bundle.eleve.forces]),
          priorities: Object.freeze(bundle.eleve.priorites.map((p) => `${p.titre} — ${p.pourquoi} ${p.comment}`)),
          actionPlan: Object.freeze(bundle.eleve.microPlan.map((step) => step.action)),
          conclusion: bundle.eleve.motDeFin,
        }),
      }),
    });
  }

  if (audience === 'PARENTS') {
    return Object.freeze({
      ...base,
      content: Object.freeze({
        ...base.content,
        narrative: Object.freeze({
          ...base.content.narrative,
          introduction: bundle.parents.cadre,
          strengths: Object.freeze(bundle.parents.pointsAppui.map((p) => p.texte)),
          priorities: Object.freeze(bundle.parents.priorites.map((p) => `${p.titre} — ${p.ceQuiSeraFait}`)),
        }),
      }),
    });
  }

  return Object.freeze({
    ...base,
    content: Object.freeze({
      ...base.content,
      narrative: Object.freeze({
        ...base.content.narrative,
        introduction: bundle.nexus.diagnosticPedagogique,
        actionPlan: Object.freeze([bundle.nexus.planQuatreSemaines]),
      }),
    }),
  });
}

export function buildLlmReports(
  factSheet: FactSheet,
  identity: RenderIdentity,
  bundle: AgentBundle,
): DeterministicBilanReportBundle {
  return Object.freeze({
    ELEVE: buildLlmReport(factSheet, 'ELEVE', identity, bundle),
    PARENTS: buildLlmReport(factSheet, 'PARENTS', identity, bundle),
    NEXUS: buildLlmReport(factSheet, 'NEXUS', identity, bundle),
  });
}
