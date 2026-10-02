/**
 * Séances pédagogiques : une séance publiée apparaît automatiquement chez ses
 * participants (inscrits au groupe pour la matière au moment de la publication).
 */
import type { Subject } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

import { teacherTeachesGroupSubject } from './teaching';
import { EspaceError } from './errors';
import type { EspaceActor } from './guards';

const createInput = z
  .object({
    groupId: z.string().min(1).max(64),
    subject: z.enum(['MATHEMATIQUES', 'NSI', 'MATHS_EXPERTES']),
    activitySlug: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(120).optional(),
    scheduledAt: z.string().datetime().optional(),
  })
  .strict();

export async function createSession(actor: EspaceActor, raw: unknown) {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) throw new EspaceError('INVALID_INPUT', 'Séance invalide');
  const input = parsed.data;

  if (!(await teacherTeachesGroupSubject(actor, input.groupId, input.subject as Subject))) {
    throw new EspaceError('FORBIDDEN', 'Vous n’enseignez pas cette matière à ce groupe');
  }
  const activity = await prisma.espaceActivity.findUnique({ where: { slug: input.activitySlug } });
  if (!activity || activity.subject !== input.subject) throw new EspaceError('INVALID_INPUT', 'Activité incompatible avec la matière');

  return prisma.espaceSession.create({
    data: {
      groupId: input.groupId,
      subject: input.subject,
      activityId: activity.id,
      teacherId: actor.id,
      title: input.title ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    },
    select: { id: true, status: true },
  });
}

async function loadOwnedSession(actor: EspaceActor, id: string) {
  const session = await prisma.espaceSession.findUnique({ where: { id } });
  if (!session) throw new EspaceError('NOT_FOUND', 'Séance introuvable');
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  if (!(await teacherTeachesGroupSubject(actor, session.groupId, session.subject))) {
    throw new EspaceError('NOT_FOUND', 'Séance introuvable');
  }
  return session;
}

export async function publishSession(actor: EspaceActor, id: string) {
  const session = await loadOwnedSession(actor, id);
  if (session.status === 'CLOSED') throw new EspaceError('INVALID_TRANSITION', 'Séance clôturée');

  const enrolled = await prisma.espaceEnrollment.findMany({
    where: { groupId: session.groupId, subject: session.subject },
    select: { userId: true },
  });
  await prisma.$transaction([
    prisma.espaceSessionParticipant.createMany({
      data: enrolled.map((e) => ({ sessionId: session.id, userId: e.userId })),
      skipDuplicates: true,
    }),
    prisma.espaceSession.update({
      where: { id: session.id },
      data: { status: 'PUBLISHED', publishedAt: session.publishedAt ?? new Date() },
    }),
  ]);
  return { id: session.id, status: 'PUBLISHED' as const, participants: enrolled.length };
}

export async function closeSession(actor: EspaceActor, id: string) {
  const session = await loadOwnedSession(actor, id);
  if (session.status !== 'PUBLISHED') throw new EspaceError('INVALID_TRANSITION', 'Seule une séance publiée peut être clôturée');
  await prisma.espaceSession.update({ where: { id: session.id }, data: { status: 'CLOSED', closedAt: new Date() } });
  return { id: session.id, status: 'CLOSED' as const };
}

/** Séances publiées où l'élève est participant, avec le travail déjà ouvert s'il existe. */
export async function listPublishedSessionsForStudent(userId: string) {
  return prisma.espaceSession.findMany({
    where: { status: 'PUBLISHED', participants: { some: { userId } } },
    orderBy: [{ scheduledAt: 'asc' }, { publishedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      subject: true,
      scheduledAt: true,
      activity: { select: { slug: true, title: true, moduleSlug: true, stepsTotal: true, kind: true } },
      works: { where: { studentId: userId }, select: { id: true, status: true, progressSteps: true, lastSavedAt: true }, take: 1 },
    },
  });
}

export async function listSessionsForTeacher(actor: EspaceActor) {
  if (actor.role === 'ELEVE') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  return prisma.espaceSession.findMany({
    where: actor.role === 'ADMIN' ? {} : { teacherId: actor.id },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      title: true,
      subject: true,
      status: true,
      scheduledAt: true,
      group: { select: { id: true, name: true } },
      activity: { select: { slug: true, title: true } },
      _count: { select: { participants: true } },
    },
  });
}
