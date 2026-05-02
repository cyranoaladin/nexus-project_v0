import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface NpcActor {
  userId: string;
  role: UserRole;
}

export interface AccessibleSubmission {
  id: string;
  studentId: string;
  coachId: string | null;
}

export async function canManageSubmissionDocuments(
  actor: NpcActor,
  submission: AccessibleSubmission
): Promise<boolean> {
  if (actor.role === UserRole.ADMIN || actor.role === UserRole.ASSISTANTE) {
    return true;
  }

  if (actor.role !== UserRole.COACH) {
    return false;
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });

  if (!coach) {
    return false;
  }

  if (submission.coachId === coach.id) {
    return true;
  }

  const assignment = await prisma.coachStudentAssignment.findFirst({
    where: {
      coachId: coach.id,
      studentId: submission.studentId,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

export async function canReadSubmission(
  actor: NpcActor,
  submission: AccessibleSubmission
): Promise<boolean> {
  if (await canManageSubmissionDocuments(actor, submission)) {
    return true;
  }

  if (actor.role === UserRole.ELEVE) {
    const student = await prisma.student.findFirst({
      where: { id: submission.studentId, userId: actor.userId },
      select: { id: true },
    });
    return Boolean(student);
  }

  if (actor.role === UserRole.PARENT) {
    const parent = await prisma.parentProfile.findFirst({
      where: { userId: actor.userId },
      include: { children: { select: { id: true } } },
    });
    return Boolean(parent?.children.some((child) => child.id === submission.studentId));
  }

  return false;
}
