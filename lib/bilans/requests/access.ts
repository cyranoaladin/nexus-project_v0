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

const bilanPrincipalBrand: unique symbol = Symbol('BilanRequestAccessPrincipal');

type TrustedPrincipal = Readonly<{
  [bilanPrincipalBrand]: true;
}>;

type TemporaryFlowPrincipal = Readonly<{
  kind: 'TEMPORARY_FLOW';
  requestId: string;
  tokenHash: string;
  now: Date;
}> & TrustedPrincipal;

type AuthenticatedPrincipal = Readonly<{
  kind: 'PARENT' | 'ASSISTANTE' | 'COACH' | 'ADMIN' | 'ELEVE';
  requestId: string;
  userId: string;
  now: Date;
}> & TrustedPrincipal;

export type BilanRequestAccessPrincipal = TemporaryFlowPrincipal | AuthenticatedPrincipal;

type AuthenticatedBilanSessionUser = Readonly<{
  id?: unknown;
  role?: unknown;
}> | null | undefined;

const AUTHENTICATED_BILAN_ROLES = new Set([
  'PARENT',
  'ASSISTANTE',
  'COACH',
  'ADMIN',
  'ELEVE',
] as const);

function isValidPrincipalIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value);
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function createTemporaryBilanPrincipal(input: Readonly<{
  requestId: string;
  tokenHash: string;
  now: Date;
}>): TemporaryFlowPrincipal | null {
  if (!isValidPrincipalIdentifier(input.requestId)
    || !/^[a-f0-9]{64}$/.test(input.tokenHash)
    || !isValidDate(input.now)) {
    return null;
  }

  return Object.freeze({
    [bilanPrincipalBrand]: true as const,
    kind: 'TEMPORARY_FLOW' as const,
    requestId: input.requestId,
    tokenHash: input.tokenHash,
    now: input.now,
  });
}

export function createAuthenticatedBilanPrincipal(input: Readonly<{
  requestId: string;
  now: Date;
  sessionUser: AuthenticatedBilanSessionUser;
}>): AuthenticatedPrincipal | null {
  const { sessionUser } = input;
  if (!isValidPrincipalIdentifier(input.requestId)
    || !isValidDate(input.now)
    || !sessionUser
    || !isValidPrincipalIdentifier(sessionUser.id)
    || typeof sessionUser.role !== 'string'
    || !AUTHENTICATED_BILAN_ROLES.has(
      sessionUser.role as 'PARENT' | 'ASSISTANTE' | 'COACH' | 'ADMIN' | 'ELEVE',
    )) {
    return null;
  }

  return Object.freeze({
    [bilanPrincipalBrand]: true as const,
    kind: sessionUser.role as AuthenticatedPrincipal['kind'],
    requestId: input.requestId,
    userId: sessionUser.id,
    now: input.now,
  });
}

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

function isTrustedBilanPrincipal(value: unknown): value is BilanRequestAccessPrincipal {
  return typeof value === 'object'
    && value !== null
    && (value as Partial<TrustedPrincipal>)[bilanPrincipalBrand] === true;
}

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
          OR: [
            { studentId: null },
            {
              student: {
                is: {
                  parentLinks: {
                    some: {
                      parentUserId: principal.userId,
                      state: 'VERIFIED',
                      revokedAt: null,
                      OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: principal.now } },
                      ],
                    },
                  },
                },
              },
            },
          ],
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
  if (!isTrustedBilanPrincipal(principal)) {
    return null;
  }

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
