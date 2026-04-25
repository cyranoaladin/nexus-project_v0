import type { AcademicTrack, GradeLevel, StmgPathway, Subject } from '@prisma/client';
import type { StoredSurvivalProgress } from '@/lib/survival/progress';

// ─── Track progress ───────────────────────────────────────────────────────────

export type EleveTrackProgress = {
  totalXp: number;
  completedChapters: string[];
  masteredChapters: string[];
  totalChaptersInProgram: number;
  bestCombo: number;
  streak: number;
};

export type EleveTrackItem = {
  subject?: Subject;
  module?: string;
  label?: string;
  skillGraphRef: string;
  progress: EleveTrackProgress;
  diagnosticKey?: string;
  lastDiagnosticAt?: string;
};

// ─── Resources ────────────────────────────────────────────────────────────────

export type EleveResourceType =
  | 'USER_DOCUMENT'
  | 'COACH_RESOURCE'
  | 'RAG_REFERENCE'
  | 'INVOICE'
  | 'RECEIPT';

export type EleveResource = {
  id: string;
  type: EleveResourceType;
  title: string;
  subject?: Subject;
  description?: string;
  uploadedAt: string;
  /** Constructed as /api/student/documents/[id]/download */
  downloadUrl: string;
  sizeBytes?: number;
  mimeType?: string;
};

// ─── Bilans ───────────────────────────────────────────────────────────────────

export type EleveBilanStatus =
  | 'PENDING'
  | 'SCORING'
  | 'GENERATING'
  | 'COMPLETED'
  | 'FAILED';

export type EleveBilanType =
  | 'DIAGNOSTIC_PRE_STAGE'
  | 'ASSESSMENT_QCM'
  | 'STAGE_POST'
  | 'CONTINUOUS';

export type EleveBilanSubject =
  | 'MATHEMATIQUES'
  | 'MATHS_STMG'
  | 'NSI'
  | 'DROIT_ECO'
  | 'MANAGEMENT'
  | 'SGN'
  | 'MIXTE';

export type EleveBilan = {
  id: string;
  publicShareId: string;
  type: EleveBilanType;
  subject: EleveBilanSubject;
  /** Human-readable label, e.g. "Mathématiques STMG" */
  subjectLabel: string;
  status: EleveBilanStatus;
  globalScore: number | null;
  ssn: number | null;
  confidenceIndex: number | null;
  /** Extracted from analysisJson.trustLevel — null if not yet analyzed */
  trustLevel: 'high' | 'medium' | 'low' | null;
  /** Extracted from analysisJson.topPriorities — max 3 items, empty if not yet analyzed */
  topPriorities: string[];
  /**
   * true if parentsMarkdown is not null.
   * Only bilans with studentMarkdown IS NOT NULL are returned in this payload
   * (filtering audience=nexus happens server-side via SQL WHERE clause).
   */
  hasParentsRender: boolean;
  createdAt: string;
  /** /bilan-pallier2-maths/resultat/[publicShareId] */
  resultUrl: string;
};

// ─── Stages ───────────────────────────────────────────────────────────────────

export type EleveStageReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'WAITLISTED'
  | 'CANCELLED'
  | 'COMPLETED';

export type EleveStageItem = {
  stageId: string;
  stageSlug: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string | null;
  reservationId: string;
  reservationStatus: EleveStageReservationStatus;
  hasBilan: boolean;
  bilanUrl: string | null;
};

// ─── Alertes ─────────────────────────────────────────────────────────────────

export type EleveAlertSeverity = 'info' | 'warning' | 'critical';

export type EleveAlert = {
  id: string;
  severity: EleveAlertSeverity;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

// ─── Feuille de route ─────────────────────────────────────────────────────────

export type EleveFeuilleDeRouteItemType =
  | 'EXERCISE'
  | 'CHAPTER'
  | 'QCM'
  | 'REFLEX'
  | 'BILAN'
  | 'SESSION_BOOK'
  | 'RITUAL';

export type EleveFeuilleDeRouteItem = {
  id: string;
  type: EleveFeuilleDeRouteItemType;
  title: string;
  estimatedMinutes: number;
  priority: number;
  href: string;
  done: boolean;
};

// ─── Trajectory ───────────────────────────────────────────────────────────────

export type EleveTrajectoryMilestoneStatus = 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
export type EleveTrajectoryMilestoneCategory = 'BILAN' | 'STAGE' | 'BAC' | 'CUSTOM';

export type EleveTrajectoryMilestone = {
  id: string;
  title: string;
  description: string | null;
  targetDate: string;
  /** Derived server-side from completed + targetDate */
  status: EleveTrajectoryMilestoneStatus;
  /** Defaults to 'CUSTOM' if not stored in DB */
  category: EleveTrajectoryMilestoneCategory;
  completed: boolean;
  completedAt: string | null;
};

// ─── Automatismes ─────────────────────────────────────────────────────────────

export type EleveAutomatismesProgress = {
  totalAttempted: number;
  totalCorrect: number;
  accuracy: number;
  bestStreak: number;
  lastAttemptAt: string | null;
};

// ─── Dashboard root ───────────────────────────────────────────────────────────

export type EleveDashboardData = {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    grade: string;
    gradeLevel: GradeLevel;
    academicTrack: AcademicTrack;
    specialties: Subject[];
    stmgPathway: StmgPathway | null;
    survivalMode: boolean;
    survivalModeReason: string | null;
    school: string | null;
  };

  cockpit: {
    /** Session scheduled today (null if none) */
    seanceDuJour: EleveDashboardData['nextSession'];
    feuilleDeRoute: EleveFeuilleDeRouteItem[];
    alertes: EleveAlert[];
  };

  trackContent: {
    /** EDS only — empty array for STMG */
    specialties: EleveTrackItem[];
    /** STMG only — empty array for EDS */
    stmgModules: EleveTrackItem[];
  };

  sessionsCount: number;

  /** Next upcoming session (may be days away, distinct from seanceDuJour) */
  nextSession: {
    id: string;
    title: string;
    subject: string;
    scheduledAt: string;
    duration: number;
    coach: {
      firstName: string;
      lastName: string;
      pseudonym: string;
    } | null;
  } | null;

  recentSessions: Array<{
    id: string;
    title: string;
    subject: string;
    status: string;
    scheduledAt: string;
    coach: {
      firstName: string;
      lastName: string;
      pseudonym: string;
    } | null;
  }>;

  /** Most recent analyzed bilan (convenience alias of recentBilans[0]) */
  lastBilan: EleveBilan | null;
  /** Last 4 bilans with studentMarkdown — audience=nexus filtered server-side */
  recentBilans: EleveBilan[];

  upcomingStages: EleveStageItem[];
  pastStages: EleveStageItem[];

  resources: EleveResource[];

  ariaStats: {
    messagesToday: number;
    totalConversations: number;
    canUseAriaMaths: boolean;
    canUseAriaNsi: boolean;
  };

  badges: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    earnedAt: string;
  }>;

  trajectory: {
    /** null if no active trajectory */
    id: string | null;
    title: string | null;
    /** 0–100 based on milestones completed */
    progress: number;
    daysRemaining: number;
    milestones: EleveTrajectoryMilestone[];
    nextMilestoneAt: string | null;
  };

  /** null for STMG track (guard applied server-side AND client-side) */
  automatismes: EleveAutomatismesProgress | null;

  /** null unless STMG + PREMIERE + survivalMode active */
  survivalProgress: StoredSurvivalProgress | null;

  credits: {
    balance: number;
    nonExpiredCount: number;
    nextExpiryAt: string | null;
  };
};
