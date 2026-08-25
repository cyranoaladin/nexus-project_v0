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
 * 2. **Identité papier par lettre.** Une banque peut stocker ses options dans
 *    un ordre interne différent afin de satisfaire les contrôles de biais de
 *    position. Sur une copie papier, en revanche, « B » désigne toujours B.
 *    La projection rétablit donc l'ordre des identifiants A, B, C, D sans
 *    aucune permutation liée au seed. Le scoring continue de travailler sur
 *    les identifiants d'option, jamais sur leur position dans le tableau.
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
    options: Object.freeze([...item.options]
      .sort((left, right) => left.id.localeCompare(right.id, 'fr'))
      .map((option) => Object.freeze({
        id: option.id,
        label: option.text,
      }))),
  })));
}
