export type SurvivalState = 'ACQUIS' | 'REVOIR' | 'PAS_VU';

export type ReflexMiniQuiz = {
  id: string;
  prompt: string;
  answer: string;
  distractors: string[];
  explanation: string;
};

export type SurvivalReflex = {
  id: `reflex_${number}`;
  order: number;
  title: string;
  hook: string;
  mentalImage: string;
  whenToUse: string[];
  method: string[];
  miniQuiz: ReflexMiniQuiz[];
  magicPhraseId: `phrase_${number}`;
  qcmPointsCovered: number;
};

export type PhraseMagique = {
  id: `phrase_${number}`;
  context: string;
  template: string;
  example: string;
};

export type QcmCategory = 'VERT' | 'ORANGE' | 'ROUGE';
export type QcmSource = 'sujet_0_v1' | 'sujet_0_v2' | 'simule';
export type QcmChoiceLetter = 'A' | 'B' | 'C' | 'D';

export type QcmQuestion = {
  id: string;
  number: number;
  source: QcmSource;
  category: QcmCategory;
  reflexId?: SurvivalReflex['id'];
  enonce: string;
  enonceLatex?: string;
  graphicAsset?: string;
  choices: { letter: QcmChoiceLetter; text: string; latex?: string }[];
  correctAnswer: QcmChoiceLetter;
  pedagogicalHint?: string;
  exclusionTip?: string;
};

export type SurvivalProgressSnapshot = {
  reflexesState: Record<string, SurvivalState>;
  phrasesState: Record<string, number>;
  qcmAttempts: number;
  qcmCorrect: number;
  rituals: Array<{ date: string; taskId: string; completed: boolean }>;
};

export type SurvivalRitual = {
  id: string;
  kind: 'REFLEX' | 'REVIEW' | 'QCM' | 'EXAM' | 'PHRASE' | 'GOLDEN_RULE';
  targetId: string;
  title: string;
  durationMinutes: number;
  description: string;
};
