import { z } from 'zod';

export const COACH_EAF_SOURCE_VERSION = 'coach_eaf_stage_printemps_v1';
export const STUDENT_EAF_SOURCE_VERSION = 'eaf_stage_printemps_v1';
export const EAF_BILAN_TYPE = 'STAGE_POST' as const;
export const EAF_BILAN_SUBJECT = 'FRANCAIS';
export const STAGE_SLUG = 'stage-printemps-2026';

export const COACH_EAF_META = {
  source: 'coach' as const,
  questionnaireSlug: 'coach-eaf-stage-printemps-parent-report',
  questionnaireVersion: 1,
  stageSlug: STAGE_SLUG,
  level: 'PREMIERE',
  subject: 'FRANCAIS',
} as const;

// Rating scale 1-5
const optionalRating = z.number().int().min(1).max(5).optional();

// Section 1 — Présence et implication
export const attendanceAndEngagementSchema = z.object({
  attendance: z.enum(['excellente', 'reguliere', 'irreguliere', 'insuffisante']).optional(),
  punctuality: z.enum(['tres-satisfaisante', 'satisfaisante', 'a-ameliorer']).optional(),
  involvement: optionalRating,
  concentration: optionalRating,
  oralParticipation: optionalRating,
  attitudeToDifficulty: z.enum([
    'perseverant',
    'volontaire-mais-hesitant',
    'manque-de-confiance',
    'se-decourage-rapidement',
    'besoin-detre-guide',
  ]).optional(),
  coachComment: z.string().max(2000).optional(),
});

// Section 2 — Compréhension des attentes de l'EAF
export const examExpectationsSchema = z.object({
  understandsWrittenExam: optionalRating,
  distinguishesAnalysisAndSummary: optionalRating,
  quoteVsAnalysis: optionalRating,
  subjectRequirements: optionalRating,
  avoidsOffTopic: optionalRating,
  successCriteria: optionalRating,
  coachComment: z.string().max(2000).optional(),
});

// Section 3 — Commentaire de texte
export const commentarySchema = z.object({
  textUnderstanding: optionalRating,
  textIssues: optionalRating,
  readingProject: optionalRating,
  relevantQuotes: optionalRating,
  processAnalysis: optionalRating,
  interpretation: optionalRating,
  organization: optionalRating,
  paragraphs: optionalRating,
  transitions: optionalRating,
  noParaphrase: optionalRating,
  strengths: z.string().max(2000).optional(),
  difficulties: z.string().max(2000).optional(),
  priority: z.string().max(500).optional(),
});

// Section 4 — Dissertation
export const dissertationSchema = z.object({
  subjectUnderstanding: optionalRating,
  keywordsAnalysis: optionalRating,
  problematique: optionalRating,
  progressivePlan: optionalRating,
  arguments: optionalRating,
  workMobilization: optionalRating,
  examplesUse: optionalRating,
  answersSubject: optionalRating,
  introduction: optionalRating,
  conclusion: optionalRating,
  strengths: z.string().max(2000).optional(),
  difficulties: z.string().max(2000).optional(),
  priority: z.string().max(500).optional(),
});

// Section 5 — Expression écrite
export const writingSchema = z.object({
  sentenceClarity: optionalRating,
  grammar: optionalRating,
  spelling: optionalRating,
  lexicalPrecision: optionalRating,
  literaryVocabulary: optionalRating,
  fluency: optionalRating,
  paragraphStructure: optionalRating,
  ideaExplanation: optionalRating,
  timedWriting: optionalRating,
  observations: z.string().max(2000).optional(),
  frequentErrors: z.string().max(2000).optional(),
  recommendations: z.string().max(2000).optional(),
});

// Section 6 — Autonomie et méthode de travail
export const autonomyAndMethodSchema = z.object({
  autonomy: optionalRating,
  methodApplication: optionalRating,
  errorCorrection: optionalRating,
  correctionReuse: optionalRating,
  timeManagement: optionalRating,
  personalWorkRegularity: optionalRating,
  revisionOrganization: optionalRating,
  observedMethod: z.string().max(2000).optional(),
  advice: z.string().max(2000).optional(),
});

// Section 7 — Progression observée
const skillChoice = z.enum([
  'comprehension-des-textes',
  'analyse-des-citations',
  'construction-du-plan',
  'redaction',
  'dissertation',
  'commentaire',
  'gestion-du-temps',
  'confiance',
  'methode',
]);

export const progressSchema = z.object({
  globalProgress: z.enum([
    'tres-nette',
    'nette',
    'moderee',
    'legere',
    'insuffisante',
  ]).optional(),
  mostImprovedSkill: skillChoice.optional(),
  prioritySkill: skillChoice.optional(),
  observedProgressComment: z.string().max(2000).optional(),
});

// Section 8 — Recommandations aux parents
export const parentRecommendationsSchema = z.object({
  estimatedCurrentLevel: z.enum([
    'tres-solide',
    'satisfaisant',
    'fragile-mais-en-progres',
    'fragile',
    'preoccupant',
  ]).optional(),
  recommendedFollowUp: z.enum([
    'autonomie-suffisante',
    'consolidation-ponctuelle',
    'accompagnement-regulier',
    'entrainement-intensif',
  ]).optional(),
  priorityAxes: z.array(z.enum([
    'commentaire',
    'dissertation',
    'redaction',
    'grammaire',
    'vocabulaire',
    'lecture-analytique',
    'references-litteraires',
    'gestion-du-temps',
    'methode-de-revision',
    'confiance-a-lecrit',
  ])).optional(),
  parentSummaryMessage: z.string().optional(),
  finalRecommendation: z.string().max(2000).optional(),
});

// Full coach bilan form schema
export const coachEafBilanSchema = z.object({
  action: z.enum(['draft', 'complete']).default('draft'),
  attendanceAndEngagement: attendanceAndEngagementSchema.optional().default({}),
  examExpectations: examExpectationsSchema.optional().default({}),
  commentary: commentarySchema.optional().default({}),
  dissertation: dissertationSchema.optional().default({}),
  writing: writingSchema.optional().default({}),
  autonomyAndMethod: autonomyAndMethodSchema.optional().default({}),
  progress: progressSchema.optional().default({}),
  parentRecommendations: parentRecommendationsSchema.optional().default({}),
});

export type CoachEafBilanFormData = z.infer<typeof coachEafBilanSchema>;
export type AttendanceAndEngagement = z.infer<typeof attendanceAndEngagementSchema>;
export type ExamExpectations = z.infer<typeof examExpectationsSchema>;
export type Commentary = z.infer<typeof commentarySchema>;
export type Dissertation = z.infer<typeof dissertationSchema>;
export type Writing = z.infer<typeof writingSchema>;
export type AutonomyAndMethod = z.infer<typeof autonomyAndMethodSchema>;
export type Progress = z.infer<typeof progressSchema>;
export type ParentRecommendations = z.infer<typeof parentRecommendationsSchema>;

export type CoachEafSourceData = {
  meta: typeof COACH_EAF_META & {
    studentId: string;
    coachId: string;
    savedAt?: string;
    completedAt?: string;
  };
  attendanceAndEngagement: AttendanceAndEngagement;
  examExpectations: ExamExpectations;
  commentary: Commentary;
  dissertation: Dissertation;
  writing: Writing;
  autonomyAndMethod: AutonomyAndMethod;
  progress: Progress;
  parentRecommendations: ParentRecommendations;
};

// Summary from student questionnaire (read-only, for coach reference)
export type StudentEafSummary = {
  beforeConfidence?: string;
  afterConfidence?: string;
  beforeStress?: string;
  afterStress?: string;
  bestProgress?: string;
  priorityWork?: string;
  finalMessage?: string;
  progressFeeling?: string;
  submittedAt?: string;
};

export type CoachBilanStatus = 'NOT_STARTED' | 'DRAFT' | 'COMPLETED' | 'VALIDATED';

export type StudentWithBilanStatus = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gradeLevel?: string;
  academicTrack?: string;
  school?: string;
  bilanStatus: CoachBilanStatus;
  bilanId?: string;
  lastSavedAt?: string;
  completedAt?: string;
};
