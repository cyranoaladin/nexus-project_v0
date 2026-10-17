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
