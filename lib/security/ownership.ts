import type { Prisma } from '@prisma/client';

type SessionUserLike = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

const STAFF_ROLES = new Set(['ADMIN', 'ASSISTANTE']);
const INTERNAL_BILAN_ROLES = new Set(['ADMIN', 'ASSISTANTE', 'COACH']);

function activeAssignmentClause(now: Date = new Date()): Prisma.CoachStudentAssignmentWhereInput {
  return {
    status: 'ACTIVE',
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gte: now } }],
  };
}

export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.has(role ?? '');
}

export function canSeeInternalBilan(role: string | null | undefined): boolean {
  return INTERNAL_BILAN_ROLES.has(role ?? '');
}

export function buildAssessmentAccessWhere(
  assessmentId: string,
  user: SessionUserLike
): Prisma.AssessmentWhereInput | null {
  if (!assessmentId || !user.id || !user.role) return null;

  if (isStaffRole(user.role)) {
    return { id: assessmentId };
  }

  if (user.role === 'ELEVE') {
    return {
      id: assessmentId,
      OR: [
        { student: { is: { userId: user.id } } },
        ...(user.email ? [{ studentEmail: user.email }] : []),
      ],
    };
  }

  if (user.role === 'PARENT') {
    return {
      id: assessmentId,
      student: { is: { parent: { userId: user.id } } },
    };
  }

  if (user.role === 'COACH') {
    return {
      id: assessmentId,
      student: {
        is: {
          coachAssignments: {
            some: {
              coach: { userId: user.id },
              ...activeAssignmentClause(),
            },
          },
        },
      },
    };
  }

  return null;
}

export function buildBilanReadWhere(
  bilanId: string,
  user: SessionUserLike
): Prisma.BilanWhereInput | null {
  if (!bilanId || !user.id || !user.role) return null;

  if (isStaffRole(user.role)) {
    return { id: bilanId };
  }

  if (user.role === 'ELEVE') {
    return {
      id: bilanId,
      isPublished: true,
      OR: [
        { student: { is: { userId: user.id } } },
        ...(user.email ? [{ studentEmail: user.email }] : []),
      ],
    };
  }

  if (user.role === 'PARENT') {
    return {
      id: bilanId,
      isPublished: true,
      student: { is: { parent: { userId: user.id } } },
    };
  }

  if (user.role === 'COACH') {
    return {
      id: bilanId,
      OR: [
        { coach: { userId: user.id } },
        {
          student: {
            is: {
              coachAssignments: {
                some: {
                  coach: { userId: user.id },
                  ...activeAssignmentClause(),
                },
              },
            },
          },
        },
      ],
    };
  }

  return null;
}

export function buildBilanWriteWhere(
  bilanId: string,
  user: SessionUserLike
): Prisma.BilanWhereInput | null {
  if (!bilanId || !user.id || !user.role) return null;

  if (isStaffRole(user.role)) {
    return { id: bilanId };
  }

  if (user.role === 'COACH') {
    return {
      id: bilanId,
      OR: [
        { coach: { userId: user.id } },
        {
          student: {
            is: {
              coachAssignments: {
                some: {
                  coach: { userId: user.id },
                  ...activeAssignmentClause(),
                },
              },
            },
          },
        },
      ],
    };
  }

  return null;
}

export function sanitizeBilanForRole<T extends Record<string, unknown>>(
  bilan: T,
  role: string | null | undefined
): T {
  if (canSeeInternalBilan(role)) return bilan;

  const sanitized = { ...bilan };
  delete sanitized.nexusMarkdown;
  delete sanitized.errorDetails;
  delete sanitized.sourceData;
  delete sanitized.analysisJson;
  return sanitized as T;
}
