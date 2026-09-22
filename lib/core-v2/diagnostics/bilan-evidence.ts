/**
 * Contextual evidence checks for the AI proposal (mission §4): the zod
 * schema in bilan-ai-schema.ts only controls field SHAPE — it says nothing
 * about whether an `itemId` actually exists in the subject, or whether a
 * `preuve` presented as a textual quote actually occurs in the extracted
 * copy. A schema-valid response with an unknown item or a fabricated quote
 * is still rejected here, before it is ever presented as a usable
 * proposal — the human reviewer keeps the final pedagogical decision, but
 * this stops an outright hallucinated citation from ever reaching them
 * labeled as evidence.
 */
import type { BilanAiProposal } from './bilan-ai-schema';

/** Casefold, strip accents, collapse whitespace, drop punctuation — a citation is compared loosely, never byte-for-byte. */
export function normalizeForCitationMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface EvidenceCoverage {
  readonly expectedItemIds: readonly string[];
  readonly coveredItemIds: readonly string[];
  readonly missingItemIds: readonly string[];
}

export type EvidenceValidationResult =
  | Readonly<{ ok: true; coverage: EvidenceCoverage }>
  | Readonly<{ ok: false; reason: string; details: Record<string, unknown> }>;

/**
 * Refuses outright (never silently drops the offending item and accepts
 * the rest) when: an itemId is not among the ones actually asked about, an
 * itemId is duplicated, or a `preuve` claimed as a textual quote does not
 * occur (after normalization) anywhere in the extracted copy while
 * `incertitude` is false. `incertitude: true` is the model's own admission
 * that no solid quote exists — that combination is accepted without a
 * match, since nothing false is being asserted.
 */
export function validateAiProposalAgainstSource(
  proposal: BilanAiProposal,
  input: { readonly allowedItemIds: readonly string[]; readonly extractedText: string },
): EvidenceValidationResult {
  const allowed = new Set(input.allowedItemIds);
  const normalizedSource = normalizeForCitationMatch(input.extractedText);

  const seen = new Set<string>();
  for (const item of proposal.items) {
    if (!allowed.has(item.itemId)) {
      return { ok: false, reason: 'UNKNOWN_ITEM_ID', details: { itemId: item.itemId, allowedItemIds: input.allowedItemIds } };
    }
    if (seen.has(item.itemId)) {
      return { ok: false, reason: 'DUPLICATE_ITEM_ID', details: { itemId: item.itemId } };
    }
    seen.add(item.itemId);

    if (!item.incertitude) {
      const normalizedQuote = normalizeForCitationMatch(item.preuve);
      if (normalizedQuote.length === 0 || !normalizedSource.includes(normalizedQuote)) {
        return { ok: false, reason: 'UNVERIFIABLE_EVIDENCE', details: { itemId: item.itemId } };
      }
    }
  }

  const coveredItemIds = proposal.items.map((item) => item.itemId);
  const missingItemIds = input.allowedItemIds.filter((id) => !coveredItemIds.includes(id));

  return {
    ok: true,
    coverage: { expectedItemIds: input.allowedItemIds, coveredItemIds, missingItemIds },
  };
}
