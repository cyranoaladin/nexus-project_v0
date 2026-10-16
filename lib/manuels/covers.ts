/**
 * Visuels de couverture, utilisables côté navigateur.
 *
 * Fichiers engendrés par scripts/manuels/build-covers.mjs. Seule la fiche
 * minimale est importée ici : la fiche complète porte les empreintes, les
 * poids et les statuts, et n'a rien à faire dans un paquet client.
 */
import clientData from '@/data/manuels-couvertures-client.generated.json';
import complet from '@/data/manuels-couvertures.generated.json';

export interface ManuelCouverture {
  /** Aperçu minuscule en ligne : évite le saut de mise en page sur mobile. */
  lqip: string;
  width: number;
  height: number;
  src: string;
  srcSet: string;
  zoom: { recto: string; verso?: string };
}

const COUVERTURES = clientData.couvertures as unknown as Record<string, ManuelCouverture>;

export const VOLUMES_SANS_COUVERTURE = complet.sansCouverture as {
  id: string;
  volumeId: string;
  raison: string;
}[];

export function getCouverture(id: string): ManuelCouverture | undefined {
  return COUVERTURES[id];
}
