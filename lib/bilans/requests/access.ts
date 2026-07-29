import 'server-only';

export const BILAN_ACCESS_PROJECTIONS = [
  'TEMPORARY_FLOW',
  'FAMILY',
  'STUDENT',
  'OPERATIONAL',
  'ASSIGNED_COACH',
  'ADMIN',
] as const;

export type BilanAccessProjection = (typeof BILAN_ACCESS_PROJECTIONS)[number];

export type BilanAccessCapabilities = Readonly<{
  readCurrentRequest: boolean;
  readOperational: boolean;
  assign: boolean;
  retryTechnical: boolean;
  review: boolean;
  publish: boolean;
  readFamilyFinal: boolean;
  readFamilyHistory: boolean;
  readStudentFinal: boolean;
  readStudentHistory: boolean;
}>;

type TemporaryFlowPrincipal = Readonly<{
  kind: 'TEMPORARY_FLOW';
  requestId: string;
  tokenHash: string;
  now: Date;
}>;

type AuthenticatedPrincipal = Readonly<{
  kind: 'PARENT' | 'ASSISTANTE' | 'COACH' | 'ADMIN' | 'ELEVE';
  requestId: string;
  userId: string;
  now: Date;
}>;

export type BilanRequestAccessPrincipal = TemporaryFlowPrincipal | AuthenticatedPrincipal;

type FindFirstArguments = Readonly<{
  where: Readonly<Record<string, unknown>>;
  select: Readonly<Record<string, boolean>>;
}>;

export type BilanRequestAccessRepository = Readonly<{
  bilanRequest: Readonly<{
    findFirst: (arguments_: FindFirstArguments) => Promise<unknown | null>;
  }>;
}>;

export type AccessibleBilanRequest = Readonly<{
  request: unknown;
  projection: BilanAccessProjection;
  capabilities: BilanAccessCapabilities;
}>;

const SAFE_REQUEST_SELECT = {
  id: true,
  status: true,
  accountVerificationState: true,
  subject: true,
  gradeLevel: true,
  schoolYear: true,
  studentId: true,
  canonicalAttemptId: true,
  assignedCoachId: true,
  createdAt: true,
  updatedAt: true,
  lastActivityAt: true,
  submittedAt: true,
  reviewedAt: true,
  publishedAt: true,
} as const;

const NO_PRIVILEGES: BilanAccessCapabilities = {
  readCurrentRequest: false,
  readOperational: false,
  assign: false,
  retryTechnical: false,
  review: false,
  publish: false,
  readFamilyFinal: false,
  readFamilyHistory: false,
  readStudentFinal: false,
  readStudentHistory: false,
};

export function accessPolicyForProjection(
  projection: BilanAccessProjection,
): BilanAccessCapabilities {
  switch (projection) {
    case 'TEMPORARY_FLOW':
      return {
        ...NO_PRIVILEGES,
        readCurrentRequest: true,
      };
    case 'FAMILY':
      return {
        ...NO_PRIVILEGES,
        readCurrentRequest: true,
        readFamilyFinal: true,
        readFamilyHistory: true,
      };
    case 'STUDENT':
      return {
        ...NO_PRIVILEGES,
        readCurrentRequest: true,
        readStudentFinal: true,
        readStudentHistory: true,
      };
    case 'OPERATIONAL':
      return {
        ...NO_PRIVILEGES,
        readCurrentRequest: true,
        readOperational: true,
        assign: true,
        retryTechnical: true,
      };
    case 'ASSIGNED_COACH':
      return {
        ...NO_PRIVILEGES,
        readCurrentRequest: true,
        readOperational: true,
        review: true,
        publish: true,
      };
    case 'ADMIN':
      return {
        readCurrentRequest: true,
        readOperational: true,
        assign: true,
        retryTechnical: true,
        review: true,
        publish: true,
        readFamilyFinal: true,
        readFamilyHistory: true,
        readStudentFinal: true,
        readStudentHistory: true,
      };
    default: {
      const exhaustive: never = projection;
      return exhaustive;
    }
  }
}

function accessPredicate(
  principal: BilanRequestAccessPrincipal,
): { where: Readonly<Record<string, unknown>>; projection: BilanAccessProjection } {
  switch (principal.kind) {
    case 'TEMPORARY_FLOW':
      return {
        projection: 'TEMPORARY_FLOW',
        where: {
          id: principal.requestId,
          flowSessions: {
            some: {
              tokenHash: principal.tokenHash,
              revokedAt: null,
              expiresAt: { gt: principal.now },
            },
          },
        },
      };
    case 'PARENT':
      return {
        projection: 'FAMILY',
        where: {
          id: principal.requestId,
          parentUserId: principal.userId,
          accountVerificationState: 'VERIFIED',
          student: {
            is: {
              parentLinks: {
                some: {
                  parentUserId: principal.userId,
                  state: 'VERIFIED',
                  revokedAt: null,
                },
              },
            },
          },
        },
      };
    case 'COACH':
      return {
        projection: 'ASSIGNED_COACH',
        where: {
          id: principal.requestId,
          assignedCoach: {
            is: {
              userId: principal.userId,
            },
          },
        },
      };
    case 'ASSISTANTE':
      return {
        projection: 'OPERATIONAL',
        where: { id: principal.requestId },
      };
    case 'ADMIN':
      return {
        projection: 'ADMIN',
        where: { id: principal.requestId },
      };
    case 'ELEVE':
      return {
        projection: 'STUDENT',
        where: {
          id: principal.requestId,
          accountVerificationState: 'VERIFIED',
          student: {
            is: {
              userId: principal.userId,
              user: {
                is: {
                  activatedAt: { not: null },
                },
              },
            },
          },
        },
      };
    default: {
      const exhaustive: never = principal;
      return exhaustive;
    }
  }
}

export async function findAccessibleBilanRequest(
  repository: BilanRequestAccessRepository,
  principal: BilanRequestAccessPrincipal,
): Promise<AccessibleBilanRequest | null> {
  const { where, projection } = accessPredicate(principal);
  const request = await repository.bilanRequest.findFirst({
    where,
    select: SAFE_REQUEST_SELECT,
  });

  if (request === null) {
    return null;
  }

  return {
    request,
    projection,
    capabilities: accessPolicyForProjection(projection),
  };
}
