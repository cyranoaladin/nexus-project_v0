import type { Prisma } from '@prisma/client';

import { CanonicalApiError } from './errors';
import type { EnabledBilanPack } from './pack-access';

/**
 * Forme d'une réponse telle qu'elle est stockée dans `answers` d'un attempt.
 *
 * `confidence: null` avec un `optionId` renseigné signifie « l'élève n'a pas
 * déclaré sa certitude ». C'est un état légitime, pas une valeur manquante à
 * combler : la passation en ligne ne le produit jamais (le questionnaire exige
 * la certitude), une copie papier oui, très souvent. Le moteur de faits sait
 * déjà le lire — `Confidence = 1 | 2 | 3 | 4 | null` — et le traite comme une
 * absence de confiance déclarée, ce qui est exactement le fait observé.
 */
export type StoredAttemptAnswer = Readonly<{
  optionId: string | null;
  confidence: 1 | 2 | 3 | 4 | null;
}>;

export type AttemptAnswerPatch = Readonly<{
  itemId: string;
  optionId: string | null;
  confidence: 1 | 2 | 3 | 4 | null;
}>;

export function attemptAnswerRecord(value: unknown): Record<string, Prisma.JsonValue> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...value as Record<string, Prisma.JsonValue> };
}

/**
 * Fusion d'un lot de réponses dans l'état stocké. Utilisée par la passation en
 * ligne (PATCH successifs au fil du questionnaire) et par la saisie papier
 * (un lot unique). Un seul chemin d'écriture, donc un seul état possible.
 */
export function mergeAttemptAnswers(
  existing: unknown,
  patches: readonly AttemptAnswerPatch[],
): Record<string, Prisma.JsonValue> {
  const merged = attemptAnswerRecord(existing);
  for (const patch of patches) {
    // `defineProperty` plutôt qu'une affectation : un item nommé `__proto__`
    // détournerait `merged[id] = …` vers le prototype. La lecture semblerait
    // réussir — la complétude passerait — mais `JSON.stringify` ne sérialise
    // pas un prototype, la réponse disparaîtrait à l'enregistrement et le
    // worker échouerait plus tard sur A86_ANSWER_MISSING. Accepter puis
    // échouer en différé est le pire des deux mondes.
    Object.defineProperty(merged, patch.itemId, {
      value: { optionId: patch.optionId, confidence: patch.confidence },
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return merged;
}

/** Toute réponse doit désigner un item du pack et une de ses options. */
export function assertAnswersBelongToPack(
  answers: readonly AttemptAnswerPatch[],
  enabled: EnabledBilanPack,
): void {
  const items = new Map(enabled.pack.questionnaire.items.map((item) => [item.id, item]));
  for (const answer of answers) {
    const item = items.get(answer.itemId);
    if (item === undefined) throw CanonicalApiError.badRequest('ANSWER_ITEM_INVALID');
    if (answer.optionId !== null && !item.options.some((option) => option.id === answer.optionId)) {
      throw CanonicalApiError.badRequest('ANSWER_OPTION_INVALID');
    }
  }
}
