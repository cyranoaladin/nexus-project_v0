import type { EnabledBilanPack } from '../api/pack-access';

/**
 * Projection des items d'un pack pour l'écran de saisie papier.
 *
 * Deux règles la gouvernent.
 *
 * 1. **Aucune divulgation.** La bonne réponse et les justifications de
 *    distracteurs ne quittent pas le serveur, ici comme dans la passation en
 *    ligne. Le saisisseur recopie ce qu'il lit ; il n'a pas à connaître le
 *    corrigé, et rien ne doit pouvoir fuiter par cet écran.
 *
 * 2. **Identifiant imprimé canonique.** L'ordre interne d'un pack peut être
 *    équilibré pour les garde-fous anti-biais. Une copie papier, elle, imprime
 *    des identifiants stables A, B, C, D (éventuellement E). L'écran doit donc
 *    afficher ces identifiants dans leur ordre naturel : le « B » entouré sur
 *    la feuille reste toujours l'option d'id B, indépendamment de l'ordre
 *    interne du tableau JSON. La passation en ligne conserve sa permutation
 *    propre selon le `seed` de l'attempt.
 */

export type PaperEntryOption = Readonly<{ id: string; label: string }>;

export type PaperEntryItem = Readonly<{
  id: string;
  position: number;
  prompt: string;
  options: readonly PaperEntryOption[];
}>;

const PRINTED_OPTION_IDS = ['A', 'B', 'C', 'D', 'E'] as const;
const PRINTED_OPTION_RANK = new Map<string, number>(
  PRINTED_OPTION_IDS.map((id, index) => [id, index]),
);

function projectOptions(
  options: EnabledBilanPack['pack']['questionnaire']['items'][number]['options'],
): readonly PaperEntryOption[] {
  const canUsePrintedOrder = options.every(({ id }) => PRINTED_OPTION_RANK.has(id));
  const ordered = canUsePrintedOrder
    ? [...options].sort((left, right) => PRINTED_OPTION_RANK.get(left.id)! - PRINTED_OPTION_RANK.get(right.id)!)
    : [...options];
  return Object.freeze(ordered.map((option) => Object.freeze({
    id: option.id,
    label: option.text,
  })));
}

export function projectPaperEntryItems(enabled: EnabledBilanPack): readonly PaperEntryItem[] {
  return Object.freeze(enabled.pack.questionnaire.items.map((item, index) => Object.freeze({
    id: item.id,
    position: index + 1,
    prompt: item.questionText,
    options: projectOptions(item.options),
  })));
}
