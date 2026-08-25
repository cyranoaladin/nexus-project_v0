/**
 * Shadow-mode comparison between the legacy SituationInput-based engine and
 * the new carte-aware pipeline (mission "recâblage" §2/§3/§7). Pure — never
 * touches the DB itself (the caller persists a ShadowComparisonLog row),
 * never throws (a comparison failure is itself a classified divergence,
 * never a request failure), never carries PII (only a checksum + a
 * structured, name/email/phone-free summary of each side).
 *
 * Purpose: build evidence for the recâblage decision, never a second
 * permanent output — this module has no public/family-facing consumer and
 * must never gain one (mission §3 "le mode shadow est transitoire").
 * Owner: candidat-individuel pipeline migration (this mission). Start:
 * 2026-08-26 (this commit). End condition: once ACTIVE_PUBLIC_PERCENTAGE
 * reaches 100% and the legacy engine is retired, this module and
 * ShadowComparisonLog are deleted in the same commit that removes the
 * legacy code path — never left as permanent parallel infrastructure.
 */
import 'server-only';
import { createHash } from 'crypto';
import type { SituationInput } from './schemas';
import { buildRecommendation, type BuildRecommendationInput } from './recommendation';
import { buildCandidateQuoteRecommendation, type CandidateQuotePipelineResult } from './pipeline';
import type { RecommendationResult } from './schemas';
import type { PublicCandidateInputRaw } from '@/lib/exams/normalize';

export type DivergenceCategory =
  | 'EXPECTED_REGULATORY_CORRECTION'
  | 'EXPECTED_CATALOGUE_CHANGE'
  | 'PRICING_DIFFERENCE'
  | 'COVERAGE_DIFFERENCE'
  | 'LEGACY_BUG'
  | 'NEW_ENGINE_BUG'
  | 'UNPRICED_MODULE'
  | 'INSUFFICIENT_INPUT'
  | 'IDENTICAL';

export interface ComparisonSideSummary {
  subjects: string[];
  priceAnnualTnd: number | null;
  depositTnd: number | null;
  installmentTnd: number | null;
  status: string;
  warningsCount: number;
}

export interface ShadowComparisonRecord {
  situationChecksum: string;
  divergenceCategory: DivergenceCategory;
  legacySummary: ComparisonSideSummary;
  newSummary: ComparisonSideSummary;
  detail: string;
}

/** Stable, PII-free — a hash of the situation shape only, never a name/email/phone. */
export function computeSituationChecksum(situation: SituationInput): string {
  const canonical = JSON.stringify({
    level: situation.level,
    examSession: situation.examSession,
    specialites: [...situation.specialites].sort(),
    specialiteAbandonnee: situation.specialiteAbandonnee ?? null,
    langueA: situation.langueA ?? null,
    langueB: situation.langueB ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Best-effort SituationInput -> PublicCandidateInputRaw. SituationInput has
 * no modalité concept at all — never inferred here (fail-closed): every
 * shadow comparison today necessarily hits the new pipeline's
 * "modalite ABSENT" case, correctly classified as INSUFFICIENT_INPUT
 * rather than silently guessed.
 */
export function situationToPublicInput(situation: SituationInput): PublicCandidateInputRaw {
  return {
    level: situation.level === 'premiere' ? 'PREMIERE' : 'TERMINALE',
    examSession: situation.examSession,
    modalite: null, // never inferred — see doc comment above.
    specialite1: situation.specialites[0],
    specialite2: situation.specialites[1],
    specialiteAbandonnee: situation.specialiteAbandonnee ?? null,
    langueA: situation.langueA ?? null,
    langueB: situation.langueB ?? null,
  };
}

function summarizeLegacy(recommendation: RecommendationResult): ComparisonSideSummary {
  const scenario = recommendation.scenarios.find((s) => s.tier === 'RECOMMANDE') ?? recommendation.scenarios[0];
  return {
    subjects: scenario?.lines.map((l) => l.subject) ?? [],
    priceAnnualTnd: scenario?.grandTotal ?? null,
    depositTnd: scenario?.deposit ?? null,
    installmentTnd: scenario?.monthlyTotal ?? null,
    status: 'LEGACY_SCENARIO',
    warningsCount: scenario?.notRecommended.length ?? 0,
  };
}

function summarizeNew(result: CandidateQuotePipelineResult): ComparisonSideSummary {
  if (result.status === 'READY') {
    const recommande = result.scenarios.find((s) => s.tier === 'RECOMMANDE') ?? result.scenarios[0];
    return {
      subjects: recommande.lines.map((l) => l.subject),
      priceAnnualTnd: recommande.grandTotal,
      depositTnd: recommande.deposit,
      installmentTnd: recommande.monthlyTotal,
      status: result.status,
      warningsCount: recommande.notRecommended.length,
    };
  }
  const warningsCount =
    result.status === 'HUMAN_REVIEW_REQUIRED'
      ? result.avertissements.length
      : result.status === 'DIRECTION_APPROVAL_REQUIRED'
        ? result.pendingModuleIds.length
        : result.status === 'INVALID'
          ? result.reasons.length
          : 0;
  return {
    subjects: [],
    priceAnnualTnd: null,
    depositTnd: null,
    installmentTnd: null,
    status: result.status,
    warningsCount,
  };
}

function classify(legacy: ComparisonSideSummary, fresh: ComparisonSideSummary, newResult: CandidateQuotePipelineResult): {
  category: DivergenceCategory;
  detail: string;
} {
  if (newResult.status === 'INVALID' && fresh.priceAnnualTnd == null) {
    return { category: 'INSUFFICIENT_INPUT', detail: 'Le nouveau pipeline nécessite des données (ex. modalité) absentes de SituationInput.' };
  }
  if (newResult.status === 'HUMAN_REVIEW_REQUIRED' || newResult.status === 'NOT_ELIGIBLE') {
    return { category: 'EXPECTED_REGULATORY_CORRECTION', detail: 'Le nouveau pipeline détecte un cas réglementaire (statut de carte, éligibilité) invisible pour le moteur historique.' };
  }
  if (newResult.status === 'DIRECTION_APPROVAL_REQUIRED') {
    return { category: 'UNPRICED_MODULE', detail: `${(newResult as { pendingModuleIds: string[] }).pendingModuleIds.join(', ')} nécessite(nt) un arbitrage direction.` };
  }
  if (newResult.status === 'UNPRICED') {
    return { category: 'NEW_ENGINE_BUG', detail: (newResult as { reason: string }).reason };
  }
  if (legacy.priceAnnualTnd != null && fresh.priceAnnualTnd != null) {
    if (legacy.priceAnnualTnd === fresh.priceAnnualTnd) {
      const sameCoverage = legacy.subjects.length === fresh.subjects.length;
      return sameCoverage
        ? { category: 'IDENTICAL', detail: 'Même prix, même nombre de lignes.' }
        : { category: 'COVERAGE_DIFFERENCE', detail: `Même prix mais couverture différente (${legacy.subjects.length} vs ${fresh.subjects.length} lignes).` };
    }
    return {
      category: 'PRICING_DIFFERENCE',
      detail: `Legacy ${legacy.priceAnnualTnd} TND vs nouveau ${fresh.priceAnnualTnd} TND.`,
    };
  }
  return { category: 'COVERAGE_DIFFERENCE', detail: 'Comparaison incomplète — un des deux moteurs ne produit pas de prix.' };
}

export function runShadowComparison(
  situation: SituationInput,
  legacyInput: BuildRecommendationInput,
): ShadowComparisonRecord {
  const situationChecksum = computeSituationChecksum(situation);
  try {
    const legacyRecommendation = buildRecommendation(legacyInput);
    const newResult = buildCandidateQuoteRecommendation({
      publicInput: situationToPublicInput(situation),
      budget: legacyInput.budget,
      diagnostic: legacyInput.diagnosticDomainScores
        ? { raw: legacyInput.diagnosticDomainScores, overconfidentDomainKeys: legacyInput.overconfidentDomainKeys }
        : null,
      monthsRemaining: legacyInput.monthsRemaining,
    });
    const legacySummary = summarizeLegacy(legacyRecommendation);
    const newSummary = summarizeNew(newResult);
    const { category, detail } = classify(legacySummary, newSummary, newResult);
    return { situationChecksum, divergenceCategory: category, legacySummary, newSummary, detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      situationChecksum,
      divergenceCategory: 'NEW_ENGINE_BUG',
      legacySummary: { subjects: [], priceAnnualTnd: null, depositTnd: null, installmentTnd: null, status: 'ERROR', warningsCount: 0 },
      newSummary: { subjects: [], priceAnnualTnd: null, depositTnd: null, installmentTnd: null, status: 'ERROR', warningsCount: 0 },
      detail: `Comparaison échouée sans impacter la réponse legacy : ${message}`,
    };
  }
}

// ── Rapport agrégé (mission §7) ──

export interface AggregateDivergenceReport {
  totalSimulations: number;
  identicalPct: number;
  pricingDifferences: number;
  coverageDifferences: number;
  unpricedModules: number;
  errors: number;
  needsReview: number;
  byCategory: Record<DivergenceCategory, number>;
}

export function buildAggregateDivergenceReport(records: ShadowComparisonRecord[]): AggregateDivergenceReport {
  const byCategory = {
    EXPECTED_REGULATORY_CORRECTION: 0,
    EXPECTED_CATALOGUE_CHANGE: 0,
    PRICING_DIFFERENCE: 0,
    COVERAGE_DIFFERENCE: 0,
    LEGACY_BUG: 0,
    NEW_ENGINE_BUG: 0,
    UNPRICED_MODULE: 0,
    INSUFFICIENT_INPUT: 0,
    IDENTICAL: 0,
  } as Record<DivergenceCategory, number>;
  for (const r of records) byCategory[r.divergenceCategory]++;

  const total = records.length;
  return {
    totalSimulations: total,
    identicalPct: total === 0 ? 0 : Math.round((byCategory.IDENTICAL / total) * 1000) / 10,
    pricingDifferences: byCategory.PRICING_DIFFERENCE,
    coverageDifferences: byCategory.COVERAGE_DIFFERENCE,
    unpricedModules: byCategory.UNPRICED_MODULE,
    errors: byCategory.NEW_ENGINE_BUG + byCategory.LEGACY_BUG,
    needsReview: byCategory.EXPECTED_REGULATORY_CORRECTION,
    byCategory,
  };
}
