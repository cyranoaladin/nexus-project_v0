/** Modèle de données embarqué dans `index.html` : calculé à la construction, lu par `runtime.ts`. */
import type { AnswerCheck } from '../../../lib/espace/answer-check';
import type { FigureSpec } from '../../../lib/espace/lesson-types';

export type FbSegment = { kind: 'html'; html: string } | { kind: 'q' | 'f' | 'fig'; id: string } | { kind: 'code' };

export interface FbQuestion {
  id: string;
  textHtml: string;
  choicesHtml: string[];
  correct: number;
  /** Retour par choix : `feedbackByChoice[i]` = « message ciblé + explication » (ou l'explication seule). */
  feedbackByChoice: string[];
  /** Retour de la bonne réponse. */
  feedbackOk: string;
}

export interface FbField {
  id: string;
  labelHtml: string;
  placeholder?: string;
  input: 'line' | 'area';
  check?: AnswerCheck;
}

export interface FbStep {
  id: string;
  /** « 3. La pile » (libellé de navigation). */
  label: string;
  title: string;
  level: string;
  minutes: number;
  introHtml: string;
  taskHtml: string;
  takeawayHtml: string;
  hintsHtml: string[];
  printable: boolean;
  starter: string | null;
  segments: FbSegment[];
  /** Éléments que aucun jeton ne place (affichés après le cours). */
  rest: { figures: string[]; questions: string[]; code: boolean; fields: string[] };
  questions: FbQuestion[];
  fields: FbField[];
  figures: FigureSpec[];
}

export interface FbData {
  slug: string;
  version: string;
  title: string;
  session: string;
  duration: number;
  phases: boolean;
  /** Vrai si la leçon a un éditeur Python (et donc un harnais `runner.py` embarqué). */
  python: boolean;
  steps: FbStep[];
  /** Texte brut d'un retour dynamique (`evaluateAnswer`) → HTML avec formules déjà rendues. */
  richFeedback: Record<string, string>;
}
