import manifeste from '@/content/inscription-2027/pages.generated.json';

/**
 * Les deux adresses officielles de la session, pour les surfaces qui les
 * affichent hors des dossiers eux-mêmes.
 *
 * Elles viennent des documents audités, par le manifeste engendré : jamais
 * d'une saisie. Ce module n'est pas réservé au serveur — la page du bac en
 * candidat libre l'utilise au rendu, les contenus des pages de préparation
 * aussi — d'où sa séparation d'avec `lib/inscription-2027.ts`.
 */
function adresseUnique(champ: 'cyclades' | 'institut_francais', erreur: string): string {
  const adresses = new Set(manifeste.map((page) => page[champ]));
  // Deux dossiers qui cesseraient de s'accorder : on s'arrête plutôt que de
  // publier l'un des deux au hasard.
  if (adresses.size !== 1) throw new Error(erreur);
  return [...adresses][0];
}

/** Le portail d'inscription Cyclades, espace candidat. */
export function lienCycladesOfficiel(): string {
  return adresseUnique('cyclades', 'LIEN_CYCLADES_DIVERGENT');
}

/** L'Institut français de Tunisie, Examens & concours : suivi de la session. */
export function lienInstitutFrancaisOfficiel(): string {
  return adresseUnique('institut_francais', 'LIEN_IFT_DIVERGENT');
}
