/**
 * Types du moteur de positionnement.
 * Source de vérité comportementale : docs/specs/bilans/02-moteur-de-faits.md
 *
 * Aucun type de ce fichier ne dépend de Prisma : le moteur doit rester testable
 * sans base de données.
 */

export type ItemType = 'QCM_SIMPLE' | 'QCM_MULTIPLE' | 'NUMERIC' | 'SHORT_TEXT';

export type ItemProfile =
  | 'MAITRISE'
  | 'MAITRISE_FRAGILE'
  | 'LACUNE_CONSCIENTE'
  | 'ERREUR_CONFIANTE'
  | 'NON_TRAITE';

export type NodeProfile = ItemProfile;

export type GroupBand =
  | 'CONSOLIDATION_PRIORITAIRE'
  | 'CONSOLIDATION_STANDARD'
  | 'RENFORCEMENT'
  | 'APPROFONDISSEMENT';

export type ResultFlag =
  | 'COUVERTURE_INSUFFISANTE'
  | 'CALIBRATION_A_TRAVAILLER'
  | 'ERREURS_CONFIANTES_MULTIPLES'
  | 'PASSATION_EXPRESS'
  | 'PASSATION_PARTIELLE';

/** Confiance déclarée. 1 = je devine, 4 = certain. `null` = item non traité. */
export type Confidence = 1 | 2 | 3 | 4 | null;

export type Difficulty = 1 | 2 | 3;

export interface AnswerKeyQcmSimple {
  kind: 'QCM_SIMPLE';
  correct: string;
}
export interface AnswerKeyQcmMultiple {
  kind: 'QCM_MULTIPLE';
  correct: readonly string[];
}
export interface AnswerKeyNumeric {
  kind: 'NUMERIC';
  target: number;
  tolerance: number;
}
export interface AnswerKeyShortText {
  kind: 'SHORT_TEXT';
  /** Formes acceptées, comparées après normalisation. */
  accepted: readonly string[];
}

export type AnswerKey =
  | AnswerKeyQcmSimple
  | AnswerKeyQcmMultiple
  | AnswerKeyNumeric
  | AnswerKeyShortText;

export interface ScoringItem {
  readonly id: string;
  readonly nodeCpsId: string;
  readonly type: ItemType;
  readonly difficulty: Difficulty;
  readonly answerKey: AnswerKey;
  /** Criticité du nœud issue du CPS compilé. Défaut 1 si absente. */
  readonly nodeCriticality?: number;
  readonly targetTimeSec: number;
}

export interface ScoringAnswer {
  readonly itemId: string;
  /** `null` ou `undefined` ⇒ item non traité. */
  readonly rawAnswer: string | readonly string[] | number | null | undefined;
  readonly confidence: Confidence;
  readonly elapsedMs: number;
}

export interface ScoringInput {
  readonly items: readonly ScoringItem[];
  readonly answers: readonly ScoringAnswer[];
  /** Durée cible du test, en minutes. Sert au drapeau PASSATION_EXPRESS. */
  readonly targetDurationMin: number;
  /** Vrai si la passation a été soumise depuis un état expiré. */
  readonly partial?: boolean;
}

export interface ItemResult {
  readonly itemId: string;
  readonly nodeCpsId: string;
  readonly weight: Difficulty;
  /** Réussite continue, arrondie au quart. */
  readonly rawSuccess: number;
  readonly isSuccess: boolean;
  readonly isConfident: boolean;
  readonly profile: ItemProfile;
  readonly answered: boolean;
  readonly elapsedMs: number;
}

export interface NodeResult {
  readonly nodeCpsId: string;
  readonly criticality: number;
  readonly nodeScore: number;
  readonly profile: NodeProfile;
  readonly itemIds: readonly string[];
  /** Rang de priorité, 0 = plus prioritaire. */
  readonly priorityRank: number;
}

export interface ScoringOutput {
  readonly engineVersion: string;
  readonly globalScore: number;
  readonly coverage: number;
  readonly calibrationIndex: number | null;
  readonly items: readonly ItemResult[];
  readonly nodes: readonly NodeResult[];
  readonly flags: readonly ResultFlag[];
  readonly groupBand: GroupBand;
}
