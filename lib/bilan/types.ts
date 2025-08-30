// lib/bilan/types.ts

export type BilanLevel = 'premiere' | 'terminale';
export type BilanStatut = 'scolarise_fr' | 'candidat_libre';

export type DomainKey =
  | 'Calcul litteral & equations'
  | 'Fonctions & graphes'
  | 'Geometrie vectorielle/reperee'
  | 'Trigonometrie'
  | 'Probabilites & statistiques'
  | 'Algorithmique & logique';

export interface QCMChoice {
  label: string; // e.g., "A", "B", "C", "D"
  text: string;
}

export interface QCMQuestion {
  id: string; // Q1..Q40
  domain: DomainKey;
  text: string;
  choices: QCMChoice[];
  correctIndex: number; // index in choices
  weight: number; // points of the question
}

export interface QCMAnswersPayload {
  [questionId: string]: number; // selected index
}

export interface DomainScore {
  domain: DomainKey;
  points: number;
  max: number;
  percent: number; // 0..100
}

export interface QCMScores {
  byDomain: Record<string, DomainScore>;
  scoreGlobal: number;
  weakDomains: number; // count where percent < 50
}

export interface PedagoProfile {
  style?: string;
  organisation?: string;
  rythme?: string;
  motivation?: string;
  difficultes?: string;
  attentes?: string;
}

export interface Synthesis {
  forces: string[];
  faiblesses: string[];
  feuilleDeRoute: string[];
  text?: string; // full report body (optional)
}

export interface Offers {
  primary: string;
  alternatives: string[];
  reasoning: string;
}

export interface BilanPdfData {
  eleve: { firstName?: string; lastName?: string; niveau?: string; statut?: string };
  createdAt?: string; // ISO
  scoresByDomain: Array<{ domain: string; percent: number }>;
  forces: string[];
  faiblesses: string[];
  feuilleDeRoute: string[];
  offrePrincipale?: string;
  offreReasoning?: string;
  alternatives?: string[];
}

