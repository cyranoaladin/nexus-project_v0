/**
 * Machine d'états d'un travail d'élève.
 *
 *   DRAFT ──SAVE──▶ IN_PROGRESS ──SUBMIT──▶ SUBMITTED ──MARK_CORRECTED──▶ CORRECTED ──MARK_DONE──▶ DONE
 *                        ▲                       │                            │                      │
 *                        │                       └──────────REOPEN────────────┴──────────────────────┘
 *                  (REOPENED ──SAVE──▶ REOPENED ──SUBMIT──▶ SUBMITTED)
 *
 * Politique : après la remise l'élève est en lecture seule ; seul l'enseignant
 * peut rouvrir (« à reprendre »). L'enseignant ne modifie jamais le contenu.
 */
export type WorkStatus = 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'CORRECTED' | 'REOPENED' | 'DONE';
export type WorkAction = 'SAVE' | 'SUBMIT' | 'MARK_CORRECTED' | 'REOPEN' | 'MARK_DONE';
export type WorkActor = 'STUDENT' | 'TEACHER';

export class WorkTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION';
  constructor(
    readonly from: WorkStatus,
    readonly action: WorkAction,
  ) {
    super(`Transition interdite : ${action} depuis ${from}`);
    this.name = 'WorkTransitionError';
  }
}

const TABLE: Record<WorkAction, Partial<Record<WorkStatus, WorkStatus>>> = {
  SAVE: { DRAFT: 'IN_PROGRESS', IN_PROGRESS: 'IN_PROGRESS', REOPENED: 'REOPENED' },
  SUBMIT: { IN_PROGRESS: 'SUBMITTED', REOPENED: 'SUBMITTED' },
  MARK_CORRECTED: { SUBMITTED: 'CORRECTED' },
  REOPEN: { SUBMITTED: 'REOPENED', CORRECTED: 'REOPENED', DONE: 'REOPENED' },
  MARK_DONE: { CORRECTED: 'DONE' },
};

export function applyAction(from: WorkStatus, action: WorkAction): WorkStatus {
  const to = TABLE[action][from];
  if (!to) throw new WorkTransitionError(from, action);
  return to;
}

/** Statuts de départ autorisés pour une action (pour les mises à jour conditionnelles). */
export function fromStatusesFor(action: WorkAction): WorkStatus[] {
  return Object.keys(TABLE[action]) as WorkStatus[];
}

export function actorFor(action: WorkAction): WorkActor {
  return action === 'SAVE' || action === 'SUBMIT' ? 'STUDENT' : 'TEACHER';
}

export function isStudentEditable(status: WorkStatus): boolean {
  return TABLE.SAVE[status] !== undefined;
}

const STUDENT_LABELS: Record<WorkStatus, string> = {
  DRAFT: 'Pas commencé',
  IN_PROGRESS: 'En cours',
  SUBMITTED: 'Remis',
  CORRECTED: 'Corrigé',
  REOPENED: 'À reprendre',
  DONE: 'Terminé',
};

const TEACHER_LABELS: Record<WorkStatus, string> = {
  DRAFT: 'Pas commencé',
  IN_PROGRESS: 'En cours',
  SUBMITTED: 'À corriger',
  CORRECTED: 'Corrigé',
  REOPENED: 'À reprendre',
  DONE: 'Terminé',
};

export function statusLabelForStudent(status: WorkStatus): string {
  return STUDENT_LABELS[status];
}

export function statusLabelForTeacher(status: WorkStatus): string {
  return TEACHER_LABELS[status];
}
