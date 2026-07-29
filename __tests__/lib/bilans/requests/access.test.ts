import {
  accessPolicyForProjection,
  findAccessibleBilanRequest,
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

  it('scopes a temporary flow to its request and a live token hash in the database predicate', async () => {
    const { repository, findFirst } = createRepository();

    const result = await findAccessibleBilanRequest(repository, {
      kind: 'TEMPORARY_FLOW',
      requestId: 'request_1',
      tokenHash: 'a'.repeat(64),
      now,
    });

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
  });

  it('requires a verified parent account and a verified non-revoked child relation in the predicate', async () => {
    const { repository, findFirst } = createRepository();

    const result = await findAccessibleBilanRequest(repository, {
      kind: 'PARENT',
      requestId: 'request_1',
      userId: 'parent_1',
      now,
    });

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
              },
            },
          },
        },
      },
    }));
    expect(result?.projection).toBe('FAMILY');
    expect(result?.capabilities.readFamilyFinal).toBe(true);
    expect(result?.capabilities.readFamilyHistory).toBe(true);
  });

  it('requires coach ownership through the assigned coach user in the predicate', async () => {
    const { repository, findFirst } = createRepository();

    const result = await findAccessibleBilanRequest(repository, {
      kind: 'COACH',
      requestId: 'request_1',
      userId: 'coach_user_1',
      now,
    });

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

    const result = await findAccessibleBilanRequest(repository, {
      kind: 'ASSISTANTE',
      requestId: 'request_1',
      userId: 'assistant_1',
      now,
    });

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
    }));
  });

  it('gives admins transversal capabilities', async () => {
    const { repository } = createRepository();

    const result = await findAccessibleBilanRequest(repository, {
      kind: 'ADMIN',
      requestId: 'request_1',
      userId: 'admin_1',
      now,
    });

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
    });
  });

  it('requires an activated owned student and a verified request before family access', async () => {
    const { repository, findFirst } = createRepository();

    const result = await findAccessibleBilanRequest(repository, {
      kind: 'ELEVE',
      requestId: 'request_1',
      userId: 'student_user_1',
      now,
    });

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
  });

  it('returns the same null result for missing and unauthorized requests without identity fields', async () => {
    const { repository, findFirst } = createRepository(null);

    const result = await findAccessibleBilanRequest(repository, {
      kind: 'PARENT',
      requestId: 'request_missing_or_foreign',
      userId: 'parent_1',
      now,
    });

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

  it('keeps projection policies explicit and exhaustive', () => {
    expect(accessPolicyForProjection('TEMPORARY_FLOW')).toEqual(expect.objectContaining({
      readCurrentRequest: true,
      readFamilyFinal: false,
      readFamilyHistory: false,
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
