/**
 * Export JSON d'un travail, d'une séance ou d'un élève (audit, sauvegarde,
 * portabilité) — réservé à l'enseignant/admin, avec EXACTEMENT les règles
 * d'accès de la lecture normale : un travail que l'enseignant ne pourrait pas
 * ouvrir n'est pas exportable.
 *
 * Contenu : travail, instantanés, annotations, métadonnées de fichiers
 * (jamais les octets), liens de provenance legacy, chronologie d'états.
 * Jamais d'identifiant de connexion, de code personnel, de mot de passe ni
 * d'identifiant interne d'auteur.
 */
import { prisma } from '@/lib/prisma';

import { loadWorkForActor, teacherWorkScope } from './access';
import { EspaceError } from './errors';
import type { EspaceActor } from './guards';
import { fullName, getStudentFile } from './overview';
import { teacherTeachesGroupSubject } from './teaching';

export const MAX_EXPORT_WORKS = 100;
export const MAX_EXPORT_BYTES = 25 * 1024 * 1024;

export type ExportScope = { kind: 'work' | 'session' | 'student'; id: string };

export interface TimelineEvent {
  at: string;
  event: string;
}

export interface WorkExport {
  id: string;
  activity: { slug: string; title: string; subject: string };
  student: { firstName: string | null; lastName: string | null };
  status: string;
  revision: number;
  currentStep: number;
  progressSteps: number;
  startedAt: string;
  lastSavedAt: string;
  submittedAt: string | null;
  correctedAt: string | null;
  reopenedAt: string | null;
  content: unknown;
  versions: { revision: number; reason: string; createdAt: string; content: unknown }[];
  annotations: {
    kind: string;
    body: string;
    stepId: string | null;
    questionId: string | null;
    lineStart: number | null;
    lineEnd: number | null;
    workRevision: number | null;
    author: string;
    createdAt: string;
  }[];
  attachments: { originalName: string; mimeType: string; sizeBytes: number; sha256: string; createdAt: string }[];
  legacyLinks: { legacyTraceId: string; sourceAlias: string; linkedAt: string }[];
  timeline: TimelineEvent[];
}

export interface ExportEnvelope {
  exportVersion: 1;
  generatedAt: string;
  generatedByRole: 'COACH' | 'ADMIN';
  scope: ExportScope;
  works: WorkExport[];
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function buildWorks(ids: string[]): Promise<WorkExport[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.espaceWork.findMany({
    where: { id: { in: ids } },
    orderBy: { startedAt: 'asc' },
    include: {
      activity: { select: { slug: true, title: true, subject: true } },
      student: { select: { firstName: true, lastName: true } },
      versions: { orderBy: [{ revision: 'asc' }, { createdAt: 'asc' }] },
      annotations: { orderBy: { createdAt: 'asc' }, include: { author: { select: { firstName: true, lastName: true } } } },
      attachments: { orderBy: { createdAt: 'asc' } },
      legacyLinks: { select: { legacyTraceId: true, sourceAlias: true, linkedAt: true } },
    },
  });

  return rows.map((w) => {
    const timeline: TimelineEvent[] = [{ at: w.startedAt.toISOString(), event: 'STARTED' }];
    for (const v of w.versions) timeline.push({ at: v.createdAt.toISOString(), event: `SNAPSHOT_${v.reason}` });
    if (w.submittedAt) timeline.push({ at: w.submittedAt.toISOString(), event: 'SUBMITTED' });
    if (w.correctedAt) timeline.push({ at: w.correctedAt.toISOString(), event: 'CORRECTED' });
    if (w.reopenedAt) timeline.push({ at: w.reopenedAt.toISOString(), event: 'REOPENED' });
    timeline.push({ at: w.lastSavedAt.toISOString(), event: 'LAST_SAVED' });
    timeline.sort((a, b) => a.at.localeCompare(b.at));

    return {
      id: w.id,
      activity: w.activity,
      student: { firstName: w.student.firstName, lastName: w.student.lastName },
      status: w.status,
      revision: w.revision,
      currentStep: w.currentStep,
      progressSteps: w.progressSteps,
      startedAt: w.startedAt.toISOString(),
      lastSavedAt: w.lastSavedAt.toISOString(),
      submittedAt: iso(w.submittedAt),
      correctedAt: iso(w.correctedAt),
      reopenedAt: iso(w.reopenedAt),
      content: w.content,
      versions: w.versions.map((v) => ({ revision: v.revision, reason: v.reason, createdAt: v.createdAt.toISOString(), content: v.content })),
      annotations: w.annotations.map((a) => ({
        kind: a.kind,
        body: a.body,
        stepId: a.stepId,
        questionId: a.questionId,
        lineStart: a.lineStart,
        lineEnd: a.lineEnd,
        workRevision: a.workRevision,
        author: fullName(a.author),
        createdAt: a.createdAt.toISOString(),
      })),
      attachments: w.attachments.map((f) => ({
        originalName: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        sha256: f.sha256,
        createdAt: f.createdAt.toISOString(),
      })),
      legacyLinks: w.legacyLinks.map((l) => ({ legacyTraceId: l.legacyTraceId, sourceAlias: l.sourceAlias, linkedAt: l.linkedAt.toISOString() })),
      timeline,
    };
  });
}

async function resolveWorkIds(actor: EspaceActor, scope: ExportScope): Promise<string[]> {
  if (scope.kind === 'work') {
    await loadWorkForActor(actor, scope.id, 'teacher'); // NOT_FOUND si inaccessible
    return [scope.id];
  }

  if (scope.kind === 'session') {
    const session = await prisma.espaceSession.findUnique({ where: { id: scope.id }, select: { id: true, groupId: true, subject: true } });
    if (!session || !(await teacherTeachesGroupSubject(actor, session.groupId, session.subject))) {
      throw new EspaceError('NOT_FOUND', 'Séance introuvable');
    }
    const works = await prisma.espaceWork.findMany({ where: { sessionId: session.id }, select: { id: true }, take: MAX_EXPORT_WORKS + 1 });
    return works.map((w) => w.id);
  }

  // Élève : on valide d'abord la visibilité, puis on borne aux travaux de la portée de l'enseignant.
  await getStudentFile(actor, scope.id); // NOT_FOUND si l'élève n'est pas visible
  const teacherScope = await teacherWorkScope(actor);
  if (teacherScope === null) throw new EspaceError('NOT_FOUND', 'Élève introuvable');
  const works = await prisma.espaceWork.findMany({
    where: { studentId: scope.id, ...(Object.keys(teacherScope).length > 0 ? teacherScope : {}) },
    select: { id: true },
    take: MAX_EXPORT_WORKS + 1,
  });
  return works.map((w) => w.id);
}

export async function buildExport(actor: EspaceActor, scope: ExportScope): Promise<ExportEnvelope> {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  const ids = await resolveWorkIds(actor, scope);
  if (ids.length > MAX_EXPORT_WORKS) {
    throw new EspaceError('INVALID_INPUT', `Export limité à ${MAX_EXPORT_WORKS} travaux : exportez travail par travail.`);
  }
  return {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedByRole: actor.role,
    scope,
    works: await buildWorks(ids),
  };
}

/** Sérialise en refusant les exports démesurés (la mémoire du serveur n'est pas un entrepôt). */
export function serializeExport(envelope: ExportEnvelope): string {
  const text = JSON.stringify(envelope, null, 2);
  if (Buffer.byteLength(text, 'utf8') > MAX_EXPORT_BYTES) {
    throw new EspaceError('INVALID_INPUT', 'Export trop volumineux : exportez travail par travail.');
  }
  return text;
}
