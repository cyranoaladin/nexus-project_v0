/**
 * Annotations de l'enseignant sur un travail : commentaire global, par
 * question, par étape, ou rattaché à une plage de lignes de code.
 *
 * Visibilité élève : seulement une fois le travail passé au moins une fois
 * entre les mains de l'enseignant (corrigé ou à reprendre). Les remarques
 * prises en cours de séance restent donc privées tant que l'enseignant n'a
 * pas rendu son retour. Le texte est stocké brut et ÉCHAPPÉ À L'AFFICHAGE
 * (React) : aucun HTML n'est jamais injecté.
 */
import type { EspaceAnnotationKind } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

import { loadWorkForActor } from './access';
import { getPooContent, POO_ACTIVITY_SLUG } from './catalog';
import { EspaceError } from './errors';
import type { EspaceActor } from './guards';

export const MAX_ANNOTATION_CHARS = 4000;
export const MAX_ANNOTATIONS_PER_WORK = 200;
const MAX_LINE = 10_000;

const idKey = z.string().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/);

const annotationInput = z
  .object({
    kind: z.enum(['GENERAL', 'QUESTION', 'STEP', 'CODE']),
    body: z.string().trim().min(1).max(MAX_ANNOTATION_CHARS),
    stepId: idKey.optional(),
    questionId: idKey.optional(),
    lineStart: z.number().int().min(1).max(MAX_LINE).optional(),
    lineEnd: z.number().int().min(1).max(MAX_LINE).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const need = (cond: boolean, message: string) => {
      if (!cond) ctx.addIssue({ code: 'custom', message });
    };
    if (v.kind === 'GENERAL') need(!v.stepId && !v.questionId && !v.lineStart, 'Un commentaire global ne cible rien');
    if (v.kind === 'STEP') need(!!v.stepId && !v.questionId && !v.lineStart, 'Annotation d’étape : étape requise');
    if (v.kind === 'QUESTION') need(!!v.stepId && !!v.questionId && !v.lineStart, 'Annotation de question : étape et question requises');
    if (v.kind === 'CODE') need(!!v.stepId && !!v.lineStart && !v.questionId, 'Annotation de code : étape et ligne requises');
    if (v.lineEnd !== undefined) need(v.lineStart !== undefined && v.lineEnd >= v.lineStart, 'Plage de lignes invalide');
  });

export interface AnnotationDto {
  id: string;
  kind: EspaceAnnotationKind;
  body: string;
  stepId: string | null;
  questionId: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  workRevision: number | null;
  authorName: string;
  createdAt: string;
}

function authorName(a: { firstName: string | null; lastName: string | null }): string {
  return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Enseignant';
}

export async function addAnnotation(actor: EspaceActor, workId: string, raw: unknown): Promise<AnnotationDto> {
  const { work } = await loadWorkForActor(actor, workId, 'teacher');

  const parsed = annotationInput.safeParse(raw);
  if (!parsed.success) throw new EspaceError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Annotation invalide');
  const input = parsed.data;

  if (work.activity.slug === POO_ACTIVITY_SLUG && input.stepId) {
    const step = getPooContent().steps.find((s) => s.id === input.stepId);
    if (!step) throw new EspaceError('INVALID_INPUT', 'Étape inconnue');
    if (input.questionId && !step.questions.some((q) => q.id === input.questionId) && !step.fields.some((f) => f.id === input.questionId)) {
      throw new EspaceError('INVALID_INPUT', 'Question inconnue');
    }
  }

  if ((await prisma.espaceAnnotation.count({ where: { workId } })) >= MAX_ANNOTATIONS_PER_WORK) {
    throw new EspaceError('INVALID_INPUT', 'Trop d’annotations sur ce travail');
  }

  const created = await prisma.espaceAnnotation.create({
    data: {
      workId,
      authorId: actor.id,
      kind: input.kind,
      body: input.body,
      stepId: input.stepId ?? null,
      questionId: input.questionId ?? null,
      lineStart: input.lineStart ?? null,
      lineEnd: input.lineEnd ?? input.lineStart ?? null,
      workRevision: work.revision,
    },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  return toDto(created);
}

function toDto(a: {
  id: string; kind: EspaceAnnotationKind; body: string; stepId: string | null; questionId: string | null;
  lineStart: number | null; lineEnd: number | null; workRevision: number | null; createdAt: Date;
  author: { firstName: string | null; lastName: string | null };
}): AnnotationDto {
  return {
    id: a.id,
    kind: a.kind,
    body: a.body,
    stepId: a.stepId,
    questionId: a.questionId,
    lineStart: a.lineStart,
    lineEnd: a.lineEnd,
    workRevision: a.workRevision,
    authorName: authorName(a.author),
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listAnnotations(actor: EspaceActor, workId: string): Promise<AnnotationDto[]> {
  const { work, mode } = await loadWorkForActor(actor, workId);
  if (mode === 'student' && !work.correctedAt && !work.reopenedAt) return [];
  const rows = await prisma.espaceAnnotation.findMany({
    where: { workId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  return rows.map(toDto);
}

export async function deleteAnnotation(actor: EspaceActor, workId: string, annotationId: string): Promise<void> {
  await loadWorkForActor(actor, workId, 'teacher');
  const row = await prisma.espaceAnnotation.findFirst({ where: { id: annotationId, workId }, select: { id: true, authorId: true } });
  if (!row) throw new EspaceError('NOT_FOUND', 'Annotation introuvable');
  if (row.authorId !== actor.id && actor.role !== 'ADMIN') throw new EspaceError('FORBIDDEN', 'Seul l’auteur peut supprimer cette annotation');
  await prisma.espaceAnnotation.delete({ where: { id: row.id } });
}

// ─── Bibliothèque de commentaires réutilisables ─────────────────────────────

const snippetInput = z.object({ body: z.string().trim().min(1).max(500) }).strict();
export const MAX_SNIPPETS_PER_TEACHER = 100;

export async function listSnippets(actor: EspaceActor) {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  return prisma.espaceCommentSnippet.findMany({
    where: { teacherId: actor.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, body: true },
  });
}

export async function addSnippet(actor: EspaceActor, raw: unknown) {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  const parsed = snippetInput.safeParse(raw);
  if (!parsed.success) throw new EspaceError('INVALID_INPUT', 'Commentaire invalide');
  if ((await prisma.espaceCommentSnippet.count({ where: { teacherId: actor.id } })) >= MAX_SNIPPETS_PER_TEACHER) {
    throw new EspaceError('INVALID_INPUT', 'Bibliothèque pleine');
  }
  return prisma.espaceCommentSnippet.create({ data: { teacherId: actor.id, body: parsed.data.body }, select: { id: true, body: true } });
}

export async function deleteSnippet(actor: EspaceActor, id: string): Promise<void> {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  const res = await prisma.espaceCommentSnippet.deleteMany({ where: { id, teacherId: actor.id } });
  if (res.count !== 1) throw new EspaceError('NOT_FOUND', 'Commentaire introuvable');
}
