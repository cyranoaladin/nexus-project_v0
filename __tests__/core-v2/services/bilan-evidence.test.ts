/**
 * Contextual AI-evidence checks (mission §4) — pure unit tests, no DB, no
 * network. The zod schema controls field shape only; these checks are
 * what actually verify an itemId exists and a citation is real.
 */
import { normalizeForCitationMatch, validateAiProposalAgainstSource } from '@/lib/core-v2/diagnostics/bilan-evidence';
import type { BilanAiProposal } from '@/lib/core-v2/diagnostics/bilan-ai-schema';

const SOURCE_TEXT = "Item 2 : Ce document sert uniquement à vérifier que l'attribution fonctionne.\nItem 3 : Je me suis connecté avec mon compte.";

function proposal(items: BilanAiProposal['items']): BilanAiProposal {
  return { items, pointsAppui: [], difficultesObservees: [], prioritesTravail: [], propositionsRemediation: [] };
}

describe('normalizeForCitationMatch', () => {
  test('is insensitive to case, accents, punctuation, and whitespace differences', () => {
    const a = normalizeForCitationMatch("Ce Document sert   uniquement à VÉRIFIER, que l'attribution!");
    const b = normalizeForCitationMatch('ce document sert uniquement a verifier que l attribution');
    expect(a).toBe(b);
  });
});

describe('validateAiProposalAgainstSource', () => {
  const allowedItemIds = ['item-2', 'item-3'];

  test('accepts a real, literal, normalized-matching citation', () => {
    const result = validateAiProposalAgainstSource(
      proposal([{ itemId: 'item-2', constat: 'x', preuve: "Ce document sert uniquement à vérifier que l'attribution fonctionne", incertitude: false }]),
      { allowedItemIds, extractedText: SOURCE_TEXT },
    );
    expect(result.ok).toBe(true);
  });

  test('refuses an itemId that was never among the ones asked about', () => {
    const result = validateAiProposalAgainstSource(
      proposal([{ itemId: 'item-99', constat: 'x', preuve: 'y', incertitude: true }]),
      { allowedItemIds, extractedText: SOURCE_TEXT },
    );
    expect(result).toMatchObject({ ok: false, reason: 'UNKNOWN_ITEM_ID' });
  });

  test('refuses a duplicated itemId — never silently keeping the first or the last', () => {
    const result = validateAiProposalAgainstSource(
      proposal([
        { itemId: 'item-2', constat: 'a', preuve: 'Ce document sert uniquement à vérifier que l', incertitude: false },
        { itemId: 'item-2', constat: 'b', preuve: 'Ce document sert uniquement à vérifier que l', incertitude: false },
      ]),
      { allowedItemIds, extractedText: SOURCE_TEXT },
    );
    expect(result).toMatchObject({ ok: false, reason: 'DUPLICATE_ITEM_ID' });
  });

  test('refuses a fabricated citation presented as textual (incertitude=false) that does not occur in the source', () => {
    const result = validateAiProposalAgainstSource(
      proposal([{ itemId: 'item-2', constat: 'x', preuve: 'Une phrase totalement inventée absente de la copie', incertitude: false }]),
      { allowedItemIds, extractedText: SOURCE_TEXT },
    );
    expect(result).toMatchObject({ ok: false, reason: 'UNVERIFIABLE_EVIDENCE' });
  });

  test('refuses a citation wrapped in commentary — a paraphrase-with-quote is not a bare literal citation', () => {
    const result = validateAiProposalAgainstSource(
      proposal([{
        itemId: 'item-2',
        constat: 'x',
        preuve: "Phrase complète présente dans la copie : \"Ce document sert uniquement à vérifier que l'attribution fonctionne\"",
        incertitude: false,
      }]),
      { allowedItemIds, extractedText: SOURCE_TEXT },
    );
    expect(result).toMatchObject({ ok: false, reason: 'UNVERIFIABLE_EVIDENCE' });
  });

  test('accepts incertitude=true with no matching quote — an honestly-flagged absence is never fabricated evidence', () => {
    const result = validateAiProposalAgainstSource(
      proposal([{ itemId: 'item-2', constat: 'Item illisible.', preuve: 'aucun passage identifiable', incertitude: true }]),
      { allowedItemIds, extractedText: SOURCE_TEXT },
    );
    expect(result.ok).toBe(true);
  });

  test('reports coverage: which of the allowed items were and were not addressed', () => {
    const result = validateAiProposalAgainstSource(
      proposal([{ itemId: 'item-2', constat: 'x', preuve: 'Ce document sert uniquement à vérifier que l', incertitude: false }]),
      { allowedItemIds, extractedText: SOURCE_TEXT },
    );
    if (!result.ok) throw new Error('expected ok');
    expect(result.coverage).toEqual({ expectedItemIds: allowedItemIds, coveredItemIds: ['item-2'], missingItemIds: ['item-3'] });
  });
});
