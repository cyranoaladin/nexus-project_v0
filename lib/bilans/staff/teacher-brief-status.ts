import type { TeacherBriefStatus } from '@prisma/client';

/**
 * Regroupements NOMMÉS et distincts des statuts de brief enseignant.
 *
 * Avant ce module, une unique liste `['PENDING_REVIEW', 'APPROVED']` servait
 * à la fois à bloquer une régénération, à compter un brief "existant" et à
 * décider ce qui pouvait être rendu à l'enseignant — trois questions
 * différentes qui n'ont PAS la même réponse. Cette confusion est la cause
 * directe de l'incident P0 : un brief PENDING_REVIEW (jamais relu par un
 * humain) était rendu dans le dossier enseignant au même titre qu'un brief
 * APPROVED.
 *
 * Règle : SEUL `APPROVED` appartient à `BRIEF_STATUSES_SAFE_FOR_TEACHER`.
 * Aucun autre module ne doit redéclarer une liste de statuts de brief.
 */

/** Empêche une régénération redondante — `generateTeacherBrief` retourne ALREADY_PRESENT sur ces statuts. */
export const BRIEF_STATUSES_BLOCKING_DUPLICATE_GENERATION: readonly TeacherBriefStatus[] = Object.freeze([
  'PENDING_REVIEW',
  'APPROVED',
]);

/** Un humain doit agir : relire (PENDING_REVIEW) ou reprendre une correction. */
export const BRIEF_STATUSES_PENDING_HUMAN_ACTION: readonly TeacherBriefStatus[] = Object.freeze([
  'PENDING_REVIEW',
  'CORRECTION_REQUESTED',
]);

/**
 * SEUL ensemble autorisé à atteindre un enseignant — HTML, PDF, aperçu,
 * export, lien, API. Un seul statut, listé ici pour que le nom du groupe
 * documente l'invariant même si sa taille change un jour.
 */
export const BRIEF_STATUSES_SAFE_FOR_TEACHER: readonly TeacherBriefStatus[] = Object.freeze([
  'APPROVED',
]);

/** États qui ne changeront plus jamais (utile pour l'historique/l'affichage, jamais pour le rendu enseignant). */
export const BRIEF_STATUSES_TERMINAL_HISTORY: readonly TeacherBriefStatus[] = Object.freeze([
  'APPROVED',
  'SUPERSEDED',
]);

/** Transitions légales — appliquées ici, par le service, ET par un trigger SQL (défense en profondeur). */
const LEGAL_TRANSITIONS: ReadonlyMap<TeacherBriefStatus, ReadonlySet<TeacherBriefStatus>> = new Map([
  ['PENDING_REVIEW', new Set<TeacherBriefStatus>(['APPROVED', 'CORRECTION_REQUESTED'])],
  ['CORRECTION_REQUESTED', new Set<TeacherBriefStatus>(['SUPERSEDED'])],
  ['APPROVED', new Set<TeacherBriefStatus>()],
  ['SUPERSEDED', new Set<TeacherBriefStatus>()],
]);

export function isLegalBriefStatusTransition(from: TeacherBriefStatus, to: TeacherBriefStatus): boolean {
  return LEGAL_TRANSITIONS.get(from)?.has(to) ?? false;
}

export function isSafeForTeacher(status: TeacherBriefStatus): boolean {
  return (BRIEF_STATUSES_SAFE_FOR_TEACHER as readonly string[]).includes(status);
}
