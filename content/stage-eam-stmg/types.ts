export type DomainId =
  | "fonctions"
  | "derivation"
  | "suites"
  | "statistiques"
  | "probabilites"
  | "algorithmique-tableur";

export type ExerciseEvaluation = "acquired" | "partial" | "not_acquired";

export interface Domain {
  id: DomainId;
  label: string;
  shortLabel: string;
  description: string;
  notions: string[];
  methods: string[];
  traps: string[];
  formulas: Array<{ label: string; latex: string }>;
}

export interface AutomatismItem {
  id: string;
  domainId: DomainId;
  notion: string;
  question: string;
  choices: string[];
  answerIndex: number;
  correction: string;
}

export interface CourseSheet {
  domainId: DomainId;
  title: string;
  blocks: Array<{ title: string; lines: string[] }>;
}

export interface TrainingExercise {
  id: string;
  domainId: DomainId;
  title: string;
  statement: string[];
  questions: string[];
  correction: Array<{ title: string; details: string[] }>;
}

export interface DiagnosticExercise {
  id: string;
  title: string;
  domainIds: DomainId[];
  statement: string[];
  rubric: Array<{ domainId: DomainId; label: string }>;
}

export interface DiagnosticAnswers {
  qcm: Record<string, number>;
  exercises: Record<string, ExerciseEvaluation>;
}

export interface DomainScore {
  domainId: DomainId;
  score: number;
  qcmScore: number;
  exerciseScore: number;
}

export interface DiagnosticProfile {
  diagnosticDate: string;
  domainScores: DomainScore[];
  priorities: DomainId[];
}

export interface PlanningDay {
  id: "j0" | "j1" | "j2" | "j3" | "j4" | "j5" | "we" | "jour-j";
  label: string;
  date: string;
  objective: string;
  domainIds: DomainId[];
  automatismes: string;
  exercises: string;
  homework: string;
}
