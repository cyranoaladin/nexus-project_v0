import 'server-only';

import manifeste from '@/content/inscription-2027/pages.generated.json';

/**
 * Les deux dossiers « Inscription 2027 ». Le manifeste est engendré par
 * `scripts/inscription-2027/build-pages.mjs` depuis les documents audités de
 * `content/inscription-2027/source/` : ni le titre, ni la description, ni la
 * date de clôture ne sont saisis ici. Les éditer à la main les ferait diverger
 * de la page servie.
 */
export interface PageInscription2027 {
  slug: 'general' | 'stmg';
  /** Chemin public, servi par un rewrite vers le document statique. */
  chemin: string;
  titre: string;
  description: string;
  /** Clôture de la campagne Cyclades, lue sur le compte à rebours du document. */
  cloture: string;
  /** Portail d'inscription officiel, lu sur le document audité. */
  cyclades: string;
}

export function getPagesInscription2027(): PageInscription2027[] {
  return manifeste as PageInscription2027[];
}

/**
 * La campagne court-elle encore ? Le plan du site donne une priorité haute à
 * une page d'actualité, et la redescend une fois l'échéance passée — la même
 * règle que pour les offres datées des candidats libres.
 */
export function campagneOuverte(page: PageInscription2027, maintenant: Date = new Date()): boolean {
  return maintenant < new Date(page.cloture);
}

/**
 * L'adresse du portail Cyclades, pour les surfaces qui l'affichent hors des
 * dossiers eux-mêmes. Elle vient des documents audités, jamais d'une saisie :
 * si les deux dossiers cessaient de s'accorder, on s'arrête plutôt que de
 * publier l'un des deux au hasard.
 */
export function lienCycladesOfficiel(): string {
  const adresses = new Set(getPagesInscription2027().map((page) => page.cyclades));
  if (adresses.size !== 1) throw new Error('LIEN_CYCLADES_DIVERGENT');
  return [...adresses][0];
}
