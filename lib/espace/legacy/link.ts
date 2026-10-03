/**
 * Rattachement MANUEL d'une trace historique à un élève identifié par
 * l'enseignant.
 *
 * Principes :
 *  - aucune association automatique : rien n'est lié sans un identifiant de
 *    trace ET un identifiant d'élève choisis explicitement ;
 *  - dry-run par défaut : `planLink` ne fait aucune écriture ;
 *  - l'exécution exige un jeton de confirmation dérivé de la paire choisie ;
 *  - idempotent : relier deux fois la même paire ne fait rien ; relier une
 *    trace déjà liée à quelqu'un d'autre est refusé ;
 *  - un travail existant n'est JAMAIS écrasé ni fusionné ;
 *  - la source n'est ni modifiée ni supprimée (lecture seule).
 */
import type { Prisma, PrismaClient } from '@prisma/client';

import { POO_ACTIVITY_SLUG } from '../catalog';
import { normalizeUsername } from '../username';
import { computeProgress } from '../work-content';
import { getPooContent } from '../catalog';
import {
  LegacyTraceError,
  parseLegacyTrace,
  summarizeTrace,
  traceToWorkContent,
  type LegacyReader,
  type TraceSummary,
} from './reader';

type Db = PrismaClient | Prisma.TransactionClient;

export type LinkRefusalCode =
  | 'TRACE_NOT_SPECIFIED'
  | 'TRACE_NOT_FOUND'
  | 'AMBIGUOUS_ALIAS'
  | 'INVALID_TRACE'
  | 'INCOMPATIBLE_VERSION'
  | 'STUDENT_NOT_FOUND'
  | 'STUDENT_NOT_ENROLLED'
  | 'ALREADY_LINKED_ELSEWHERE'
  | 'STUDENT_HAS_WORK'
  | 'ACTIVITY_MISSING';

export interface LinkInput {
  /** Identifiant de dépôt dans l'archive (colonne `id`). Prioritaire. */
  traceId?: string;
  /** Valeur du champ `alias` saisi par l'élève (ex. POO01). Refusé s'il est ambigu. */
  alias?: string;
  username: string;
}

export type LinkPlan =
  | {
      ok: true;
      alreadyLinked: boolean;
      traceId: string;
      alias: string;
      receivedAt: string;
      sourceSha: string;
      student: { id: string; username: string; name: string };
      summary: TraceSummary;
      /** À fournir à l'exécution : lie explicitement CETTE trace à CET élève. */
      confirmToken: string;
    }
  | { ok: false; refusal: LinkRefusalCode; message: string; candidates?: { id: string; received: string }[] };

export function confirmTokenFor(traceId: string, username: string): string {
  return `LINK:${traceId}:${username}`;
}

function refuse(refusal: LinkRefusalCode, message: string, candidates?: { id: string; received: string }[]): LinkPlan {
  return { ok: false, refusal, message, ...(candidates ? { candidates } : {}) };
}

export async function planLink(db: Db, reader: LegacyReader, input: LinkInput): Promise<LinkPlan> {
  // 1. Quelle trace — jamais devinée.
  let row;
  if (input.traceId) {
    row = reader.get(input.traceId);
    if (!row) return refuse('TRACE_NOT_FOUND', 'Aucune trace avec cet identifiant dans l’archive');
  } else if (input.alias) {
    const matches = reader.findByAlias(input.alias);
    if (matches.length === 0) return refuse('TRACE_NOT_FOUND', 'Aucune trace avec cet alias dans l’archive');
    if (matches.length > 1) {
      return refuse(
        'AMBIGUOUS_ALIAS',
        `L’alias correspond à ${matches.length} dépôts : précisez l’identifiant de trace`,
        matches.map((m) => ({ id: m.id, received: m.received })),
      );
    }
    row = matches[0]!;
  } else {
    return refuse('TRACE_NOT_SPECIFIED', 'Indiquez un identifiant de trace ou un alias');
  }

  // 2. La trace doit être conforme.
  let summary: TraceSummary;
  let trace;
  try {
    trace = parseLegacyTrace(row.payload);
    summary = summarizeTrace(trace);
  } catch (e) {
    if (e instanceof LegacyTraceError) return refuse(e.code, e.message);
    throw e;
  }

  // 3. Quel élève — choisi explicitement, jamais déduit.
  const username = normalizeUsername(input.username);
  const student = username
    ? await db.user.findUnique({ where: { username }, select: { id: true, role: true, username: true, firstName: true, lastName: true } })
    : null;
  if (!student || student.role !== 'ELEVE' || !student.username) return refuse('STUDENT_NOT_FOUND', 'Aucun élève avec cet identifiant');

  const activity = await db.espaceActivity.findUnique({ where: { slug: POO_ACTIVITY_SLUG }, select: { id: true, subject: true } });
  if (!activity) return refuse('ACTIVITY_MISSING', 'Activité POO absente : lancer le provisioning');
  if ((await db.espaceEnrollment.count({ where: { userId: student.id, subject: activity.subject } })) === 0) {
    return refuse('STUDENT_NOT_ENROLLED', 'Cet élève n’est pas inscrit en NSI');
  }

  // 4. Déjà lié ?
  const existing = await db.espaceLegacyLink.findUnique({ where: { legacyTraceId: row.id }, select: { studentId: true } });
  const planBase = {
    ok: true as const,
    traceId: row.id,
    alias: row.alias,
    receivedAt: row.received,
    sourceSha: row.sha,
    student: { id: student.id, username: student.username, name: [student.firstName, student.lastName].filter(Boolean).join(' ') },
    summary,
    confirmToken: confirmTokenFor(row.id, student.username),
  };
  if (existing) {
    if (existing.studentId === student.id) return { ...planBase, alreadyLinked: true };
    return refuse('ALREADY_LINKED_ELSEWHERE', 'Cette trace est déjà rattachée à un autre élève');
  }

  // 5. Aucun écrasement : l'élève ne doit pas déjà avoir du travail sur cette activité.
  const work = await db.espaceWork.findUnique({
    where: { studentId_activityId: { studentId: student.id, activityId: activity.id } },
    select: { revision: true, status: true },
  });
  if (work && (work.revision > 0 || work.status !== 'DRAFT')) {
    return refuse('STUDENT_HAS_WORK', 'Cet élève a déjà du travail sur ce TP : rien ne sera écrasé');
  }

  return { ...planBase, alreadyLinked: false };
}

export interface ApplyResult {
  linkId: string;
  workId: string;
  alreadyLinked: boolean;
  sourceSha256Before: string;
  sourceSha256After: string;
}

export class LinkError extends Error {
  constructor(readonly code: LinkRefusalCode | 'CONFIRMATION_MISMATCH' | 'SOURCE_CHANGED', message: string) {
    super(message);
    this.name = 'LinkError';
  }
}

export async function applyLink(
  client: PrismaClient,
  reader: LegacyReader,
  input: LinkInput,
  confirm: string,
  actorId: string,
): Promise<ApplyResult> {
  const sourceBefore = reader.fileSha256();

  const result = await client.$transaction(async (tx) => {
    const plan = await planLink(tx, reader, input);
    if (!plan.ok) throw new LinkError(plan.refusal, plan.message);
    if (confirm !== plan.confirmToken) throw new LinkError('CONFIRMATION_MISMATCH', 'Jeton de confirmation incorrect');

    const row = reader.get(plan.traceId)!;
    if (plan.alreadyLinked) {
      const link = await tx.espaceLegacyLink.findUniqueOrThrow({ where: { legacyTraceId: plan.traceId }, select: { id: true, workId: true } });
      return { linkId: link.id, workId: link.workId ?? '', alreadyLinked: true };
    }

    const trace = parseLegacyTrace(row.payload);
    const content = traceToWorkContent(trace);
    const progress = computeProgress(getPooContent().steps, content);
    const activity = await tx.espaceActivity.findUniqueOrThrow({ where: { slug: POO_ACTIVITY_SLUG }, select: { id: true } });
    const startedAt = new Date(trace.createdAt);
    const savedAt = new Date(trace.updatedAt);
    const stepIndex = Math.max(0, getPooContent().steps.findIndex((s) => s.id === trace.current));

    const work = await tx.espaceWork.upsert({
      where: { studentId_activityId: { studentId: plan.student.id, activityId: activity.id } },
      create: {
        studentId: plan.student.id,
        activityId: activity.id,
        status: 'IN_PROGRESS',
        content: content as Prisma.InputJsonValue,
        currentStep: stepIndex,
        progressSteps: progress.completedSteps,
        revision: 1,
        startedAt: Number.isNaN(startedAt.getTime()) ? new Date() : startedAt,
        lastSavedAt: Number.isNaN(savedAt.getTime()) ? new Date() : savedAt,
      },
      // Un brouillon vide (rév. 0) est le seul travail pré-existant toléré par planLink.
      update: {
        status: 'IN_PROGRESS',
        content: content as Prisma.InputJsonValue,
        currentStep: stepIndex,
        progressSteps: progress.completedSteps,
        revision: 1,
      },
    });
    await tx.espaceWorkVersion.create({ data: { workId: work.id, revision: work.revision, reason: 'LEGACY_IMPORT', content: content as Prisma.InputJsonValue } });
    const link = await tx.espaceLegacyLink.create({
      data: {
        legacyTraceId: plan.traceId,
        sourceSha: plan.sourceSha,
        sourceAlias: plan.alias,
        sourceDbSha256: sourceBefore,
        studentId: plan.student.id,
        workId: work.id,
        linkedById: actorId,
      },
    });
    return { linkId: link.id, workId: work.id, alreadyLinked: false };
  });

  const sourceAfter = reader.fileSha256();
  if (sourceAfter !== sourceBefore) {
    // Ne devrait jamais arriver (ouverture en lecture seule) ; si cela arrive, on le dit.
    throw new LinkError('SOURCE_CHANGED', 'Le fichier source a changé pendant l’opération : à investiguer');
  }
  return { ...result, sourceSha256Before: sourceBefore, sourceSha256After: sourceAfter };
}
