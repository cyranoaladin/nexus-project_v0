/**
 * Travaux d'élèves : ouverture, autosave à révision optimiste, remise,
 * relecture enseignant, instantanés.
 *
 * Invariants (testés contre une vraie base) :
 *  - toute écriture élève est conditionnée par `revision` : aucune écriture
 *    obsolète n'écrase silencieusement une version plus récente ;
 *  - après la remise l'élève est en lecture seule, y compris pour une requête
 *    déjà en vol ;
 *  - l'enseignant ne modifie JAMAIS le contenu d'un élève ;
 *  - un rejeu exact d'une sauvegarde déjà appliquée réussit (réseau instable).
 */
import { Prisma, type EspaceVersionReason, type EspaceWorkStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { loadWorkForActor, isStudentEnrolled, requireBilanAssignment, type WorkWithActivity } from './access';
import { isBilanActivitySlug } from './lesson-routes';
import { getBilanLevel } from './bilan-data';
import { assertBilanReadyToSubmit, computeBilanProgress, normalizeBilanContent, validateBilanStep } from './bilan-work';
import { getActivityDef, getLessonRequiredSteps, getLessonSteps, POO_ACTIVITY_SLUG } from './catalog';
import { EspaceError } from './errors';
import type { EspaceActor } from './guards';
import {
  WorkContentError,
  computeProgress,
  mergeStep,
  parseStepPatch,
  parseWorkContent,
  type WorkContent,
} from './work-content';
import { WorkTransitionError, applyAction, fromStatusesFor, isStudentEditable, type WorkAction } from './work-state';

export const MAX_VERSIONS_PER_WORK = 300;
export const INTERVAL_SNAPSHOT_MS = 10 * 60_000;
export const RUN_SNAPSHOT_MIN_GAP_MS = 20_000;

export interface WorkDto {
  id: string;
  activitySlug: string;
  activityTitle: string;
  subject: string;
  status: EspaceWorkStatus;
  content: WorkContent;
  currentStep: number;
  progressSteps: number;
  stepsTotal: number;
  revision: number;
  startedAt: string;
  lastSavedAt: string;
  submittedAt: string | null;
  correctedAt: string | null;
  reopenedAt: string | null;
  /** L'élève peut-il encore modifier ? Calculé côté serveur, jamais déduit côté client. */
  editable: boolean;
}

export function toWorkDto(work: WorkWithActivity): WorkDto {
  return {
    id: work.id,
    activitySlug: work.activity.slug,
    activityTitle: work.activity.title,
    subject: work.activity.subject,
    status: work.status,
    content: parseWorkContent(work.content),
    currentStep: work.currentStep,
    progressSteps: work.progressSteps,
    stepsTotal: work.activity.stepsTotal,
    revision: work.revision,
    startedAt: work.startedAt.toISOString(),
    lastSavedAt: work.lastSavedAt.toISOString(),
    submittedAt: work.submittedAt?.toISOString() ?? null,
    correctedAt: work.correctedAt?.toISOString() ?? null,
    reopenedAt: work.reopenedAt?.toISOString() ?? null,
    editable: isStudentEditable(work.status),
  };
}

function stepDefsFor(activitySlug: string) {
  return getLessonSteps(activitySlug);
}

function conflict(work: WorkWithActivity): EspaceError {
  return new EspaceError('REVISION_CONFLICT', 'Ce travail a été modifié ailleurs', {
    current: { revision: work.revision, status: work.status, content: parseWorkContent(work.content) },
  });
}

// ─── Ouverture ──────────────────────────────────────────────────────────────

export async function openWork(
  actor: EspaceActor,
  input: { activitySlug: string; sessionId?: string | null },
): Promise<WorkDto> {
  if (actor.role !== 'ELEVE') throw new EspaceError('FORBIDDEN', 'Réservé aux élèves');

  const activity = await prisma.espaceActivity.findUnique({ where: { slug: input.activitySlug } });
  if (!activity) throw new EspaceError('NOT_FOUND', 'Activité introuvable');
  if (!(await isStudentEnrolled(actor.id, activity.subject))) {
    throw new EspaceError('NOT_ENROLLED', 'Cette matière ne fait pas partie de vos inscriptions');
  }

  let sessionId: string | null = null;
  if (isBilanActivitySlug(activity.slug)) {
    sessionId = await requireBilanAssignment(actor.id, activity.id, input.sessionId);
  } else if (input.sessionId) {
    const seat = await prisma.espaceSession.findFirst({
      where: {
        id: input.sessionId,
        status: 'PUBLISHED',
        activityId: activity.id,
        participants: { some: { userId: actor.id } },
      },
      select: { id: true },
    });
    if (!seat) throw new EspaceError('NOT_FOUND', 'Séance introuvable');
    sessionId = seat.id;
  }

  // Deux onglets (ou deux requêtes) qui ouvrent en même temps obtiennent le même travail :
  // lire, sinon créer, et si la contrainte d'unicité l'emporte, relire. (L'`upsert` de Prisma
  // n'est pas toujours atomique : mesuré en échec sous charge.)
  const key = { studentId_activityId: { studentId: actor.id, activityId: activity.id } };
  let work = await prisma.espaceWork.findUnique({ where: key, include: { activity: true } });
  if (!work) {
    try {
      work = await prisma.espaceWork.create({ data: { studentId: actor.id, activityId: activity.id, sessionId }, include: { activity: true } });
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
      work = await prisma.espaceWork.findUniqueOrThrow({ where: key, include: { activity: true } });
    }
  }
  if (sessionId && !work.sessionId) {
    const linked = await prisma.espaceWork.update({ where: { id: work.id }, data: { sessionId }, include: { activity: true } });
    return toWorkDto(linked);
  }
  return toWorkDto(work);
}

// ─── Instantanés ────────────────────────────────────────────────────────────

async function maybeSnapshot(
  tx: Prisma.TransactionClient,
  workId: string,
  revision: number,
  content: WorkContent,
  requested: EspaceVersionReason | null,
  now: Date,
): Promise<void> {
  const [latest, count] = await Promise.all([
    tx.espaceWorkVersion.findFirst({ where: { workId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, content: true } }),
    tx.espaceWorkVersion.count({ where: { workId } }),
  ]);

  const always = requested === 'STEP_CHANGE' || requested === 'SUBMIT' || requested === 'REOPEN' || requested === 'CORRECTION';
  let reason: EspaceVersionReason | null = requested;

  if (!reason) {
    if (!latest || now.getTime() - latest.createdAt.getTime() >= INTERVAL_SNAPSHOT_MS) reason = 'INTERVAL';
  } else if (reason === 'RUN' && latest && now.getTime() - latest.createdAt.getTime() < RUN_SNAPSHOT_MIN_GAP_MS) {
    reason = null;
  }
  if (!reason) return;
  if (!always && count >= MAX_VERSIONS_PER_WORK) return;
  // Pas d'instantané identique au précédent (évite le bruit sans perte d'information).
  if (!always && latest && JSON.stringify(latest.content) === JSON.stringify(content)) return;

  await tx.espaceWorkVersion.createMany({
    data: [{ workId, revision, reason, content: content as Prisma.InputJsonValue, createdAt: now }],
    skipDuplicates: true,
  });
}

// ─── Autosave ───────────────────────────────────────────────────────────────

export interface SaveInput {
  baseRevision: number;
  patch: unknown;
  currentStep?: number;
  snapshot?: 'STEP_CHANGE' | 'RUN';
}

export interface SaveResult {
  revision: number;
  status: EspaceWorkStatus;
  progressSteps: number;
  savedAt: string;
  /** true si la sauvegarde était déjà appliquée (rejeu après coupure réseau). */
  replayed: boolean;
}

export async function saveWork(actor: EspaceActor, workId: string, input: SaveInput): Promise<SaveResult> {
  if (!Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0) {
    throw new EspaceError('INVALID_INPUT', 'Révision invalide');
  }
  const { work } = await loadWorkForActor(actor, workId, 'student');

  const defs = stepDefsFor(work.activity.slug);
  if (defs.length === 0) {
    throw new EspaceError('INVALID_INPUT', 'Cette activité ne s’enregistre pas par étapes');
  }

  let patch;
  try {
    patch = parseStepPatch(input.patch, defs.map((s) => s.id));
    const level = getBilanLevel(work.activity.slug);
    if (level) validateBilanStep(level, patch.stepId, patch.step);
  } catch (e) {
    if (e instanceof WorkContentError) throw new EspaceError('INVALID_INPUT', e.message);
    throw e;
  }

  if (!isStudentEditable(work.status)) throw new EspaceError('WORK_LOCKED', 'Ce travail est remis : lecture seule');

  const current = parseWorkContent(work.content);

  if (work.revision !== input.baseRevision) {
    // Rejeu d'une sauvegarde déjà appliquée : l'étape stockée est exactement celle envoyée.
    if (JSON.stringify(current.steps[patch.stepId] ?? null) === JSON.stringify(patch.step)) {
      return {
        revision: work.revision,
        status: work.status,
        progressSteps: work.progressSteps,
        savedAt: work.lastSavedAt.toISOString(),
        replayed: true,
      };
    }
    throw conflict(work);
  }

  let next: WorkContent;
  try {
    next = parseWorkContent(mergeStep(current, patch.stepId, patch.step));
    const level = getBilanLevel(work.activity.slug);
    if (level) next = normalizeBilanContent(level, next);
  } catch (e) {
    if (e instanceof WorkContentError) throw new EspaceError('INVALID_INPUT', e.message);
    throw e;
  }

  const bilanLevel = getBilanLevel(work.activity.slug);
  const progress = bilanLevel ? computeBilanProgress(bilanLevel, next) : computeProgress(defs, next);
  const status = applyAction(work.status, 'SAVE');
  const maxStep = Math.max(0, defs.length - 1);
  const currentStep = Math.min(Math.max(Math.trunc(input.currentStep ?? work.currentStep), 0), maxStep);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.espaceWork.updateMany({
      // Les deux prédicats ferment la fenêtre de course : révision ET statut inchangés.
      where: { id: work.id, revision: input.baseRevision, status: work.status },
      data: {
        content: next as Prisma.InputJsonValue,
        status,
        currentStep,
        progressSteps: progress.completedSteps,
        revision: { increment: 1 },
        lastSavedAt: now,
      },
    });

    if (updated.count !== 1) {
      const fresh = await tx.espaceWork.findUnique({ where: { id: work.id }, include: { activity: true } });
      if (!fresh) throw new EspaceError('NOT_FOUND', 'Travail introuvable');
      if (!isStudentEditable(fresh.status)) throw new EspaceError('WORK_LOCKED', 'Ce travail est remis : lecture seule');
      throw conflict(fresh);
    }

    await maybeSnapshot(tx, work.id, input.baseRevision + 1, next, input.snapshot ?? null, now);
    return {
      revision: input.baseRevision + 1,
      status,
      progressSteps: progress.completedSteps,
      savedAt: now.toISOString(),
      replayed: false,
    };
  });
}

// ─── Remise ─────────────────────────────────────────────────────────────────

export async function submitWork(actor: EspaceActor, workId: string, baseRevision: number): Promise<WorkDto> {
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) throw new EspaceError('INVALID_INPUT', 'Révision invalide');
  const { work } = await loadWorkForActor(actor, workId, 'student');

  // Rejeu : déjà remis à la révision que le client attend.
  if (work.status === 'SUBMITTED' && work.revision === baseRevision + 1) return toWorkDto(work);

  if (work.status === 'DRAFT') throw new EspaceError('WORK_EMPTY', 'Rien à remettre : le travail n’est pas commencé');
  try {
    applyAction(work.status, 'SUBMIT');
  } catch (e) {
    if (e instanceof WorkTransitionError) throw new EspaceError('INVALID_TRANSITION', 'Ce travail ne peut pas être remis dans son état actuel');
    throw e;
  }
  if (work.revision !== baseRevision) throw conflict(work);

  const bilanLevel = getBilanLevel(work.activity.slug);
  if (bilanLevel) assertBilanReadyToSubmit(bilanLevel, parseWorkContent(work.content));

  if (work.activity.kind === 'UPLOAD_EXERCISE') {
    const files = await prisma.espaceWorkAttachment.count({ where: { workId: work.id } });
    if (files === 0) throw new EspaceError('WORK_EMPTY', 'Ajoutez au moins un fichier avant de remettre');
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.espaceWork.updateMany({
      where: { id: work.id, revision: baseRevision, status: { in: fromStatusesFor('SUBMIT') } },
      data: { status: 'SUBMITTED', submittedAt: now, revision: { increment: 1 }, lastSavedAt: now },
    });
    if (updated.count !== 1) {
      const fresh = await tx.espaceWork.findUnique({ where: { id: work.id }, include: { activity: true } });
      if (!fresh) throw new EspaceError('NOT_FOUND', 'Travail introuvable');
      throw conflict(fresh);
    }
    const fresh = await tx.espaceWork.findUniqueOrThrow({ where: { id: work.id }, include: { activity: true } });
    await maybeSnapshot(tx, work.id, fresh.revision, parseWorkContent(fresh.content), 'SUBMIT', now);
    return toWorkDto(fresh);
  });
}

// ─── Relecture enseignant ───────────────────────────────────────────────────

export type ReviewAction = Extract<WorkAction, 'MARK_CORRECTED' | 'REOPEN' | 'MARK_DONE'>;

export async function reviewWork(actor: EspaceActor, workId: string, action: ReviewAction): Promise<WorkDto> {
  const { work } = await loadWorkForActor(actor, workId, 'teacher');

  let to: EspaceWorkStatus;
  try {
    to = applyAction(work.status, action);
  } catch (e) {
    if (e instanceof WorkTransitionError) throw new EspaceError('INVALID_TRANSITION', 'Ce changement de statut n’est pas possible depuis l’état actuel');
    throw e;
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.espaceWork.updateMany({
      // Le statut lu doit être encore le statut en base : sinon quelqu'un est intervenu entre-temps.
      where: { id: work.id, status: work.status },
      data: {
        status: to,
        ...(action === 'MARK_CORRECTED' ? { correctedAt: now } : {}),
        ...(action === 'REOPEN' ? { reopenedAt: now } : {}),
      },
    });
    if (updated.count !== 1) throw new EspaceError('INVALID_TRANSITION', 'Le travail a changé entre-temps, rechargez la page');
    const fresh = await tx.espaceWork.findUniqueOrThrow({ where: { id: work.id }, include: { activity: true } });
    if (action === 'MARK_CORRECTED') {
      await maybeSnapshot(tx, work.id, fresh.revision, parseWorkContent(fresh.content), 'CORRECTION', now);
    } else if (action === 'REOPEN') {
      await maybeSnapshot(tx, work.id, fresh.revision, parseWorkContent(fresh.content), 'REOPEN', now);
    }
    return toWorkDto(fresh);
  });
}

export function requiredStepCount(): number {
  return getLessonRequiredSteps(POO_ACTIVITY_SLUG).length;
}

export { getActivityDef };
