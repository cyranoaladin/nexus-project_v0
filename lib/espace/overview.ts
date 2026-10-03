/**
 * Vues en lecture : tableau de bord élève, accueil / liste d'élèves / fiche
 * élève / file « à corriger » côté enseignant.
 *
 * Aucune de ces fonctions ne charge le contenu des travaux (colonne JSON
 * volumineuse) : seulement les métadonnées nécessaires à l'affichage, en un
 * nombre constant de requêtes — pas de N+1, pas de chargement massif.
 */
import type { EspaceWorkStatus, Subject } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { loadWorkForActor, teacherWorkScope } from './access';
import { ACTIVITIES, getActivityDef } from './catalog';
import { EspaceError } from './errors';
import type { EspaceActor } from './guards';
import { listPublishedSessionsForStudent } from './sessions';

/**
 * Libellés d'affichage. Volontairement indexé par chaîne et non `Record<Subject, …>` :
 * l'enum Prisma évolue (langues ajoutées) et la table ne doit pas casser le build
 * d'une version qui n'a pas toutes les valeurs.
 */
export const SUBJECT_LABELS: Record<string, string> = {
  MATHEMATIQUES: 'Mathématiques',
  MATHS_EXPERTES: 'Maths expertes',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philosophie',
  HISTOIRE_GEO: 'Histoire-géographie',
  ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol',
  PHYSIQUE_CHIMIE: 'Physique-chimie',
  SVT: 'SVT',
  SES: 'SES',
  ARABE: 'Arabe',
  ITALIEN: 'Italien',
  RUSSE: 'Russe',
  ALLEMAND: 'Allemand',
};

export function subjectLabel(subject: Subject): string {
  return SUBJECT_LABELS[subject] ?? subject;
}

export function fullName(u: { firstName: string | null; lastName: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Élève';
}

// ─── Élève ──────────────────────────────────────────────────────────────────

export interface StudentDashboard {
  firstName: string;
  subjects: { subject: Subject; label: string; activities: { slug: string; title: string; moduleSlug: string; kind: string }[] }[];
  /** « À faire maintenant » : séance publiée en premier, sinon travail en cours. */
  next: {
    activitySlug: string;
    activityTitle: string;
    subjectLabel: string;
    sessionId: string | null;
    workId: string | null;
    status: EspaceWorkStatus | null;
    currentStep: number | null;
    stepsTotal: number;
    progressSteps: number;
    lastSavedAt: string | null;
  } | null;
  works: {
    id: string;
    activitySlug: string;
    activityTitle: string;
    subjectLabel: string;
    status: EspaceWorkStatus;
    progressSteps: number;
    stepsTotal: number;
    lastSavedAt: string;
    hasFeedback: boolean;
  }[];
}

export async function getStudentDashboard(actor: EspaceActor): Promise<StudentDashboard> {
  if (actor.role !== 'ELEVE') throw new EspaceError('FORBIDDEN', 'Réservé aux élèves');

  const [enrollments, works, sessions] = await Promise.all([
    prisma.espaceEnrollment.findMany({ where: { userId: actor.id }, select: { subject: true }, distinct: ['subject'] }),
    prisma.espaceWork.findMany({
      where: { studentId: actor.id },
      orderBy: { lastSavedAt: 'desc' },
      select: {
        id: true, status: true, progressSteps: true, currentStep: true, lastSavedAt: true, sessionId: true,
        correctedAt: true, reopenedAt: true,
        activity: { select: { slug: true, title: true, subject: true, stepsTotal: true } },
      },
    }),
    listPublishedSessionsForStudent(actor.id),
  ]);

  const subjectSet = new Set(enrollments.map((e) => e.subject));
  const subjects = [...subjectSet]
    .map((subject) => ({
      subject,
      label: SUBJECT_LABELS[subject],
      activities: ACTIVITIES.filter((a) => a.subject === subject).map((a) => ({ slug: a.slug, title: a.title, moduleSlug: a.moduleSlug, kind: a.kind })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

  const open = new Set<EspaceWorkStatus>(['DRAFT', 'IN_PROGRESS', 'REOPENED']);
  const pendingSession = sessions.find((s) => !s.works[0] || open.has(s.works[0].status));
  const inProgress = works.find((w) => open.has(w.status) && subjectSet.has(w.activity.subject));

  let next: StudentDashboard['next'] = null;
  if (pendingSession) {
    const w = pendingSession.works[0];
    const fullWork = w ? works.find((x) => x.id === w.id) : undefined;
    next = {
      activitySlug: pendingSession.activity.slug,
      activityTitle: pendingSession.activity.title,
      subjectLabel: SUBJECT_LABELS[pendingSession.subject],
      sessionId: pendingSession.id,
      workId: w?.id ?? null,
      status: w?.status ?? null,
      currentStep: fullWork?.currentStep ?? null,
      stepsTotal: pendingSession.activity.stepsTotal,
      progressSteps: w?.progressSteps ?? 0,
      lastSavedAt: w?.lastSavedAt.toISOString() ?? null,
    };
  } else if (inProgress) {
    next = {
      activitySlug: inProgress.activity.slug,
      activityTitle: inProgress.activity.title,
      subjectLabel: SUBJECT_LABELS[inProgress.activity.subject],
      sessionId: inProgress.sessionId,
      workId: inProgress.id,
      status: inProgress.status,
      currentStep: inProgress.currentStep,
      stepsTotal: inProgress.activity.stepsTotal,
      progressSteps: inProgress.progressSteps,
      lastSavedAt: inProgress.lastSavedAt.toISOString(),
    };
  }

  return {
    firstName: actor.firstName ?? '',
    subjects,
    next,
    works: works.map((w) => ({
      id: w.id,
      activitySlug: w.activity.slug,
      activityTitle: w.activity.title,
      subjectLabel: SUBJECT_LABELS[w.activity.subject],
      status: w.status,
      progressSteps: w.progressSteps,
      stepsTotal: w.activity.stepsTotal,
      lastSavedAt: w.lastSavedAt.toISOString(),
      hasFeedback: Boolean(w.correctedAt || w.reopenedAt),
    })),
  };
}

// ─── Enseignant ─────────────────────────────────────────────────────────────

export interface RosterRow {
  studentId: string;
  name: string;
  groupName: string;
  workId: string | null;
  status: EspaceWorkStatus | 'NOT_STARTED';
  progressSteps: number;
  currentStep: number | null;
  lastSavedAt: string | null;
  submittedAt: string | null;
}

export interface TeacherOverview {
  activity: { slug: string; title: string; stepsTotal: number; subjectLabel: string };
  counts: { students: number; notStarted: number; inProgress: number; submitted: number; corrected: number; reopened: number };
  rows: RosterRow[];
  generatedAt: string;
}

async function teacherRosterWhere(actor: EspaceActor, subject: Subject) {
  if (actor.role === 'ADMIN') return { subject };
  return { subject, group: { teachers: { some: { teacherId: actor.id, subject } } } };
}

export async function getTeacherOverview(actor: EspaceActor, activitySlug: string): Promise<TeacherOverview> {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  const def = getActivityDef(activitySlug);
  const activity = await prisma.espaceActivity.findUnique({ where: { slug: activitySlug } });
  if (!def || !activity) throw new EspaceError('NOT_FOUND', 'Activité introuvable');

  const enrollments = await prisma.espaceEnrollment.findMany({
    where: await teacherRosterWhere(actor, activity.subject),
    select: { user: { select: { id: true, firstName: true, lastName: true } }, group: { select: { name: true } } },
  });
  const studentIds = [...new Set(enrollments.map((e) => e.user.id))];
  const works = await prisma.espaceWork.findMany({
    where: { activityId: activity.id, studentId: { in: studentIds } },
    select: { id: true, studentId: true, status: true, progressSteps: true, currentStep: true, lastSavedAt: true, submittedAt: true },
  });
  const byStudent = new Map(works.map((w) => [w.studentId, w]));

  const seen = new Set<string>();
  const rows: RosterRow[] = [];
  for (const e of enrollments) {
    if (seen.has(e.user.id)) continue;
    seen.add(e.user.id);
    const w = byStudent.get(e.user.id);
    rows.push({
      studentId: e.user.id,
      name: fullName(e.user),
      groupName: e.group.name,
      workId: w?.id ?? null,
      status: w?.status ?? 'NOT_STARTED',
      progressSteps: w?.progressSteps ?? 0,
      currentStep: w?.currentStep ?? null,
      lastSavedAt: w?.lastSavedAt.toISOString() ?? null,
      submittedAt: w?.submittedAt?.toISOString() ?? null,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const count = (pred: (r: RosterRow) => boolean) => rows.filter(pred).length;
  return {
    activity: { slug: def.slug, title: def.title, stepsTotal: activity.stepsTotal, subjectLabel: SUBJECT_LABELS[activity.subject] },
    counts: {
      students: rows.length,
      notStarted: count((r) => r.status === 'NOT_STARTED' || r.status === 'DRAFT'),
      inProgress: count((r) => r.status === 'IN_PROGRESS'),
      submitted: count((r) => r.status === 'SUBMITTED'),
      corrected: count((r) => r.status === 'CORRECTED' || r.status === 'DONE'),
      reopened: count((r) => r.status === 'REOPENED'),
    },
    rows,
    generatedAt: new Date().toISOString(),
  };
}

export interface TeacherStudentRow {
  id: string;
  name: string;
  groups: string[];
  subjects: { subject: Subject; label: string }[];
  toCorrect: number;
}

export async function listTeacherStudents(actor: EspaceActor): Promise<TeacherStudentRow[]> {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  const assignments = actor.role === 'ADMIN' ? null : await prisma.espaceTeacherAssignment.findMany({ where: { teacherId: actor.id }, select: { groupId: true, subject: true } });
  if (assignments && assignments.length === 0) return [];

  const enrollments = await prisma.espaceEnrollment.findMany({
    where: assignments ? { OR: assignments.map((a) => ({ groupId: a.groupId, subject: a.subject })) } : {},
    select: { subject: true, user: { select: { id: true, firstName: true, lastName: true } }, group: { select: { name: true } } },
  });
  const ids = [...new Set(enrollments.map((e) => e.user.id))];
  const pending = await prisma.espaceWork.groupBy({ by: ['studentId'], where: { studentId: { in: ids }, status: 'SUBMITTED' }, _count: { _all: true } });
  const pendingBy = new Map(pending.map((p) => [p.studentId, p._count._all]));

  const map = new Map<string, TeacherStudentRow>();
  for (const e of enrollments) {
    const row = map.get(e.user.id) ?? { id: e.user.id, name: fullName(e.user), groups: [], subjects: [], toCorrect: pendingBy.get(e.user.id) ?? 0 };
    if (!row.groups.includes(e.group.name)) row.groups.push(e.group.name);
    if (!row.subjects.some((s) => s.subject === e.subject)) row.subjects.push({ subject: e.subject, label: SUBJECT_LABELS[e.subject] });
    map.set(e.user.id, row);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export interface StudentFile {
  student: { id: string; name: string };
  subjects: { subject: Subject; label: string }[];
  works: { id: string; activityTitle: string; subjectLabel: string; status: EspaceWorkStatus; progressSteps: number; stepsTotal: number; lastSavedAt: string; submittedAt: string | null; correctedAt: string | null }[];
}

export async function getStudentFile(actor: EspaceActor, studentId: string): Promise<StudentFile> {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  const scope = await teacherWorkScope(actor);
  const enrollments = await prisma.espaceEnrollment.findMany({
    where: { userId: studentId, ...(actor.role === 'ADMIN' ? {} : { group: { teachers: { some: { teacherId: actor.id } } } }) },
    select: { subject: true, group: { select: { teachers: { where: actor.role === 'ADMIN' ? {} : { teacherId: actor.id }, select: { subject: true } } } } },
  });
  // Visible seulement si l'enseignant enseigne la matière dans le groupe de l'élève.
  const visibleSubjects = new Set<Subject>(
    enrollments.filter((e) => actor.role === 'ADMIN' || e.group.teachers.some((t) => t.subject === e.subject)).map((e) => e.subject),
  );
  if (visibleSubjects.size === 0) throw new EspaceError('NOT_FOUND', 'Élève introuvable');

  const student = await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, firstName: true, lastName: true } });
  const works = await prisma.espaceWork.findMany({
    where: { studentId, ...(scope && Object.keys(scope).length > 0 ? scope : {}) },
    orderBy: { lastSavedAt: 'desc' },
    select: {
      id: true, status: true, progressSteps: true, lastSavedAt: true, submittedAt: true, correctedAt: true,
      activity: { select: { title: true, subject: true, stepsTotal: true } },
    },
  });
  return {
    student: { id: student.id, name: fullName(student) },
    subjects: [...visibleSubjects].map((subject) => ({ subject, label: SUBJECT_LABELS[subject] })),
    works: works
      .filter((w) => visibleSubjects.has(w.activity.subject))
      .map((w) => ({
        id: w.id,
        activityTitle: w.activity.title,
        subjectLabel: SUBJECT_LABELS[w.activity.subject],
        status: w.status,
        progressSteps: w.progressSteps,
        stepsTotal: w.activity.stepsTotal,
        lastSavedAt: w.lastSavedAt.toISOString(),
        submittedAt: w.submittedAt?.toISOString() ?? null,
        correctedAt: w.correctedAt?.toISOString() ?? null,
      })),
  };
}

/** Activité sur laquelle les élèves de cet enseignant ont travaillé le plus récemment (accueil enseignant par défaut). */
export async function latestActiveActivitySlug(actor: EspaceActor): Promise<string | null> {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  const scope = await teacherWorkScope(actor);
  if (scope === null) return null;
  const row = await prisma.espaceWork.findFirst({
    where: { ...scope },
    orderBy: { lastSavedAt: 'desc' },
    select: { activity: { select: { slug: true } } },
  });
  return row?.activity.slug ?? null;
}

export interface CorrectionQueueItem {
  workId: string;
  studentName: string;
  activityTitle: string;
  subjectLabel: string;
  submittedAt: string | null;
  progressSteps: number;
  stepsTotal: number;
}

export async function listWorksToCorrect(actor: EspaceActor, activitySlug?: string): Promise<CorrectionQueueItem[]> {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  const scope = await teacherWorkScope(actor);
  if (scope === null) return [];
  const rows = await prisma.espaceWork.findMany({
    where: { status: 'SUBMITTED', ...scope, ...(activitySlug ? { activity: { slug: activitySlug } } : {}) },
    orderBy: { submittedAt: 'asc' },
    take: 200,
    select: {
      id: true, submittedAt: true, progressSteps: true,
      student: { select: { firstName: true, lastName: true } },
      activity: { select: { title: true, subject: true, stepsTotal: true } },
    },
  });
  return rows.map((r) => ({
    workId: r.id,
    studentName: fullName(r.student),
    activityTitle: r.activity.title,
    subjectLabel: SUBJECT_LABELS[r.activity.subject],
    submittedAt: r.submittedAt?.toISOString() ?? null,
    progressSteps: r.progressSteps,
    stepsTotal: r.activity.stepsTotal,
  }));
}

export { loadWorkForActor };
