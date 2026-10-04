/**
 * Politique d'accès de l'espace pédagogique — côté serveur, jamais l'interface.
 *
 *  - Un élève ne voit que SES travaux et les matières où il est inscrit.
 *  - Un enseignant (COACH) ne voit que les élèves inscrits, dans une matière,
 *    à un groupe dont il enseigne cette matière. ADMIN supervise tout.
 *  - Un travail inaccessible est indistinguable d'un travail inexistant (404) :
 *    on ne révèle pas l'existence d'un identifiant.
 */
import type { EspaceActivity, EspaceWork, Subject } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { EspaceError } from './errors';
import type { EspaceActor } from './guards';
import { notValidationStudent, type ValidationScopeOptions } from './validation';

export async function studentSubjects(userId: string): Promise<Subject[]> {
  const rows = await prisma.espaceEnrollment.findMany({
    where: { userId },
    select: { subject: true },
    distinct: ['subject'],
  });
  return rows.map((r) => r.subject);
}

export async function isStudentEnrolled(userId: string, subject: Subject): Promise<boolean> {
  const row = await prisma.espaceEnrollment.findFirst({ where: { userId, subject }, select: { id: true } });
  return row !== null;
}

/** L'enseignant enseigne-t-il `subject` à un groupe auquel appartient cet élève pour cette matière ? */
export async function teacherTeachesStudent(
  actor: EspaceActor,
  studentId: string,
  subject: Subject,
): Promise<boolean> {
  if (actor.role === 'ADMIN') return true;
  if (actor.role !== 'COACH') return false;
  const row = await prisma.espaceEnrollment.findFirst({
    where: {
      userId: studentId,
      subject,
      group: { teachers: { some: { teacherId: actor.id, subject } } },
    },
    select: { id: true },
  });
  return row !== null;
}

export type WorkWithActivity = EspaceWork & { activity: EspaceActivity };
export type WorkMode = 'student' | 'teacher';

/**
 * Charge un travail pour un acteur, ou lève NOT_FOUND (inexistant OU interdit).
 * `require` impose le mode : une route réservée à l'élève refuse le mode enseignant.
 */
export async function loadWorkForActor(
  actor: EspaceActor,
  workId: string,
  require?: WorkMode,
): Promise<{ work: WorkWithActivity; mode: WorkMode }> {
  const work = await prisma.espaceWork.findUnique({ where: { id: workId }, include: { activity: true } });
  if (!work) throw new EspaceError('NOT_FOUND', 'Travail introuvable');

  if (actor.role === 'ELEVE') {
    if (work.studentId !== actor.id) throw new EspaceError('NOT_FOUND', 'Travail introuvable');
    if (require === 'teacher') throw new EspaceError('FORBIDDEN', 'Accès refusé');
    return { work, mode: 'student' };
  }

  if (!(await teacherTeachesStudent(actor, work.studentId, work.activity.subject))) {
    throw new EspaceError('NOT_FOUND', 'Travail introuvable');
  }
  if (require === 'student') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  return { work, mode: 'teacher' };
}

/** Critère Prisma : travaux visibles par cet enseignant (somme de ses couples groupe × matière). */
export async function teacherWorkScope(actor: EspaceActor, opts: ValidationScopeOptions = {}): Promise<Record<string, unknown> | null> {
  if (actor.role === 'ADMIN') return opts.includeValidation ? {} : { student: notValidationStudent };
  const assignments = await prisma.espaceTeacherAssignment.findMany({
    where: { teacherId: actor.id },
    select: { groupId: true, subject: true },
  });
  if (assignments.length === 0) return null;
  return {
    OR: assignments.map((a) => ({
      activity: { subject: a.subject },
      student: { espaceEnrollments: { some: { groupId: a.groupId, subject: a.subject } } },
    })),
  };
}
