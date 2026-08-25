import type { Prisma } from '@prisma/client';

import {
  assertAnswersBelongToPack,
  mergeAttemptAnswers,
  type AttemptAnswerPatch,
} from '../api/answer-merge';
import { CanonicalApiError } from '../api/errors';
import type { EnabledBilanPack } from '../api/pack-access';

/**
 * Saisie papier : recopie par un membre du staff d'une copie déjà passée.
 *
 * Ce module ne calcule rien. Il ne fait que transformer ce qui est lu sur une
 * copie en l'état `answers` d'un attempt — le même état, au même format, que
 * celui qu'une passation en ligne aurait produit. Tout ce qui suit (complétude,
 * soumission, scoring, rapport) est ensuite le chemin canonique, sans variante.
 */

export const SAISIE_PAPIER_PROVENANCE = 'SAISIE_PAPIER' as const;

/**
 * Une ligne de la copie. La certitude est normalement renseignée par l'élève
 * et l'écran de saisie la demande pour chaque item. `null` reste admis lorsque
 * la réponse est cochée mais que la case de certitude manque sur la copie. Il
 * n'y a pas de valeur par défaut : une certitude absente est enregistrée comme
 * absente, jamais devinée.
 */
export type PaperEntryAnswer = Readonly<{
  itemId: string;
  /** `null` = « sans réponse », choisi délibérément par la saisissante. */
  optionId: string | null;
  confidence: 1 | 2 | 3 | 4 | null;
}>;

function assertNoDuplicateItem(entries: readonly PaperEntryAnswer[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.itemId)) throw CanonicalApiError.badRequest('ANSWER_ITEM_DUPLICATE');
    seen.add(entry.itemId);
  }
}

/**
 * Construit l'état `answers` d'un attempt à partir d'une copie papier.
 *
 * L'ordre est celui des items du pack — l'ordre dans lequel l'écran de saisie
 * les présente — et non celui du corps de la requête.
 */
export function buildPaperEntryAnswers(
  enabled: EnabledBilanPack,
  entries: readonly PaperEntryAnswer[],
): Record<string, Prisma.JsonValue> {
  assertNoDuplicateItem(entries);
  for (const entry of entries) {
    // Une absence de réponse n'a pas de certitude : en accepter une serait
    // inventer une donnée que la copie ne porte pas.
    if (entry.optionId === null && entry.confidence !== null) {
      throw CanonicalApiError.badRequest('PAPER_ENTRY_BLANK_WITH_CONFIDENCE');
    }
  }
  const patches: AttemptAnswerPatch[] = entries.map((entry) => ({
    itemId: entry.itemId,
    optionId: entry.optionId,
    confidence: entry.confidence,
  }));
  assertAnswersBelongToPack(patches, enabled);

  const byItem = new Map(patches.map((patch) => [patch.itemId, patch]));
  const ordered = enabled.pack.questionnaire.items.flatMap((item) => {
    const patch = byItem.get(item.id);
    return patch === undefined ? [] : [patch];
  });
  return mergeAttemptAnswers({}, ordered);
}
