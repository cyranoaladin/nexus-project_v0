// Types for Bilan Diagnostic Maths Terminale EDS

export type PedagogicalStatus =
  | 'Non renseigné'
  | 'Non encore vu'
  | 'Découverte prioritaire'
  | 'Déclaré vu mais non évalué'
  | 'Non vu déclaré, réussite observée'
  | 'Lacune critique'
  | 'Très fragile'
  | 'Fragile'
  | 'À consolider'
  | 'Maîtrisé'
  | 'Point fort';

export interface Domain {
  id: string;
  title: string;
  order: number;
}

export interface Chapter {
  id: string;
  domainId: string;
  title: string;
  bacPriority: number;
  isCore: boolean;
}

export interface QcmQuestion {
  id: string;
  chapterId: string;
  skillType: string;
  difficulty: number;
  bacPriority: number;
  skillTag: string;
  statement: string;
  choices: string[];
  correct: number;
  explanation: string;
}

export interface OpenQuestion {
  id: string;
  chapterIds: string[];
  title: string;
  maxPoints: number;
  statement: string;
  rubrics: Array<{ label: string; points: number }>;
}

export interface DiscoveryCluster {
  id: string;
  title: string;
  ids: string[];
}

export interface ChapterProgress {
  declared: number | null; // 0=not seen, 1-5=level
  confidence: number; // 1-5
}

export interface OpenAnswer {
  text: string;
  status: string; // "Je sais faire" | "Je sais commencer mais je bloque" | "Je ne sais pas démarrer"
}

export interface TeacherGrade {
  score: number | '';
  comment: string;
  errors: string[];
  mode: 'global' | 'detailed';
  criteria: Record<number, number | ''>;
}

export interface ChapterResult {
  chapterId: string;
  domainId: string;
  title: string;
  domainTitle: string;
  declared: number | null;
  confidence: number | null;
  percentage: number | null;
  isEvaluated: boolean;
  pedagogicalStatus: PedagogicalStatus;
  priorityScore: number;
  isIllusion: boolean;
  lacksConfidence: boolean;
  declaredNotSeenButSucceeded: boolean;
}

export interface DiagnosticResult {
  chapterResults: ChapterResult[];
  domainScores: Record<string, number>;
  qcmRawScore: number;
  qcmMaxScore: number;
  qcmPercentage: number;
  qcmDontKnowCount: number;
  qcmUnansweredCount: number;
  openRawScore: number;
  openMaxScore: number;
  openPercentage: number | null;
  globalRawScore: number;
  globalMaxScore: number;
  globalPercentage: number;
  isProvisional: boolean;
  calculatedProfile: { label: string; desc: string };
}

export interface SessionPlan {
  num: number;
  duration: string;
  type: string;
  title: string;
  objectives: string[];
  skills: string[];
  activities: string[];
  homework: string;
  criteria: string;
  writtenTrace: string;
  oralCheck: string;
  chapters: string[];
  teacherNotes: string;
}

export interface WeekPlan {
  week: string;
  title: string;
  desc: string;
  deliverable?: string;
}

export interface Recommendation {
  type: 'alerte' | 'urgence' | 'info' | 'succes';
  title: string;
  text: string;
}

// What gets stored in Bilan.sourceData
export interface DiagnosticSourceData {
  version: string;
  progress: Record<string, ChapterProgress>;
  qcmAnswers: Record<string, number>;
  openAnswers: Record<string, OpenAnswer>;
  teacherGrades: Record<string, TeacherGrade>;
  isTeacherGraded: boolean;
  evaluatedData: DiagnosticResult | null;
  step: string;
}
