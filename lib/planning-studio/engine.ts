/**
 * Moteur Nexus Planning Studio côté serveur.
 *
 * Le moteur métier de l'outil (normalisation, migration v1 → v2, contrôle
 * structurel, diagnostic des conflits) est écrit en JavaScript sans DOM dans
 * tools/planning-studio/assets. Il s'installe sur `globalThis.Nexus` : on le
 * charge ici par imports à effet de bord pour que le serveur applique
 * EXACTEMENT les mêmes règles que le navigateur — une seule source de vérité.
 */
import '@/tools/planning-studio/assets/core.js';
import '@/tools/planning-studio/assets/model.js';
import '@/tools/planning-studio/assets/validation.js';
import bootstrapPlanning from '@/tools/planning-studio/data/planning.default.json';

export type PlanningSeverity = 'error' | 'warning' | 'info';

export interface PlanningIssue {
  id: string;
  severity: PlanningSeverity;
  code: string;
  title: string;
  message: string;
  sessionIds: string[];
}

export interface PlanningSession {
  id: string;
  day: string;
  start: string;
  end: string;
  audience: string;
  level: string;
  subjectId: string;
  groupId: string;
  teacherId: string;
  roomId: string;
  title: string;
  active: boolean;
  notes: string;
}

export interface PlanningPayload {
  schemaVersion: number;
  meta: { title: string; updatedAt: string; source: string };
  settings: { academicYear: string; [key: string]: unknown };
  teachers: Array<{ id: string; code: string; name: string; active: boolean; [key: string]: unknown }>;
  rooms: Array<{ id: string; name: string; active: boolean; exceptional: boolean; [key: string]: unknown }>;
  subjects: Array<{ id: string; label: string; active: boolean; [key: string]: unknown }>;
  groups: Array<{ id: string; label: string; [key: string]: unknown }>;
  sessions: PlanningSession[];
}

export interface PlanningEngine {
  SCHEMA_VERSION: number;
  normalize(raw: unknown): PlanningPayload;
  validate(data: PlanningPayload): {
    issues: PlanningIssue[];
    counts: Record<PlanningSeverity, number>;
    bySession: Map<string, { severity: PlanningSeverity; issues: PlanningIssue[] }>;
  };
  inspectImport(raw: unknown): {
    ok: boolean;
    errors: string[];
    warnings: string[];
    summary: { sessions: number; teachers: number; rooms: number; subjects: number; groups: number; v1: boolean } | null;
  };
  isV1(raw: unknown): boolean;
}

export function getPlanningEngine(): PlanningEngine {
  const engine = (globalThis as { Nexus?: PlanningEngine }).Nexus;
  if (!engine || typeof engine.validate !== 'function' || typeof engine.normalize !== 'function') {
    throw new Error('PLANNING_ENGINE_UNAVAILABLE');
  }
  return engine;
}

/** Planning de démarrage livré avec l'application (schéma v2, 45 séances). */
export const PLANNING_BOOTSTRAP: unknown = bootstrapPlanning;

/** Année scolaire du document canonique courant. */
export const PLANNING_ACADEMIC_YEAR: string =
  (bootstrapPlanning as { settings?: { academicYear?: string } }).settings?.academicYear ?? '2026-2027';
