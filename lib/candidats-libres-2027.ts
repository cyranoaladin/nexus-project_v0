/**
 * Candidats libres — session 2027 : lecture typée du bloc `candidats_libres_2027`
 * de pricing.canonical.json (source unique des prix).
 *
 * Les offres datées se coupent seules : une date « jusqu'au JJ/MM » est valable
 * jusqu'à la fin de cette journée, heure de Tunis (UTC+1 toute l'année).
 */
import 'server-only';
import type { RecommendationOffer } from '@/components/premium/recommendation-engine';
import { fmtMontant } from '@/components/premium/format';
import { getCandidatsLibres2027Source } from '@/lib/pricing';

export type ParcoursCandidatLibreId = 'premiere' | 'terminale' | 'bac-en-1-an';

export interface Echeancier {
  mensualite: number;
  derniere: number;
}

export interface ParcoursCandidatLibre {
  id: ParcoursCandidatLibreId;
  niveau: string;
  titre: string;
  accroche: string;
  public: string;
  prix_annuel: number;
  echeancier_9: Echeancier;
  echeancier_8: Echeancier;
  comptant: number;
  heures_cours: number;
  repartition: { matiere: string; heures: number }[];
  copies_corrigees: number;
  oraux: string;
  bilans: number;
  creneaux: string;
  cyclades: { ouverture: string; cloture: string };
  /** Total encadré : cours, copies, oraux et bilans réunis. */
  heures_encadrees_total: number;
  frais_dossier_offerts_jusqu_au: string | null;
}

export interface NiveauDiagnostic {
  id: 'terminale' | 'premiere';
  prix: number;
  contenu: string[];
}

export interface SemaineDiagnostic {
  du: string;
  au: string;
  inscriptions_jusqu_au: string;
  deduit_si_inscription_avant: string;
  places_par_niveau: number;
  niveaux: NiveauDiagnostic[];
}

export interface CandidatsLibres2027 {
  session: string;
  groupe: { max: number; ouverture_min: number; remboursement_jours_ouvres: number };
  /** Décision d'ouverture et premiers cours : une seule date pour tous les parcours. */
  calendrier: { decision_ouverture: string; premiers_cours: string };
  eligibilite: { terminale: string };
  oraux_format: { eaf_blanc: string; grand_oral_blanc: string };
  avantages: {
    comptant_remise_pct: number;
    fratrie_remise_pct: number;
    parrainage_tnd: number;
    note: string;
  };
  paiement: { comptant_remise_pct: number; echeancier_9: string; echeancier_8: string; note: string };
  parcours: ParcoursCandidatLibre[];
  inclus_communs: string[];
  specialites: { premiere: string[]; terminale: string[] };
  non_prepare: string[];
  frais_examen: string;
  frais_dossier: { montant: number; libelle: string };
  semaine_diagnostic: SemaineDiagnostic;
  ateliers_cyclades: { dates: string[]; heure: string; lieu: string; prix: number };
  emploi_du_temps: {
    jours: string[];
    terminale: (string | null)[];
    premiere: (string | null)[];
    charge_moyenne: { terminale: string; premiere: string };
    charge_max_hors_stage: string;
  };
  produits_courts: {
    note: string;
    adoptee_le: string;
    produits: { id: string; libelle: string; prix: number; contenu: string; paiement: string }[];
  };
}

const data = getCandidatsLibres2027Source() as CandidatsLibres2027;

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Fin (exclue) de la journée JJ, heure de Tunis : `2026-10-31` → 01/11/2026 00 h 00 à Tunis. */
export function finDeJourneeTunis(date: string): Date {
  return new Date(new Date(`${date}T00:00:00+01:00`).getTime() + JOUR_MS);
}

/**
 * Les deux entrées de la session. Le nombre de versements n'est pas un choix
 * de la famille : il découle du mois où elle s'inscrit.
 */
const ENTREES = {
  9: { mois: 'octobre', moisNum: 10, periode: 'd’octobre à juin' },
  8: { mois: 'novembre', moisNum: 11, periode: 'de novembre à juin' },
} as const;

/** « 8 × 580 puis 560 TND », ou « 8 × 650 TND » quand aucune échéance n'ajuste le total. */
function montantsEcheancier(e: Echeancier, versements: 8 | 9): string {
  return e.derniere === e.mensualite
    ? `${versements} × ${fmtMontant(e.mensualite)}\u00a0TND`
    : `${versements - 1} × ${fmtMontant(e.mensualite)} puis ${fmtMontant(e.derniere)}\u00a0TND`;
}

/**
 * Échéancier en prose, forme de la plaquette imprimée : « 8 × 580 puis
 * 560 TND, d'octobre à juin ». Réservé aux phrases suivies (FAQ, llms.txt),
 * où l'ancienne rédaction annonçait « 9 mensualités de 580 » — soit 20 TND de
 * plus que le prix annuel affiché sur la même ligne.
 */
export function texteEcheancierProse(e: Echeancier, versements: 8 | 9): string {
  return `${montantsEcheancier(e, versements)}, ${ENTREES[versements].periode}`;
}

/**
 * L'entrée qui court à la date du jour. Elle n'est pas déclarée dans la
 * source : une inscription « en octobre » est une inscription conclue pendant
 * le mois d'octobre, et l'année est celle des premiers cours. Un champ figé —
 * il y en a eu un — finit par contredire le calendrier qu'il suit.
 */
export function entreeEnCours(maintenant: Date = new Date()): 8 | 9 {
  const annee = Number(data.calendrier.premiers_cours.slice(0, 4));
  const finEntreeOctobre = new Date(`${annee}-${String(ENTREES[8].moisNum).padStart(2, '0')}-01T00:00:00+01:00`);
  return maintenant < finEntreeOctobre ? 9 : 8;
}

export interface EcheancierEtiquete {
  versements: 8 | 9;
  echeancier: Echeancier;
  /** « 9 mensualités, d'octobre à juin » */
  cadence: string;
  /** « 8 × 580 puis 560 TND » */
  montants: string;
  /** « pour une inscription en octobre » */
  entree: string;
  /** « octobre » */
  moisEntree: string;
  /** Entrée mise en avant à la date du jour ; l'autre reste affichée à côté. */
  enAvant: boolean;
}

/**
 * Les DEUX échéanciers d'un parcours, chacun étiqueté par son mois
 * d'inscription, l'entrée du jour en tête (décision du 16/10/2026).
 *
 * Ce ne sont ni deux offres ni deux prix : c'est le même prix annuel réparti
 * depuis le mois où la famille s'inscrit réellement. Afficher la seule entrée
 * d'octobre trompe une famille de novembre ; afficher la seule entrée de
 * novembre montre à une famille d'octobre un mensuel plus élevé que le sien.
 * Les cours commencent le 26/10 en Terminale et le 27/10 en Première : une
 * famille qui s'inscrit à l'ouverture relève de l'entrée d'octobre.
 */
export function echeanciersParMoisEntree(
  p: ParcoursCandidatLibre,
  maintenant: Date = new Date(),
): EcheancierEtiquete[] {
  const courante = entreeEnCours(maintenant);
  return ([9, 8] as const).map((versements) => {
    const echeancier = versements === 9 ? p.echeancier_9 : p.echeancier_8;
    const { mois, periode } = ENTREES[versements];
    return {
      versements,
      echeancier,
      cadence: `${versements} mensualités, ${periode}`,
      montants: montantsEcheancier(echeancier, versements),
      entree: `pour une inscription en ${mois}`,
      moisEntree: mois,
      enAvant: versements === courante,
    };
  });
}

/**
 * Les prix des produits courts ne sont pas publiés tant que leur régime
 * fiscal n'est pas attesté par le comptable : le dossier de la direction
 * bloque « toute offre commerciale ferme » sur ce point. La grille reste dans
 * la source canonique — elle est adoptée — et aucune surface publique ne la
 * sert sans ce drapeau.
 */
export function produitsCourtsPublies(env: Record<string, string | undefined> = process.env): boolean {
  return env.PRODUITS_COURTS_PUBLIES === 'true';
}

/** « 2026-10-31 » → « 31/10 ». */
export function jourMois(iso: string): string {
  const [, mois, jour] = iso.slice(0, 10).split('-');
  return `${jour}/${mois}`;
}

/** « 2026-11-12T18:00:00+01:00 » → « 12/11 à 18 h ». */
export function jourMoisHeure(iso: string): string {
  return `${jourMois(iso)} à ${Number(iso.slice(11, 13))}\u00a0h`;
}

export function getCandidatsLibres2027(): CandidatsLibres2027 {
  return data;
}

export function getParcoursCandidatLibre(): ParcoursCandidatLibre[];
export function getParcoursCandidatLibre(id: ParcoursCandidatLibreId): ParcoursCandidatLibre | undefined;
export function getParcoursCandidatLibre(id?: ParcoursCandidatLibreId) {
  return id ? data.parcours.find((p) => p.id === id) : data.parcours;
}

/** Frais de dossier offerts pour ce parcours à la date donnée, ou `null` une fois l'offre échue. */
export function getFraisDossierOfferts(
  id: ParcoursCandidatLibreId,
  maintenant: Date = new Date(),
): { montant: number; libelle: string; jusqu_au: string } | null {
  const limite = getParcoursCandidatLibre(id)?.frais_dossier_offerts_jusqu_au;
  if (!limite || maintenant >= finDeJourneeTunis(limite)) return null;
  return { ...data.frais_dossier, jusqu_au: limite };
}

/**
 * Frais de dossier et d'accompagnement Cyclades d'un parcours, toujours annoncés :
 * `offertJusquAu` porte la date limite tant que l'offre court, `null` quand ils sont dus.
 */
export function getFraisDossier(
  id: ParcoursCandidatLibreId,
  maintenant: Date = new Date(),
): { montant: number; offertJusquAu: string | null } {
  return { montant: data.frais_dossier.montant, offertJusquAu: getFraisDossierOfferts(id, maintenant)?.jusqu_au ?? null };
}

/** Offres de frais de dossier encore valables, de la plus proche échéance à la plus lointaine. */
export function getFraisDossierOffertsActifs(
  maintenant: Date = new Date(),
): { parcours: ParcoursCandidatLibre; offre: { montant: number; libelle: string; jusqu_au: string } }[] {
  return data.parcours
    .map((parcours) => ({ parcours, offre: getFraisDossierOfferts(parcours.id, maintenant) }))
    .filter((x): x is { parcours: ParcoursCandidatLibre; offre: NonNullable<typeof x.offre> } => x.offre !== null)
    .sort((a, b) => a.offre.jusqu_au.localeCompare(b.offre.jusqu_au));
}

/** La Semaine Diagnostic tant que les inscriptions sont ouvertes, sinon `null`. */
export function getSemaineDiagnostic(maintenant: Date = new Date()): SemaineDiagnostic | null {
  const semaine = data.semaine_diagnostic;
  return maintenant < finDeJourneeTunis(semaine.inscriptions_jusqu_au) ? semaine : null;
}

export function getEcheancesCyclades(): { terminale: ParcoursCandidatLibre['cyclades']; premiere: ParcoursCandidatLibre['cyclades'] } {
  return {
    terminale: getParcoursCandidatLibre('terminale')!.cyclades,
    premiere: getParcoursCandidatLibre('premiere')!.cyclades,
  };
}

/** Ateliers Cyclades encore à venir (la journée de l'atelier comprise). */
export function getAteliersCycladesAVenir(maintenant: Date = new Date()): string[] {
  return data.ateliers_cyclades.dates.filter((date) => maintenant < finDeJourneeTunis(date));
}

/**
 * Parcours candidats libres au format attendu par l'assistant « Trouver ma formule »
 * (components/premium/recommendation-engine.ts), sans acompte et avec l'échéancier affiché.
 */
export function recommandationsCandidatsLibres(maintenant: Date = new Date()): RecommendationOffer[] {
  const n = entreeEnCours(maintenant);
  return data.parcours.map((p) => {
    const echeancier = n === 8 ? p.echeancier_8 : p.echeancier_9;
    const installments = [...Array(n - 1).fill(echeancier.mensualite), echeancier.derniere];
    return {
      id: p.id,
      level: p.id === 'bac-en-1-an' ? 'terminale' : p.id,
      track: 'libre',
      title: p.titre,
      subjects: p.accroche,
      hours_per_week: null,
      hours_per_year: p.heures_cours,
      group_max: data.groupe.max,
      group_min_open: data.groupe.ouverture_min,
      price_annual: p.prix_annuel,
      included: [
        `${p.copies_corrigees} copies d’épreuves blanches corrigées`,
        p.oraux,
        `${p.bilans} bilans avec la famille`,
        'Inscription Cyclades accompagnée',
        `Frais de dossier et d’accompagnement Cyclades\u00a0: ${data.frais_dossier.montant}\u00a0TND en sus (offerts pendant certaines périodes)`,
      ],
      pricing_display: 'monthly_first',
      payment: { deposit: 0, installments, lastInstallment: echeancier.derniere, depositPct: 0 },
      normalizedLevel: p.id === 'bac-en-1-an' ? 'terminale' : p.id,
    };
  });
}

/** Contenu du bloc « À la une » de l'accueil : données simples, transmissibles à un composant client. */
export interface ALaUneCandidatsLibres {
  session: string;
  groupeMax: number;
  parcours: {
    id: ParcoursCandidatLibreId;
    niveau: string;
    /** Les deux entrées, celle du jour d'abord : l'accueil n'en montre jamais une seule. */
    entrees: { nbMensualites: 8 | 9; mensualite: number; derniere: number; moisEntree: string; enAvant: boolean }[];
  }[];
  /** Inscriptions Cyclades encore ouvertes ou à venir, dans l'ordre chronologique de clôture. */
  echeances: { niveau: string; texte: string }[];
  offre: string | null;
  /** Mention des frais de dossier, toujours présente (offerts ou dus). */
  fraisDossier: string;
  semaineDiagnostic: string | null;
}

/** `null` une fois toutes les inscriptions de la session closes (le bloc disparaît de l'accueil). */
export function getALaUneCandidatsLibres(maintenant: Date = new Date()): ALaUneCandidatsLibres | null {
  const terminale = getParcoursCandidatLibre('terminale')!;
  const premiere = getParcoursCandidatLibre('premiere')!;
  const echeances = [terminale, premiere]
    .filter((p) => maintenant < new Date(p.cyclades.cloture))
    .map((p) => ({
      niveau: p.niveau,
      texte:
        maintenant < new Date(`${p.cyclades.ouverture}T00:00:00+01:00`)
          ? `inscription Cyclades du ${jourMois(p.cyclades.ouverture)} au ${jourMoisHeure(p.cyclades.cloture)}`
          : `inscription Cyclades jusqu’au ${jourMoisHeure(p.cyclades.cloture)}`,
    }));
  if (echeances.length === 0) return null;

  const offres = getFraisDossierOffertsActifs(maintenant).map((x) => `${jourMois(x.offre.jusqu_au)} en ${x.parcours.niveau}`);
  const semaine = getSemaineDiagnostic(maintenant);

  return {
    session: data.session,
    groupeMax: data.groupe.max,
    parcours: data.parcours.map((p) => ({
      id: p.id,
      niveau: p.niveau,
      entrees: echeanciersParMoisEntree(p, maintenant).map((e) => ({
        nbMensualites: e.versements,
        mensualite: e.echeancier.mensualite,
        derniere: e.echeancier.derniere,
        moisEntree: e.moisEntree,
        enAvant: e.enAvant,
      })),
    })),
    echeances,
    offre: offres.length > 0 ? `Frais de dossier offerts jusqu’au ${offres.join(' et au ')}` : null,
    fraisDossier: offres.length > 0
      ? `${data.frais_dossier.libelle}\u00a0: ${data.frais_dossier.montant}\u00a0TND, offerts selon les dates ci-dessus, dus en Bac en 1 an`
      : `${data.frais_dossier.libelle}\u00a0: ${data.frais_dossier.montant}\u00a0TND par élève, en sus du prix annuel`,
    semaineDiagnostic: semaine
      ? `Semaine Diagnostic du ${jourMois(semaine.du)} au ${jourMois(semaine.au)} — inscriptions jusqu’au ${jourMois(semaine.inscriptions_jusqu_au)}`
      : null,
  };
}
