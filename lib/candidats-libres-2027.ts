/**
 * Candidats libres — session 2027 : lecture typée du bloc `candidats_libres_2027`
 * de pricing.canonical.json (source unique des prix).
 *
 * Les offres datées se coupent seules : une date « jusqu'au JJ/MM » est valable
 * jusqu'à la fin de cette journée, heure de Tunis (UTC+1 toute l'année).
 */
import 'server-only';
import pricingData from '@/data/pricing.canonical.json';

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
  echeancier_affiche: 8 | 9;
  heures_cours: number;
  repartition: { matiere: string; heures: number }[];
  copies_corrigees: number;
  oraux: string;
  bilans: number;
  creneaux: string;
  cyclades: { ouverture: string; cloture: string };
  confirmation_ouverture: string;
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
  groupe: { max: number; ouverture_min: number; confirmation_remboursement_jours: number };
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
  stages_a_la_carte: { note: string; stages: { periode: string; niveau: string; heures: number; prix: number }[] };
}

const data = (pricingData as unknown as { candidats_libres_2027: CandidatsLibres2027 }).candidats_libres_2027;

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Fin (exclue) de la journée JJ, heure de Tunis : `2026-10-31` → 01/11/2026 00 h 00 à Tunis. */
export function finDeJourneeTunis(date: string): Date {
  return new Date(new Date(`${date}T00:00:00+01:00`).getTime() + JOUR_MS);
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
