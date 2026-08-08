import 'server-only';

import { prisma } from '@/lib/prisma';

import { computeItemChecksum } from './item-checksum';

/**
 * Validation pédagogique par item du diagnostic candidat libre.
 *
 * Un item n'est montré à l'étudiant — score compris — que s'il a été relu et
 * validé par un enseignant qualifié. C'est la contrepartie technique de la
 * relecture : tant que personne n'a lu un item, son score reste retenu plutôt
 * que d'être présenté comme un fait.
 *
 * Deux propriétés portent le mécanisme. La validation **nomme** son relecteur,
 * jamais implicitement — on doit pouvoir dire qui a validé quoi. Et elle porte
 * l'**empreinte** de l'item relu : modifier ensuite l'énoncé, une option ou la
 * réponse attendue change l'empreinte et invalide la validation, au lieu de la
 * laisser couvrir un contenu que personne n'a jamais lu. Le cas dangereux n'est
 * pas l'énoncé retouché, c'est la bonne réponse changée en silence.
 */

export type ItemValidation = Readonly<{
  reviewerName: string;
  itemChecksum: string;
  validatedAt: Date;
}>;

export type ValidationIndex = ReadonlyMap<string, ItemValidation>;

/** Charge l'ensemble des validations, indexé par identifiant d'item. */
export async function loadValidationIndex(): Promise<ValidationIndex> {
  const rows = await prisma.candidateDiagnosticItemValidation.findMany({
    select: { itemId: true, reviewerName: true, itemChecksum: true, validatedAt: true },
  });
  return new Map(rows.map((row) => [row.itemId, {
    reviewerName: row.reviewerName,
    itemChecksum: row.itemChecksum,
    validatedAt: row.validatedAt,
  }]));
}

/**
 * L'item est-il validé **dans son état actuel** ?
 *
 * Une validation dont l'empreinte ne correspond plus est traitée comme absente :
 * fail-closed, puisque le contenu a changé depuis la relecture.
 */
export function isItemValidated(
  index: ValidationIndex,
  itemId: string,
  currentChecksum: string,
): boolean {
  const validation = index.get(itemId);
  return validation !== undefined && validation.itemChecksum === currentChecksum;
}

/**
 * Ne laisse passer que les scores d'items validés.
 *
 * Tout le reste est **retenu** — pas mis à zéro, pas approximé : simplement
 * absent, parce qu'un score qu'aucun enseignant n'a validé n'a pas à être
 * présenté à l'étudiant comme un résultat.
 */
export function filterValidatedScores<T extends { itemId: string; checksum: string }>(
  scores: readonly T[],
  index: ValidationIndex,
): readonly Omit<T, 'checksum'>[] {
  const kept: Omit<T, 'checksum'>[] = [];
  for (const score of scores) {
    if (!isItemValidated(index, score.itemId, score.checksum)) continue;
    const { checksum: _checksum, ...rest } = score;
    kept.push(rest);
  }
  return kept;
}

export { computeItemChecksum };
