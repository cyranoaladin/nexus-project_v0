import { prisma } from '@/lib/prisma';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';

const STAFF_ROLES = new Set(['ADMIN', 'ASSISTANTE']);

type RoleLike = string | null | undefined;

type UserLike = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: RoleLike;
};

type MessageLike = {
  id: string;
  content: string;
  createdAt?: Date | string | null;
  readAt?: Date | string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  sender?: UserLike | null;
  receiver?: UserLike | null;
};

export function isStaffRole(role: RoleLike): boolean {
  return STAFF_ROLES.has(role ?? '');
}

export function sanitizeMessageUser(user: UserLike | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    role: user.role ?? '',
  };
}

export function sanitizeMessage(message: MessageLike) {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt ?? null,
    readAt: message.readAt ?? null,
    hasAttachment: Boolean(message.fileUrl || message.fileName),
    sender: sanitizeMessageUser(message.sender),
    receiver: sanitizeMessageUser(message.receiver),
  };
}

async function roleForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role ?? null;
}

async function coachProfileIdForUser(userId: string): Promise<string | null> {
  const coach = await prisma.coachProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return coach?.id ?? null;
}

async function studentIdForUser(userId: string): Promise<string | null> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  return student?.id ?? null;
}

async function coachAssignedToStudentUser(coachUserId: string, studentUserId: string): Promise<boolean> {
  const [coachId, studentId] = await Promise.all([
    coachProfileIdForUser(coachUserId),
    studentIdForUser(studentUserId),
  ]);

  if (!coachId || !studentId) return false;

  const assignment = await prisma.coachStudentAssignment.findFirst({
    where: {
      coachId,
      studentId,
      ...activeAssignmentWhere(),
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

async function coachAssignedToParentChild(coachUserId: string, parentUserId: string): Promise<boolean> {
  const coachId = await coachProfileIdForUser(coachUserId);
  if (!coachId) return false;

  const parent = await prisma.parentProfile.findFirst({
    where: {
      userId: parentUserId,
      children: {
        some: {
          coachAssignments: {
            some: {
              coachId,
              ...activeAssignmentWhere(),
            },
          },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(parent);
}

export async function canSendMessageToReceiver({
  senderUserId,
  senderRole,
  receiverUserId,
  receiverRole,
}: {
  senderUserId: string;
  senderRole: string;
  receiverUserId: string;
  receiverRole?: string;
}): Promise<boolean> {
  if (!senderUserId || !receiverUserId || senderUserId === receiverUserId) {
    return false;
  }

  const resolvedReceiverRole = receiverRole ?? await roleForUser(receiverUserId);
  if (!resolvedReceiverRole) {
    return false;
  }

  if (isStaffRole(senderRole) || isStaffRole(resolvedReceiverRole)) {
    return true;
  }

  if (senderRole === 'COACH' && resolvedReceiverRole === 'ELEVE') {
    return coachAssignedToStudentUser(senderUserId, receiverUserId);
  }

  if (senderRole === 'COACH' && resolvedReceiverRole === 'PARENT') {
    return coachAssignedToParentChild(senderUserId, receiverUserId);
  }

  if (senderRole === 'ELEVE' && resolvedReceiverRole === 'COACH') {
    return coachAssignedToStudentUser(receiverUserId, senderUserId);
  }

  if (senderRole === 'PARENT' && resolvedReceiverRole === 'COACH') {
    return coachAssignedToParentChild(receiverUserId, senderUserId);
  }

  return false;
}
