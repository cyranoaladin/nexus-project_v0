// Types for NSI Pratique 2026 module

export type SubjectDifficulty = 'facile' | 'moyen' | 'difficile' | 'expert';

export type SubjectFamily =
  | 'listes'
  | 'dictionnaires'
  | 'CSV'
  | 'JSON'
  | 'POO'
  | 'KNN'
  | 'recursivite'
  | 'binaire'
  | 'SQL'
  | 'image'
  | 'simulation'
  | 'dates'
  | 'seuils'
  | 'trames';

export type TrainingTaskType = 'code' | 'oral' | 'quiz' | 'memory' | 'debug';

export type SubjectStatus =
  | 'not_started'
  | 'read'
  | 'coded'
  | 'tested'
  | 'explained'
  | 'mastered'
  | 'needs_review';

export interface ExaminerQuestion {
  question: string;
  expectedAnswer: string;
}

export interface TrainingTask {
  type: TrainingTaskType;
  prompt: string;
  expectedElements: string[];
}

export interface NsiSubject {
  id: number;
  slug: string;
  title: string;
  shortTitle: string;
  family: string;
  difficulty: SubjectDifficulty;
  estimatedTimeMinutes: number;
  examTimeMinutes: number;
  files: {
    main?: string;
    pdf?: string;
    python?: string[];
    data?: string[];
    images?: string[];
    database?: string[];
    other?: string[];
  };
  concepts: string[];
  patterns: number[];
  mnemonic: string;
  verbalAlgorithm: string[];
  commonTraps: string[];
  examinerQuestions: ExaminerQuestion[];
  trainingTasks: TrainingTask[];
  revisionProtocol: string;
}

export interface NsiPattern {
  id: number;
  title: string;
  whenToUse: string;
  mnemonic: string;
  code: string;
  relatedSubjects: number[];
  traps: string[];
}

export interface FiveDayTask {
  label: string;
  subjectIds?: number[];
  type: 'new' | 'review' | 'timed' | 'oral' | 'patterns' | 'mnemonics' | 'mock' | 'read';
}

export interface FiveDaySlot {
  period: string;
  duration: string;
  tasks: FiveDayTask[];
}

export interface FiveDay {
  day: string;
  label: string;
  theme: string;
  slots: FiveDaySlot[];
}

export interface OralQuestion {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface SelfAssessmentItem {
  id: string;
  label: string;
  description: string;
}

// Progress types
export interface SubjectProgress {
  status: SubjectStatus;
  lastWorkedAt?: string;
  oralExplained?: boolean;
  trapsUnderstood?: boolean;
  notes?: string;
}

export interface PatternProgress {
  mastered: boolean;
  writtenByHand: boolean;
  lastPracticedAt?: string;
}

export interface FlashcardProgress {
  level: number; // 0-4 Leitner
  lastReviewedAt?: string;
}

export interface FiveDayTaskProgress {
  completed: boolean;
}

export interface SelfAssessmentProgress {
  status: 'ok' | 'needs_review' | 'not_assessed';
  note?: string;
}

export interface NsiProgress {
  subjects: Record<number, SubjectProgress>;
  patterns: Record<number, PatternProgress>;
  flashcards: Record<string, FlashcardProgress>;
  fiveDayPlan: Record<string, FiveDayTaskProgress>;
  selfAssessment: Record<string, SelfAssessmentProgress>;
  mockExams: MockExamResult[];
  oralPhrases: Record<number, OralFourPhrases>;
}

export interface MockExamResult {
  subjectId: number;
  date: string;
  completedSteps: string[];
  selfScore?: number;
  notes?: string;
}

export interface OralFourPhrases {
  contract: string;
  strategy: string;
  edgeCase: string;
  test: string;
  markedAsExplained: boolean;
}
