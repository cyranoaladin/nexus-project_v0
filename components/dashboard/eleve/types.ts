import type { AcademicTrack, GradeLevel, StmgPathway, Subject } from '@prisma/client';

export type EleveTrackProgress = {
  totalXp: number;
  completedChapters: string[];
};

export type EleveTrackItem = {
  subject?: Subject;
  module?: string;
  label?: string;
  skillGraphRef: string;
  progress: EleveTrackProgress;
};

export type EleveDashboardData = {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    grade: string;
    gradeLevel?: GradeLevel | string;
    academicTrack?: AcademicTrack | string;
    specialties?: Subject[];
    stmgPathway?: StmgPathway | null;
    school: string | null;
  };
  cockpit?: {
    seanceDuJour?: unknown | null;
    feuilleDeRoute?: unknown[];
    prochaineSession?: unknown | null;
    alertes?: unknown[];
  };
  trackContent?: {
    specialties?: EleveTrackItem[];
    stmgModules?: EleveTrackItem[];
  };
  sessionsCount?: number;
  lastBilan?: unknown | null;
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
  ariaStats: {
    messagesToday: number;
    totalConversations: number;
  };
  badges: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    earnedAt: string;
  }>;
};
