import {
  accessPolicyForProjection,
  createAuthenticatedBilanPrincipal,
  createTemporaryBilanPrincipal,
  findAccessibleBilanRequest,
  type BilanRequestAccessPrincipal,
  type BilanRequestAccessRepository,
} from '@/lib/bilans/requests/access';

function createRepository(result: unknown = { id: 'request_1', status: 'NEW' }) {
  const findFirst = jest.fn().mockResolvedValue(result);
  const repository: BilanRequestAccessRepository = {
    bilanRequest: { findFirst },
  };

  return { repository, findFirst };
}

describe('bilan request access predicates', () => {
  const now = new Date('2026-07-29T10:00:00.000Z');
  const sessionUser = (id: string, role: 'PARENT' | 'ASSISTANTE' | 'COACH' | 'ADMIN' | 'ELEVE') => ({
    id,
    role,
  });

  it('scopes a temporary flow to its request and a live token hash in the database predicate', async () => {
    const { repository, findFirst } = createRepository();
    const principal = createTemporaryBilanPrincipal({
      requestId: 'request_1',
      tokenHash: 'a'.repeat(64),
      now,
    });
    expect(principal).not.toBeNull();

    const result = await findAccessibleBilanRequest(repository, principal!);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'request_1',
        flowSessions: {
          some: {
            tokenHash: 'a'.repeat(64),
            revokedAt: null,
            expiresAt: { gt: now },
          },
        },
      },
    }));
    expect(result?.projection).toBe('TEMPORARY_FLOW');
    expect(result?.capabilities.readFamilyHistory).toBe(false);
    expect(result?.capabilities.readFamilyFinal).toBe(false);
    expect(result?.capabilities.readStudentHistory).toBe(false);
    expect(result?.capabilities.readStudentFinal).toBe(false);
  });

  it('requires a verified parent account and a verified non-revoked child relation in the predicate', async () => {
    const { repository, findFirst } = createRepository();
    const principal = createAuthenticatedBilanPrincipal({
      requestId: 'request_1',
      now,
      sessionUser: sessionUser('parent_1', 'PARENT'),
    });

    const result = await findAccessibleBilanRequest(repository, principal!);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'request_1',
        parentUserId: 'parent_1',
        accountVerificationState: 'VERIFIED',
        student: {
          is: {
            parentLinks: {
              some: {
                parentUserId: 'parent_1',
                state: 'VERIFIED',
                revokedAt: null,
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: now } },
                ],
              },
            },
          },
        },
      },
    }));
    expect(result?.projection).toBe('FAMILY');
    expect(result?.capabilities.readFamilyFinal).toBe(true);
    expect(result?.capabilities.readFamilyHistory).toBe(true);
    expect(result?.capabilities.readStudentFinal).toBe(false);
    expect(result?.capabilities.readStudentHistory).toBe(false);
  });

  it.each([
    [null, true],
    [new Date('2026-07-29T10:00:00.001Z'), true],
    [new Date('2026-07-29T10:00:00.000Z'), false],
    [new Date('2026-07-29T09:59:59.999Z'), false],
  ])('accepts a parent link expiry %s only while it is live', async (expiresAt, accepted) => {
    const findFirst = jest.fn(async ({ where }: { where: Record<string, any> }) => {
      const expiryRules = where.student.is.parentLinks.some.OR;
      const matchesNull = expiryRules[0].expiresAt === null && expiresAt === null;
      const threshold = expiryRules[1].expiresAt.gt as Date;
      const matchesFuture = expiresAt !== null && expiresAt.getTime() > threshold.getTime();
      return matchesNull || matchesFuture ? { id: 'request_1', status: 'NEW' } : null;
    });
    const repository = { bilanRequest: { findFirst } };
    const principal = createAuthenticatedBilanPrincipal({
      requestId: 'request_1',
      now,
      sessionUser: sessionUser('parent_1', 'PARENT'),
    });

    const result = await findAccessibleBilanRequest(repository, principal!);

    expect(result !== null).toBe(accepted);
  });

  it('requires coach ownership through the assigned coach user in the predicate', async () => {
    const { repository, findFirst } = createRepository();
    const principal = createAuthenticatedBilanPrincipal({
      requestId: 'request_1',
      now,
      sessionUser: sessionUser('coach_user_1', 'COACH'),
    });

    const result = await findAccessibleBilanRequest(repository, principal!);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'request_1',
        assignedCoach: {
          is: {
            userId: 'coach_user_1',
          },
        },
      },
    }));
    expect(result?.projection).toBe('ASSIGNED_COACH');
    expect(result?.capabilities.review).toBe(true);
    expect(result?.capabilities.publish).toBe(true);
    expect(result?.capabilities.assign).toBe(false);
  });

  it('gives assistantes operational capabilities but never review or publication', async () => {
    const { repository, findFirst } = createRepository();
    const principal = createAuthenticatedBilanPrincipal({
      requestId: 'request_1',
      now,
      sessionUser: sessionUser('assistant_1', 'ASSISTANTE'),
    });

    const result = await findAccessibleBilanRequest(repository, principal!);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'request_1' },
    }));
    expect(result?.projection).toBe('OPERATIONAL');
    expect(result?.capabilities).toEqual(expect.objectContaining({
      readOperational: true,
      assign: true,
      retryTechnical: true,
      review: false,
      publish: false,
      readFamilyFinal: false,
      readFamilyHistory: false,
      readStudentFinal: false,
      readStudentHistory: false,
    }));
  });

  it('gives admins transversal capabilities', async () => {
    const { repository } = createRepository();
    const principal = createAuthenticatedBilanPrincipal({
      requestId: 'request_1',
      now,
      sessionUser: sessionUser('admin_1', 'ADMIN'),
    });

    const result = await findAccessibleBilanRequest(repository, principal!);

    expect(result?.projection).toBe('ADMIN');
    expect(result?.capabilities).toEqual({
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
    });
  });

  it('requires an activated owned student and a verified request before family access', async () => {
    const { repository, findFirst } = createRepository();
    const principal = createAuthenticatedBilanPrincipal({
      requestId: 'request_1',
      now,
      sessionUser: sessionUser('student_user_1', 'ELEVE'),
    });

    const result = await findAccessibleBilanRequest(repository, principal!);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'request_1',
        accountVerificationState: 'VERIFIED',
        student: {
          is: {
            userId: 'student_user_1',
            user: {
              is: {
                activatedAt: { not: null },
              },
            },
          },
        },
      },
    }));
    expect(result?.projection).toBe('STUDENT');
    expect(result?.capabilities).toEqual(expect.objectContaining({
      readFamilyFinal: false,
      readFamilyHistory: false,
      readStudentFinal: true,
      readStudentHistory: true,
    }));
  });

  it('returns the same null result for missing and unauthorized requests without identity fields', async () => {
    const { repository, findFirst } = createRepository(null);
    const principal = createAuthenticatedBilanPrincipal({
      requestId: 'request_missing_or_foreign',
      now,
      sessionUser: sessionUser('parent_1', 'PARENT'),
    });

    const result = await findAccessibleBilanRequest(repository, principal!);

    expect(result).toBeNull();
    const serializedQuery = JSON.stringify(findFirst.mock.calls[0]);
    for (const identityField of [
      '"email"',
      '"firstName"',
      '"lastName"',
      '"phone"',
      '"school"',
      '"provisionalChildFirstName"',
      '"provisionalChildLastName"',
      '"provisionalChildSchoolName"',
    ]) {
      expect(serializedQuery).not.toContain(identityField);
    }
  });

  it('derives a staff or family role only from the verified session user', () => {
    const forgedOverride = createAuthenticatedBilanPrincipal({
      requestId: 'request_1',
      now,
      sessionUser: sessionUser('parent_1', 'PARENT'),
      role: 'ADMIN',
      kind: 'ASSISTANTE',
    } as never);

    expect(forgedOverride).toEqual(expect.objectContaining({
      kind: 'PARENT',
      userId: 'parent_1',
    }));
    expect(createAuthenticatedBilanPrincipal({
      requestId: 'request_1',
      now,
      sessionUser: { id: 'user_1', role: 'UNKNOWN' },
    })).toBeNull();
    expect(createAuthenticatedBilanPrincipal({
      requestId: 'request_1',
      now,
      sessionUser: null,
    })).toBeNull();
  });

  it('does not accept a structurally forged access principal', () => {
    const forged = {
      kind: 'ADMIN',
      requestId: 'request_1',
      userId: 'attacker_1',
      now,
    } as const;

    // @ts-expect-error Access principals must be created by a trusted factory.
    const shouldNotCompile: BilanRequestAccessPrincipal = forged;
    expect(shouldNotCompile.kind).toBe('ADMIN');
  });

  it('keeps projection policies explicit and exhaustive', () => {
    expect(accessPolicyForProjection('TEMPORARY_FLOW')).toEqual(expect.objectContaining({
      readCurrentRequest: true,
      readFamilyFinal: false,
      readFamilyHistory: false,
      readStudentFinal: false,
      readStudentHistory: false,
    }));
    expect(accessPolicyForProjection('FAMILY')).toEqual(expect.objectContaining({
      readFamilyFinal: true,
      readFamilyHistory: true,
      readStudentFinal: false,
      readStudentHistory: false,
    }));
    expect(accessPolicyForProjection('STUDENT')).toEqual(expect.objectContaining({
      readFamilyFinal: false,
      readFamilyHistory: false,
      readStudentFinal: true,
      readStudentHistory: true,
    }));
    expect(accessPolicyForProjection('ASSIGNED_COACH')).toEqual(expect.objectContaining({
      readOperational: true,
      review: true,
      publish: true,
    }));
    expect(accessPolicyForProjection('OPERATIONAL')).toEqual(expect.objectContaining({
      assign: true,
      retryTechnical: true,
      review: false,
      publish: false,
    }));
  });
});
