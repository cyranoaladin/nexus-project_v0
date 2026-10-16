/**
 * Moteur de prix des manuels pour candidats individuels — barème v2.
 *
 * Un seul barème, appliqué au nombre de pages, par tranches cumulatives. Les
 * taux ne vivent pas ici : ils sont lus du socle canonique
 * (data/pricing.canonical.json, bloc `manuels`). Ce module ne fait que les
 * appliquer.
 *
 * Tout le calcul se fait en CENTIMES ENTIERS, converti en dinars au dernier
 * moment, la demie montant. Les flottants faisaient diverger le moteur de la
 * Maison édition et le simulateur d'un dinar sur certains lots : même formule,
 * même arrondi, deux résultats, parce que 0,22 n'existe pas en binaire.
 *
 * Autorité : work/offre/prix_v2.py. La confrontation est rejouée à chaque
 * exécution des tests sur 186 paniers (__tests__/lib/manuels-pricing.test.ts).
 */
import type { ManuelsBareme, ManuelVolume } from './types';
import { getManuelsBaremeClient, getManuelVolumeClient } from './catalogue-client';

export type ManuelFormat = 'pdf' | 'papier-nb' | 'papier-couleur';

export const MANUEL_FORMATS: readonly ManuelFormat[] = ['pdf', 'papier-nb', 'papier-couleur'];

export interface ManuelsQuote {
  /** Nombre de volumes retenus. */
  volumes: number;
  /** Total des pages, annexes offertes comprises. */
  pages: number;
  /** Prix du contenu numérique, barème appliqué au lot entier. */
  pdf: number;
  /** Ce que la même sélection coûterait achetée volume par volume. */
  unit: { pdf: number; bw: number; color: number };
  /** PDF + fabrication noir et blanc. */
  bw: number;
  /** PDF + fabrication couleur. */
  color: number;
  /** Fabrication seule, noir et blanc. */
  paperBw: number;
  /** Fabrication seule, couleur. */
  paperColor: number;
}

/** Ce que le lot fait gagner, pour le format retenu. */
export interface ManuelsSaving {
  tnd: number;
  pct: number;
}

/** Centimes entiers vers dinars entiers, la demie monte. Exact par construction. */
function toDinars(centimes: number): number {
  return Math.floor((centimes + 50) / 100);
}

/**
 * Prix du contenu numérique pour un nombre de pages donné.
 * Les tranches sont cumulatives : chaque page est facturée au taux de sa tranche.
 */
export function priceForPages(pages: number, bareme: ManuelsBareme): number {
  if (pages <= bareme.freeUpToPages) return 0;
  let centimes = 0;
  let bas = 0;
  for (const { upToPage, centimesPerPage } of bareme.tiers) {
    if (upToPage === null) {
      centimes += (pages - bas) * centimesPerPage;
      break;
    }
    centimes += Math.max(0, Math.min(pages, upToPage) - bas) * centimesPerPage;
    if (pages <= upToPage) break;
    bas = upToPage;
  }
  return Math.max(bareme.floorTnd, toDinars(centimes));
}

/**
 * Supplément de fabrication : le papier s'ajoute au contenu, il ne le remplace pas.
 * Au-delà du cinquième volume, un dinar est retiré par volume (groupage).
 */
export function paperSupplement(
  pageList: number[],
  color: boolean,
  bareme: ManuelsBareme,
): number {
  const { paper } = bareme;
  const taux = color ? paper.colorCentimesPerPage : paper.bwCentimesPerPage;
  const centimes = pageList.reduce((n, p) => n + taux * p + paper.perVolumeCentimes, 0);
  const groupage =
    paper.groupDiscountCentimes * Math.max(0, pageList.length - paper.groupDiscountFromVolume);
  return toDinars(centimes - groupage);
}

/** Les trois prix d'un même panier, à partir des paginations. */
export function quote(pageList: number[], bareme: ManuelsBareme): ManuelsQuote {
  const facturables = pageList
    .filter((p) => p > bareme.freeUpToPages)
    .reduce((n, p) => n + p, 0);
  // Volume par volume : chacun supporte seul le barème ET sa fabrication,
  // sans le groupage, qui n'existe qu'à partir du sixième volume d'un lot.
  const unitPdf = pageList.reduce((n, p) => n + priceForPages(p, bareme), 0);
  const unitBw = pageList.reduce(
    (n, p) => n + priceForPages(p, bareme) + paperSupplement([p], false, bareme),
    0,
  );
  const unitColor = pageList.reduce(
    (n, p) => n + priceForPages(p, bareme) + paperSupplement([p], true, bareme),
    0,
  );
  const pdf = unitPdf ? Math.min(priceForPages(facturables, bareme), unitPdf) : 0;
  const paperBw = paperSupplement(pageList, false, bareme);
  const paperColor = paperSupplement(pageList, true, bareme);

  return {
    volumes: pageList.length,
    pages: pageList.reduce((n, p) => n + p, 0),
    pdf,
    unit: { pdf: unitPdf, bw: unitBw, color: unitColor },
    bw: pdf + paperBw,
    color: pdf + paperColor,
    paperBw,
    paperColor,
  };
}

/**
 * Les trois prix d'une sélection de volumes, par identifiant public.
 * Un identifiant inconnu lève : une sélection partiellement comprise
 * produirait un devis silencieusement faux.
 */
export function quoteForVolumeIds(ids: string[], bareme?: ManuelsBareme): ManuelsQuote {
  return quote(resolveVolumes(ids).map((v) => v.pages), bareme ?? getManuelsBaremeClient());
}

/** Résout une sélection en volumes, sans doublon, dans l'ordre du catalogue. */
export function resolveVolumes(ids: string[]): ManuelVolume[] {
  const vus = new Set<string>();
  const out: ManuelVolume[] = [];
  for (const id of ids) {
    if (vus.has(id)) continue;
    const volume = getManuelVolumeClient(id);
    if (!volume) throw new Error(`Volume inconnu au catalogue : ${id}`);
    vus.add(id);
    out.push(volume);
  }
  return out;
}

/** Le montant dû pour le format choisi. */
export function totalForFormat(devis: ManuelsQuote, format: ManuelFormat): number {
  switch (format) {
    case 'pdf':
      return devis.pdf;
    case 'papier-nb':
      return devis.bw;
    case 'papier-couleur':
      return devis.color;
  }
}

/** Ce que la sélection coûterait achetée volume par volume, dans ce format. */
export function unitTotalForFormat(devis: ManuelsQuote, format: ManuelFormat): number {
  switch (format) {
    case 'pdf':
      return devis.unit.pdf;
    case 'papier-nb':
      return devis.unit.bw;
    case 'papier-couleur':
      return devis.unit.color;
  }
}

/** La remise de lot réellement obtenue sur le format retenu. */
export function savingForFormat(devis: ManuelsQuote, format: ManuelFormat): ManuelsSaving {
  const unite = unitTotalForFormat(devis, format);
  const tnd = unite - totalForFormat(devis, format);
  return { tnd, pct: unite ? Math.round((tnd / unite) * 100) : 0 };
}

export function isManuelFormat(value: unknown): value is ManuelFormat {
  return typeof value === 'string' && (MANUEL_FORMATS as readonly string[]).includes(value);
}
