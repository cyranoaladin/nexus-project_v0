export type AutomatismeDomain =
  | "calcul_numerique"
  | "calcul_algebrique"
  | "fractions_puissances"
  | "proportions_pourcentages"
  | "evolutions"
  | "fonctions_representations"
  | "lecture_graphique"
  | "second_degre"
  | "statistiques"
  | "probabilites"
  | "derivation"
  | "suites"
  | "exponentielle"
  | "geometrie_reperee"
  | "produit_scalaire"
  | "trigonometrie";

export type AutomatismeQuestion = {
  id: string;
  seriesId: string;
  questionNumber: number;
  domain: AutomatismeDomain;
  skillTag: string;
  difficulty: 1 | 2 | 3;
  sourceReference: string;
  sourceComment: string;
  statement: string;
  choices: {
    id: "A" | "B" | "C" | "D";
    text: string;
  }[];
  correctChoiceId: "A" | "B" | "C" | "D";
  feedbackCorrect: string;
  feedbackWrong: string;
  method: string;
  trap: string;
  remediation: string;
};

export type SafeAutomatismeQuestion = Omit<
  AutomatismeQuestion,
  "correctChoiceId" | "feedbackCorrect" | "feedbackWrong" | "method" | "trap" | "remediation" | "sourceReference" | "sourceComment"
>;

export type AutomatismeSeries = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  grade: "PREMIERE";
  subject: "MATHEMATIQUES_EDS";
  examType: "EPREUVE_ANTICIPEE";
  format: "QCM_12_QUESTIONS";
  recommendedDurationMinutes: number;
  calculatorAllowed: false;
  questions: AutomatismeQuestion[];
};

export type SafeAutomatismeSeries = Omit<AutomatismeSeries, "questions"> & {
  questions: SafeAutomatismeQuestion[];
};

export type AutomatismeAttemptResult = {
  score: number;
  totalQuestions: number;
  scoreSur6: number;
  percentage: number;
  duration: number;
  averageTimePerQuestion: number;
  domainPerformance: Record<AutomatismeDomain, { correct: number; total: number; percentage: number }>;
  weaknesses: string[];
  strengths: string[];
  recommendation: string;
  sourceReferences: string[];
  answers: Record<string, string>;
};
