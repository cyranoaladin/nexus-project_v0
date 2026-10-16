/**
 * Types du catalogue des manuels.
 *
 * Ils vivent ici, et non dans lib/pricing.ts, parce que la page des manuels
 * calcule son devis dans le navigateur : un composant « use client » qui
 * importerait lib/pricing — même en import de type — embarquerait la source
 * tarifaire entière dans le paquet du navigateur. Un garde-fou du dépôt le refuse
 * (__tests__/lib/pricing-client-sync.test.ts). lib/pricing.ts les réexporte
 * pour qui les attend là.
 */

export type ManuelFamily = 'tronc-commun' | 'specialite' | 'epreuve-anticipee-maths';

export interface ManuelVolume {
  /** Identifiant URL-sûr, seul utilisé par les formulaires et les routes. */
  id: string;
  /** Identifiant du paquet de publication (« PC/T »), pour la traçabilité. */
  volumeId: string;
  title: string;
  discipline: string;
  disciplineCode: string;
  disciplineLabel: string;
  family: ManuelFamily;
  level: string;
  pages: number;
  /** Rôle éditorial du manifeste : A manuel, B épreuves, C- sujets et extraits. */
  role: string;
  /** Une source d'impression est déclarée pour ce volume. */
  printDeclared: boolean;
  /** Le volume a un paquet de publication déclaré (manifeste, couverture). */
  packaged: boolean;
}

export interface ManuelsBaremeTier {
  /** Borne haute de la tranche, en pages ; null pour la dernière. */
  upToPage: number | null;
  centimesPerPage: number;
}

export interface ManuelsPaperBareme {
  bwCentimesPerPage: number;
  colorCentimesPerPage: number;
  perVolumeCentimes: number;
  groupDiscountCentimes: number;
  groupDiscountFromVolume: number;
}

export interface ManuelsBareme {
  tiers: ManuelsBaremeTier[];
  floorTnd: number;
  freeUpToPages: number;
  paper: ManuelsPaperBareme;
}

export interface ManuelDiscipline {
  id: string;
  code: string;
  label: string;
  family: ManuelFamily;
  order: number;
}

export interface ManuelsCatalogue {
  _note?: string;
  version: string;
  currency: string;
  bareme: ManuelsBareme;
  disciplines: ManuelDiscipline[];
  volumes: ManuelVolume[];
}
