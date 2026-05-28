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
  date: string;
  label: string;
  focus: string;
  tip: string;
  color: string;
  today?: boolean;
  final?: boolean;
}
