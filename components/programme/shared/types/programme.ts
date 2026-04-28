/**
 * Types partagés entre les programmes mathématiques.
 *
 * Source originale : app/programme/maths-1ere/data.ts et app/programme/maths-1ere/store.ts.
 * Extraits ici pour permettre le partage avec maths-1ere-stmg et maths-terminale (Lots F et E.bis).
 */

// ─── Exercise Types ─────────────────────────────────────────────────────────

export type ExerciceType = 'qcm' | 'numerique' | 'ordonnancement';

export interface ExerciceQCM {
  type: 'qcm';
  question: string;
  options: string[];
  correct: number;
  explication: string;
}

export interface ExerciceNumerique {
  type: 'numerique';
  question: string;
  reponse: number | string;
  tolerance?: number;
  unite?: string;
  explication: string;
}

export interface ExerciceOrdonnancement {
  type: 'ordonnancement';
  question: string;
  etapesDesordre: string[];
  ordreCorrect: number[];
  explication: string;
}

export type Exercice = ExerciceQCM | ExerciceNumerique | ExerciceOrdonnancement;

// ─── Hint System (Coup de Pouce) ────────────────────────────────────────────

export interface CoupDePouce {
  indice: string;
  debutRaisonnement: string;
  correctionDetaillee: string[];
}

// ─── Chapter Content ────────────────────────────────────────────────────────

export interface ChapitreContenu {
  rappel: string;
  methode: string;
  tableau?: TableauRow[];
  cas?: CasRow[];
  astuce: string;
  exercice: ExerciceData;
  erreursClassiques?: string[];
  methodologieBac?: string;
  coupDePouce?: CoupDePouce;
  geogebraId?: string;
}

/** B.O. competences (CdC §1.2) */
export type CompetenceBO = 'chercher' | 'modeliser' | 'representer' | 'raisonner' | 'calculer' | 'communiquer';

export interface Chapitre {
  id: string;
  titre: string;
  niveau: 'essentiel' | 'maitrise' | 'approfondissement';
  difficulte: 1 | 2 | 3 | 4 | 5;
  pointsXP: number;
  prerequis?: string[];
  /** B.O. competences worked in this chapter */
  competences?: CompetenceBO[];
  contenu: ChapitreContenu;
  exercices?: Exercice[];
  prerequisDiagnostic?: {
    question: string;
    options: string[];
    correct: number;
    remediation: string;
  }[];
  ressourcesExt?: { label: string; url: string }[];
}

export interface Categorie {
  titre: string;
  icon: string;
  couleur: string;
  chapitres: Chapitre[];
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct: number;
  explication: string;
  categorie: string;
  difficulte?: 1 | 2 | 3;
}

// ─── XP & Gamification ──────────────────────────────────────────────────────

export interface NiveauEleve {
  nom: string;
  xpMin: number;
  badge: string;
}

// ─── Daily Challenge Pool ────────────────────────────────────────────────────

export interface DailyChallenge {
  id: string;
  question: string;
  reponse: string;
  categorie: string;
  xp: number;
}

// ─── Badge Definitions ───────────────────────────────────────────────────────

export interface BadgeDefinition {
  id: string;
  nom: string;
  description: string;
  icon: string;
  condition: string;
}

// ─── Legacy compat aliases (utilisés dans ChapitreContenu) ──────────────────

export interface ExerciceData {
  question: string;
  reponse: string;
  etapes: string[];
}

export interface TableauRow {
  f: string;
  derivee: string;
}

export interface CasRow {
  delta: string;
  solution: string;
}

// ─── Store Types (SRS) ───────────────────────────────────────────────────────

/** Hint level used: 0=none, 1=indice(-10%), 2=début(-30%), 3=correction(-100%) */
export type HintLevel = 0 | 1 | 2 | 3;

export type SRSQuality = 0 | 1 | 2 | 3 | 4 | 5;

export interface SRSItem {
  /** ISO date of next scheduled review */
  nextReview: string;
  /** Current interval in days */
  interval: number;
  /** SM-2 ease factor (default 2.5) */
  easeFactor: number;
  /** Number of consecutive correct reviews */
  repetitions: number;
}
