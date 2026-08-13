/**
 * Seule source des seuils et barèmes du positionnement.
 * Aucune de ces valeurs ne doit être dupliquée ailleurs dans le dépôt.
 *
 * Toute modification d'une valeur observable en sortie impose :
 *   1. une bascule d'ENGINE_VERSION
 *   2. la régénération des cas dorés
 *   3. une justification en ADR
 */

import type { GroupBand, ItemProfile } from './types';

// 1.1.0 — §6 : la présence d'une ERREUR_CONFIANTE (puis d'une LACUNE_CONSCIENTE)
// prime sur la masse ; un nœud contenant un item faux assumé n'est plus jamais
// « MAITRISE ». Voir ADR et docs/specs/bilans/02-moteur-de-faits.md.
export const ENGINE_VERSION = '1.1.0';

/** Réussite continue à partir de laquelle un item est considéré réussi pour le profilage. */
export const SUCCESS_THRESHOLD = 0.75;

/** Confiance à partir de laquelle l'élève est considéré confiant. */
export const CONFIDENCE_THRESHOLD = 3;

/** Nombre maximum de nœuds prioritaires repris dans le micro-plan élève. */
export const PRIORITY_NODES_MAX = 3;

/** Nombre maximum de points d'appui listés dans une restitution. */
export const STRENGTH_NODES_MAX = 3;

/** Couverture en dessous de laquelle le résultat est signalé comme partiel. */
export const COVERAGE_MIN = 70;

/** Indice de calibration en dessous duquel un travail métacognitif est signalé. */
export const CALIBRATION_MIN = 60;

/** Ratio durée réelle / durée cible en dessous duquel la passation est jugée express. */
export const EXPRESS_RATIO = 0.35;

/** Nombre de nœuds ERREUR_CONFIANTE à partir duquel le drapeau multiple est levé. */
export const CONFIDENT_ERROR_NODES_MIN = 2;

/** Durée de vie d'une passation, en minutes. */
export const ATTEMPT_TTL_MINUTES = 180;

/** Durée de vie d'un lien de bilan parent, en heures. */
export const BILAN_LINK_TTL_HOURS = 72;

/** Revue humaine obligatoire avant diffusion d'un bilan PARENT. */
export const REQUIRE_HUMAN_REVIEW_PARENT = true;

/**
 * L'UNIQUE échelle de sévérité du positionnement. Plus grand = plus
 * prioritaire. Toute priorisation, tout héritage de profil, tout ordre
 * d'affichage en dérive — un test d'architecture interdit toute seconde
 * échelle.
 *
 * Position de NON_TRAITE, explicite (13/08/2026) : sous MAITRISE_FRAGILE.
 * C'est l'ordre de la méthode publiée aux familles et aux enseignants —
 * « confronter (EC), installer (LC), consolider (MF), diagnostiquer (NT) » :
 * une fragilité PROUVÉE par la passation prime sur une absence d'information.
 * Historique : trois positions de NON_TRAITE coexistaient (au sommet dans
 * l'héritage de domaine, au milieu ici, en dernier dans l'ordre d'affichage) —
 * un même document pouvait se contredire entre son tableau, ses priorités et
 * son texte de méthode.
 */
export const SEVERITY_RANK: Readonly<Record<ItemProfile, number>> = Object.freeze({
  ERREUR_CONFIANTE: 4,
  LACUNE_CONSCIENTE: 3,
  MAITRISE_FRAGILE: 2,
  NON_TRAITE: 1,
  MAITRISE: 0,
});

/** Bornes inférieures inclusives des bandes de calibration de groupe. */
export const GROUP_BANDS: ReadonlyArray<{ min: number; band: GroupBand }> = Object.freeze([
  { min: 85, band: 'APPROFONDISSEMENT' },
  { min: 65, band: 'RENFORCEMENT' },
  { min: 40, band: 'CONSOLIDATION_STANDARD' },
  { min: 0, band: 'CONSOLIDATION_PRIORITAIRE' },
]);

/** Criticité par défaut d'un nœud CPS dépourvu de valeur explicite. */
export const DEFAULT_NODE_CRITICALITY = 1;
