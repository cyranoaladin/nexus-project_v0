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
 * 2. **Ordre canonique, non permuté.** La passation en ligne permute les
 *    options selon le `seed` de l'attempt ; la copie papier, elle, porte
 *    l'ordre imprimé du pack. Le « B » entouré sur la feuille désigne le
 *    deuxième item de cette liste-ci. Permuter ici décalerait chaque réponse.
 */

export type PaperEntryOption = Readonly<{ id: string; label: string }>;

export type PaperEntryItem = Readonly<{
  id: string;
  position: number;
  prompt: string;
  options: readonly PaperEntryOption[];
}>;

export function projectPaperEntryItems(enabled: EnabledBilanPack): readonly PaperEntryItem[] {
  return Object.freeze(enabled.pack.questionnaire.items.map((item, index) => Object.freeze({
    id: item.id,
    position: index + 1,
    prompt: item.questionText,
    options: Object.freeze(item.options.map((option) => Object.freeze({
      id: option.id,
      label: option.text,
    }))),
  })));
}
