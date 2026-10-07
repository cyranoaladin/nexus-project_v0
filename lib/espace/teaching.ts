import type { Subject } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { EspaceActor } from './guards';

/** L'enseignant enseigne-t-il cette matière à ce groupe ? (ADMIN : oui.) */
export async function teacherTeachesGroupSubject(actor: EspaceActor, groupId: string, subject: Subject): Promise<boolean> {
  if (actor.role === 'ADMIN') return true;
  if (actor.role !== 'COACH') return false;
  const row = await prisma.espaceTeacherAssignment.findFirst({
    where: { teacherId: actor.id, groupId, subject },
    select: { id: true },
  });
  return row !== null;
}
