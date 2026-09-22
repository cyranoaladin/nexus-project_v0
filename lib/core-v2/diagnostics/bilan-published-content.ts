/**
 * The candidate-facing content, built ONCE from three separate inputs that
 * never merge into one blob until this exact step (mission §3):
 * deterministic results (fixed), the AI proposal (a proposal, not an
 * authority), and the human reviewer's per-item corrections (which — when
 * present for an item — REPLACE that item's AI constat outright, never
 * appended alongside it). The candidate reads only the output of this
 * function; the raw `humanReview` note and the raw, uncorrected
 * `aiProposal` are never serialized to the candidate's own read path.
 */
import type { DeterministicCorrectionResult } from './deterministic-correction';
import type { BilanAiProposal } from './bilan-ai-schema';
import type { HumanBilanReviewInput } from '../services/diagnostic-bilan';

export interface PublishedBilanItem {
  readonly itemId: string;
  readonly constat: string;
  readonly preuve: string | null;
  readonly incertitude: boolean;
  readonly source: 'AI' | 'HUMAN_CORRECTED';
}

export interface PublishedBilanContent {
  readonly deterministicResults: readonly DeterministicCorrectionResult[];
  readonly items: readonly PublishedBilanItem[];
  readonly pointsAppui: readonly string[];
  readonly difficultesObservees: readonly string[];
  readonly prioritesTravail: readonly string[];
  readonly propositionsRemediation: readonly string[];
}

export function buildPublishedBilanContent(input: {
  readonly deterministicResults: readonly DeterministicCorrectionResult[];
  readonly aiProposal: BilanAiProposal | null;
  readonly humanReview: HumanBilanReviewInput | null;
}): PublishedBilanContent {
  const corrections = new Map((input.humanReview?.itemCorrections ?? []).map((c) => [c.itemId, c.correctedConstat] as const));

  const items: PublishedBilanItem[] = (input.aiProposal?.items ?? []).map((item) => {
    const corrected = corrections.get(item.itemId);
    return corrected !== undefined
      ? { itemId: item.itemId, constat: corrected, preuve: null, incertitude: item.incertitude, source: 'HUMAN_CORRECTED' as const }
      : { itemId: item.itemId, constat: item.constat, preuve: item.preuve, incertitude: item.incertitude, source: 'AI' as const };
  });

  return {
    deterministicResults: input.deterministicResults,
    items,
    pointsAppui: input.aiProposal?.pointsAppui ?? [],
    difficultesObservees: input.aiProposal?.difficultesObservees ?? [],
    prioritesTravail: input.aiProposal?.prioritesTravail ?? [],
    propositionsRemediation: input.aiProposal?.propositionsRemediation ?? [],
  };
}
