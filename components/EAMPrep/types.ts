export interface Formula {
  title: string;
  content: string;
}

export interface Question {
  q: string;
  r: string[];
  c: number;
  ex: string;
}

export interface EAMModule {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  tag: "INCONTOURNABLE" | "HAUTE PRIORITÉ" | "MOYEN";
  formules: Formula[];
  methodes: string[];
  errors: string[];
  questions: Question[];
  checklist: string[];
}

export interface PlanDay {
  date: string; // ISO YYYY-MM-DD, utilisé pour recalculer J-X et "aujourd'hui".
  label?: string;
  focus: string;
  tip: string;
  color: string;
  final?: boolean;
}

export interface StageSession {
  id: string;
  date: string; // ISO YYYY-MM-DD, éditable par l'enseignant.
  title: string;
  durationMin: 120;
  objectifs: string[];
  deroule: Array<{
    tranche: string;
    activite: string;
    moduleIds: string[];
  }>;
  moduleIds: string[];
  livrables: string[];
  interSeance: string[];
}

export interface WeekendProtocolDay {
  id: "J-2" | "J-1" | "J-0";
  date: string;
  title: string;
  intention: string;
  actions: string[];
}
