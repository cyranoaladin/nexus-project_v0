export type EamPremierePriority = "P0" | "P1" | "P2";
export type EamPremiereMissionStatus = "todo" | "in-progress" | "secured";

export interface EamPremiereCompetency {
  id: string;
  label: string;
  target: string;
  level: number;
  checkpoint: string;
}

export interface EamPremiereExercise {
  title: string;
  format: string;
  durationMinutes: number;
  expectedOutput: string;
}

export interface EamPremiereHomework {
  durationMinutes: number;
  tasks: string[];
  correctionMode: string;
}

export interface EamPremiereMission {
  id: string;
  sessionNumber: number;
  dateLabel: string;
  durationHours: number;
  title: string;
  objective: string;
  competencies: string[];
  exercises: EamPremiereExercise[];
  frequentMistakes: string[];
  deliverable: string;
  homework: EamPremiereHomework;
  priority: EamPremierePriority;
  allowedStatuses: EamPremiereMissionStatus[];
}

export interface EamPremiereWeekendDay {
  date: string;
  label: string;
  intent: string;
  actions: string[];
  forbidden: string[];
}

export interface EamPremiereMethod {
  id: string;
  title: string;
  rule: string;
  checklist: string[];
}

export interface EamPremiereMistake {
  id: string;
  domain: string;
  trap: string;
  repair: string;
}

export interface EamPremiereQcmItem {
  id: string;
  prompt: string;
  answer: string;
  correction: string;
  competency: string;
}
