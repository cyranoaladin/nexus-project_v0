export type LamisExerciseLevel = "facile" | "moyen" | "difficile";
export type LamisExerciseType = "qcm" | "number" | "text" | "justification";

export type LamisExercise = {
  id: string;
  day: 1 | 2;
  block: string;
  theme: string;
  level: LamisExerciseLevel;
  type: LamisExerciseType;
  statement: string;
  choices?: string[];
  correctAnswers: string[];
  tolerance?: number;
  hint1: string;
  hint2: string;
  correction: string;
  explanation: string;
  expectedTimeSeconds: number;
  competence: string;
};

export type LamisAttempt = {
  exerciseId: string;
  answer: string;
  isCorrect: boolean;
  attemptNumber: number;
  timeSpentSeconds: number;
  usedHint1: boolean;
  usedHint2: boolean;
  viewedCorrection: boolean;
  tooFast: boolean;
  timestamp: string;
};

export type LamisProgressSummary = {
  totalScore: number;
  answeredExerciseIds: string[];
  redoExerciseIds: string[];
  fastAttempts: LamisAttempt[];
  helpCount: number;
  correctionCount: number;
  totalTimeSeconds: number;
  successRate: number;
  scoreByTheme: Record<string, number>;
  attemptsByExercise: Record<string, LamisAttempt[]>;
  badges: string[];
};
