import { z } from 'zod';

// Define Subject enum locally to avoid client/server mismatch
const Subject = {
  MATHEMATIQUES: 'MATHEMATIQUES',
  NSI: 'NSI',
  FRANCAIS: 'FRANCAIS',
  PHILOSOPHIE: 'PHILOSOPHIE',
  HISTOIRE_GEO: 'HISTOIRE_GEO',
  ANGLAIS: 'ANGLAIS',
  ESPAGNOL: 'ESPAGNOL',
  PHYSIQUE_CHIMIE: 'PHYSIQUE_CHIMIE',
  SVT: 'SVT',
  SES: 'SES'
} as const;

// Validation pour l'inscription (Bilan Gratuit)
export const bilanGratuitSchema = z.object({
  // Informations Parent
  parentFirstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  parentLastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  parentEmail: z.string().email('Email invalide'),
  parentPhone: z.string().min(8, 'Numéro de téléphone invalide'),
  parentPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),

  // Informations Élève
  studentFirstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  studentLastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  studentGrade: z.string().min(1, 'Veuillez sélectionner une classe'),
  studentSchool: z.string().optional(),
  studentBirthDate: z.string().optional(),

  // Besoins et objectifs
  subjects: z.array(z.enum(Object.values(Subject) as [string, ...string[]])).min(1, 'Sélectionnez au moins une matière'),
  currentLevel: z.string().min(1, 'Veuillez indiquer le niveau actuel'),
  objectives: z.string().min(10, 'Décrivez vos objectifs (minimum 10 caractères)'),
  difficulties: z.string().optional(),

  // Préférences
  preferredModality: z.enum(['online', 'presentiel', 'hybride']),
  availability: z.string().optional(),

  // Consentements
  acceptTerms: z.boolean().refine(val => val === true, 'Vous devez accepter les conditions'),
  acceptNewsletter: z.boolean().optional()
});

export type BilanGratuitData = z.infer<typeof bilanGratuitSchema>;

// Validation pour la connexion
export const signinSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis')
});

// Validation pour la réservation de session
export const sessionBookingSchema = z.object({
  coachId: z.string().optional(),
  subject: z.enum(Object.values(Subject) as [string, ...string[]]),
  type: z.enum(['COURS_ONLINE', 'COURS_PRESENTIEL', 'ATELIER_GROUPE']),
  scheduledAt: z.string().min(1, 'Date et heure requises'),
  duration: z.number().min(30).max(180),
  title: z.string().min(1, 'Titre requis'),
  description: z.string().optional()
}).refine((data) => {
  const selectedDate = new Date(data.scheduledAt);
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
  return selectedDate > twoHoursFromNow;
}, {
  message: "Session must be scheduled at least 2 hours in advance",
  path: ["scheduledAt"]
});

// Validation pour les messages ARIA
export const ariaMessageSchema = z.object({
  conversationId: z.string().optional(),
  subject: z.enum(Object.values(Subject) as [string, ...string[]]),
  content: z.string().min(1, 'Message requis').max(1000, 'Message trop long')
});

// Validation pour le feedback ARIA
export const ariaFeedbackSchema = z.object({
  messageId: z.string(),
  feedback: z.boolean()
});

// Validation pour le diagnostic Pallier 2 Maths
export const bilanPallier2MathsSchema = z.object({
  studentFirstName: z.string().min(1, 'Prénom requis'),
  studentLastName: z.string().min(1, 'Nom requis'),
  studentEmail: z.string().email('Email invalide'),
  studentPhone: z.string().min(8, 'Téléphone invalide'),
  establishment: z.string().optional(),
  teacherName: z.string().optional(),
  mathAverage: z.string().optional(),
  specialtyAverage: z.string().optional(),
  bacBlancResult: z.string().optional(),
  classRanking: z.string().optional(),
  
  algebra: z.array(z.object({
    skill: z.string(),
    level: z.number().min(0).max(4),
    comment: z.string()
  })),
  analysis: z.array(z.object({
    skill: z.string(),
    level: z.number().min(0).max(4),
    comment: z.string()
  })),
  geometry: z.array(z.object({
    skill: z.string(),
    level: z.number().min(0).max(4),
    comment: z.string()
  })),
  probabilities: z.array(z.object({
    skill: z.string(),
    level: z.number().min(0).max(4),
    comment: z.string()
  })),
  algorithms: z.array(z.object({
    skill: z.string(),
    level: z.number().min(0).max(4),
    comment: z.string()
  })),
  
  algebraOpenAnswer: z.string().optional(),
  analysisQuestion: z.string().optional(),
  geometryQuestion: z.string().optional(),
  probabilitiesQuestion: z.string().optional(),
  
  hasPythonEnvironment: z.boolean(),
  hasWorkedOnZeroSubjects: z.boolean(),
  
  mentalMathLevel: z.number().min(0).max(4),
  structuredProofLevel: z.number().min(0).max(4),
  speedWithoutCalculatorLevel: z.number().min(0).max(4),
  stressManagementLevel: z.number().min(0).max(4),
  
  mainRiskIdentified: z.string().optional(),
  
  comprehensionMethod: z.string().optional(),
  problemSolvingApproach: z.string().optional(),
  avgTimeToSolveExercise: z.string().optional(),
  weeklyWorkHours: z.string().optional(),
  attentionCapacity: z.number().min(0).max(4),
  
  targetMention: z.string().optional(),
  postBacProject: z.string().optional(),
  eliteTrainingInterest: z.string().optional(),
  acceptsDemandingPace: z.boolean(),
  
  improvementGoals: z.string().optional(),
  invisibleDifficulties: z.string().optional()
});

export type BilanPallier2MathsData = z.infer<typeof bilanPallier2MathsSchema>;

// Validation pour le diagnostic Pré-Stage Maths v1.3
// Aligné exactement sur le FormData du formulaire React (app/bilan-pallier2-maths/page.tsx)
const competencyItemSchema = z.object({
  skillId: z.string(),
  skillLabel: z.string(),
  status: z.enum(['studied', 'in_progress', 'not_studied', 'unknown']),
  mastery: z.number().min(0).max(4).nullable(),
  confidence: z.number().min(0).max(3).nullable(),
  friction: z.number().min(0).max(3).nullable(),
  errorTypes: z.array(z.string()),
  evidence: z.string()
});

export const bilanDiagnosticMathsSchema = z.object({
  version: z.string().optional(),
  submittedAt: z.string().optional(),
  identity: z.object({
    firstName: z.string().min(1, 'Prénom requis'),
    lastName: z.string().min(1, 'Nom requis'),
    birthDate: z.string().optional(),
    email: z.string().email('Email invalide'),
    phone: z.string().min(6, 'Téléphone invalide'),
    city: z.string().optional()
  }),
  schoolContext: z.object({
    establishment: z.string().optional(),
    mathTrack: z.string().optional(),
    mathTeacher: z.string().optional(),
    classSize: z.string().optional()
  }),
  performance: z.object({
    generalAverage: z.string().optional(),
    mathAverage: z.string().optional(),
    lastTestScore: z.string().optional(),
    classRanking: z.string().optional()
  }),
  chapters: z.object({
    chaptersStudied: z.string().optional(),
    chaptersInProgress: z.string().optional(),
    chaptersNotYet: z.string().optional()
  }),
  competencies: z.object({
    algebra: z.array(competencyItemSchema),
    analysis: z.array(competencyItemSchema),
    geometry: z.array(competencyItemSchema),
    probabilities: z.array(competencyItemSchema),
    python: z.array(competencyItemSchema),
    terminalAnticipation: z.array(competencyItemSchema).optional()
  }),
  openQuestions: z.object({
    algebraUnderstanding: z.string().optional(),
    canDemonstrateProductRule: z.string().optional(),
    probabilityQuestion: z.string().optional(),
    hardestAnalysisChapter: z.string().optional(),
    geometryMixedExercise: z.string().optional()
  }),
  examPrep: z.object({
    miniTest: z.object({
      score: z.number().min(0).max(6),
      timeUsedMinutes: z.number().min(0),
      completedInTime: z.boolean().nullable()
    }),
    selfRatings: z.object({
      speedNoCalc: z.number().min(0).max(4),
      calcReliability: z.number().min(0).max(4),
      redaction: z.number().min(0).max(4),
      justifications: z.number().min(0).max(4),
      stress: z.number().min(0).max(4)
    }),
    signals: z.object({
      hardestItems: z.array(z.number().min(1).max(6)),
      dominantErrorType: z.string().optional(),
      verifiedAnswers: z.boolean().nullable(),
      feeling: z.string().optional()
    }),
    zeroSubjects: z.string().optional(),
    mainRisk: z.string().optional()
  }),
  methodology: z.object({
    learningStyle: z.string().optional(),
    problemReflex: z.string().optional(),
    weeklyWork: z.string().optional(),
    maxConcentration: z.string().optional(),
    errorTypes: z.array(z.string()).optional()
  }),
  ambition: z.object({
    targetMention: z.string().optional(),
    postBac: z.string().optional(),
    pallier2Pace: z.string().optional()
  }),
  freeText: z.object({
    mustImprove: z.string().optional(),
    invisibleDifficulties: z.string().optional(),
    message: z.string().optional()
  })
});

export type BilanDiagnosticMathsData = z.infer<typeof bilanDiagnosticMathsSchema>;

// Backward compatibility alias
export const bilanPallier2MathsSchemaV2 = bilanDiagnosticMathsSchema;
export type BilanPallier2MathsDataV2 = BilanDiagnosticMathsData;
