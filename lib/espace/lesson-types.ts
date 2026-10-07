/**
 * Contrat de contenu d'une leçon guidée (TP NSI, parcours de maths).
 *
 * Le TP 1 (« Des objets qui agissent ») est un cas particulier de ce schéma :
 * tous les ajouts sont OPTIONNELS, un contenu qui ne les utilise pas se
 * comporte exactement comme avant.
 *
 * Le champ `lesson` est du HTML de confiance (dépôt) ; jamais du texte d'élève.
 * Les formules s'écrivent `\( … \)` (en ligne) et `\[ … \]` (centrées) : elles
 * sont rendues avec KaTeX dans TOUT texte de leçon (cours, questions, choix,
 * consignes, indices, retours).
 *
 * Intercalation : dans `lesson`, les jetons suivants placent un élément à
 * l'endroit voulu (alternance explication / essai) :
 *   {{q:ID}}   une question à choix       {{f:ID}}   un champ de réponse
 *   {{fig:ID}} une figure                 {{code}}   l'éditeur + exécution
 * Ce qui n'est pas placé par un jeton est affiché après le cours, dans cet
 * ordre : figures, questions, éditeur, champs.
 */
import type { AnswerCheck } from './answer-check';

export interface LessonQuestion {
  id: string;
  text: string;
  choices: string[];
  /** Indice de la bonne réponse. */
  correct: number;
  /** Explication affichée après toute réponse. */
  feedback: string;
  /** Message ciblé par choix (même longueur que `choices`) : pourquoi CE choix est tentant et faux. */
  choiceFeedback?: string[];
}

export interface LessonField {
  id: string;
  label: string;
  placeholder?: string;
  /** `line` : une ligne (réponse courte) ; `area` (défaut) : justification. */
  input?: 'line' | 'area';
  /** Si présent : un bouton « Vérifier » donne un retour pédagogique immédiat. */
  check?: AnswerCheck;
}

/** Fonction tracée : coefficients par puissances croissantes (`[1, 2]` = 1 + 2x). */
export type FunctionSpec =
  | { kind: 'polynomial'; coeffs: number[] }
  | { kind: 'rational'; num: number[]; den: number[] };

export interface FunctionFigureSpec {
  type: 'function';
  id: string;
  caption?: string;
  /** Nom de la courbe dans la légende, ex. « C_g ». */
  curveLabel?: string;
  fn: FunctionSpec;
  window: { xmin: number; xmax: number; ymin: number; ymax: number };
  verticalAsymptotes?: number[];
  horizontalAsymptotes?: number[];
  /** Points marqués sur la courbe (ordonnée calculée). */
  points?: { x: number; label?: string }[];
  /** Trace la tangente en cette abscisse (calculée, dérivée exacte). */
  tangentAt?: number;
  /** Id d'un champ (de la même étape) contenant une équation `y = ax + b` saisie par l'élève : tracée en pointillés. */
  overlayFieldId?: string;
  /** Masque la courbe (l'élève doit deviner son allure). */
  hideCurve?: boolean;
}

export interface StructureSimSpec {
  type: 'structure-sim';
  id: string;
  caption?: string;
  mode: 'liste' | 'pile' | 'file';
  initial?: string[];
}

export interface StaticSvgSpec {
  type: 'svg';
  id: string;
  caption?: string;
  /** Texte alternatif obligatoire (accessibilité). */
  alt: string;
  /** SVG de confiance (dépôt), en `currentColor` pour suivre le thème. */
  svg: string;
}

/** Trace pas à pas d'un calcul récursif : APPEL / RETOUR et pile d'appels (modèle : lib/espace/recursion-trace.ts). */
export interface CallTraceSpec {
  type: 'call-trace';
  id: string;
  caption?: string;
  fn: 'somme' | 'factorielle' | 'puissance' | 'fibonacci';
  /** Paramètres initiaux (modifiables par l'élève dans des bornes sûres). */
  args: number[];
}

export type FigureSpec = FunctionFigureSpec | StructureSimSpec | StaticSvgSpec | CallTraceSpec;

export interface LessonStep {
  id: string;
  short: string;
  title: string;
  minutes: number;
  level: string;
  concepts: string[];
  intro: string;
  lesson: string;
  task: string;
  /** Code de départ ; `null` pour une étape sans éditeur. */
  starter: string | null;
  questions: LessonQuestion[];
  fields: LessonField[];
  hints: string[];
  takeaway: string;
  /** Intitulés des contrôles formatifs automatiques de l'étape. */
  tests: string[];
  figures?: FigureSpec[];
  /** Fiche de synthèse imprimable. */
  printable?: boolean;
}

export interface LessonContent {
  version: string;
  title: string;
  subtitle?: string;
  session: string;
  /** Durée indicative en minutes (étapes obligatoires). */
  duration: number;
  /** `phases` : affiche la hiérarchie Je comprends / J'observe / J'essaie / Je vérifie / Je retiens. */
  ui?: { phases?: boolean };
  /** Compétences que l'enseignant peut annoter sur le travail d'un élève (annotations existantes, aucun nouveau stockage). */
  skills?: { id: string; label: string; steps: string[] }[];
  steps: LessonStep[];
}
