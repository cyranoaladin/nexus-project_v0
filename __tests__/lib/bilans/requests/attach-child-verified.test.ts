import { attachChildToVerifiedRequest } from '@/lib/bilans/requests/attach-child';

const NOW = new Date('2026-07-29T12:00:00.000Z');
const REQUEST_ID = 'crequest0000000000000001';
const PARENT_ID = 'cparent000000000000000001';
const PARENT_PROFILE_ID = 'cprofile00000000000000001';
const STUDENT_ID = 'cstudent00000000000000001';
const STUDENT_USER_ID = 'cstudentuser0000000000001';
const LINK_ID = 'clink00000000000000000001';

type FakeOptions = Readonly<{
  request?: Partial<{
    parentUserId: string;
    accountVerificationState: string;
    status: string;
    studentId: string | null;
  }> | null;
  links?: ReadonlyArray<Readonly<{
    id: string;
    studentId: string;
  }>>;
  updateCounts?: number[];
  transactionErrors?: unknown[];
}>;

function fakePrisma(options: FakeOptions = {}) {
  const request = options.request === null ? null : {
    id: REQUEST_ID,
    parentUserId: PARENT_ID,
    accountVerificationState: 'VERIFIED',
    status: 'NEW',
    studentId: null,
    gradeLevel: 'TERMINALE',
    subject: 'MATHEMATIQUES',
    ...options.request,
  };
  const updateCounts = [...(options.updateCounts ?? [1])];
  const tx = {
    bilanRequest: {
      findFirst: jest.fn().mockResolvedValue(request),
      updateMany: jest.fn(async () => ({ count: updateCounts.shift() ?? 0 })),
    },
    parentStudentLink: {
      findMany: jest.fn().mockResolvedValue(options.links ?? [{
        id: LINK_ID,
        studentId: STUDENT_ID,
      }]),
      create: jest.fn().mockResolvedValue({ id: LINK_ID }),
    },
    parentProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: PARENT_PROFILE_ID }),
    },
    user: {
      create: jest.fn().mockResolvedValue({ id: STUDENT_USER_ID }),
    },
    student: {
      create: jest.fn().mockResolvedValue({ id: STUDENT_ID }),
    },
    bilanRequestEvent: {
      create: jest.fn().mockResolvedValue({ id: 'cevent000000000000000001' }),
    },
  };
  const transactionErrors = [...(options.transactionErrors ?? [])];
  const client = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => {
      const error = transactionErrors.shift();
      if (error) throw error;
      return callback(tx);
    }),
  };
  return { client, tx };
}

describe('attachChildToVerifiedRequest', () => {
  it('selects only one live verified parent/student link and conditionally attaches it', async () => {
    const repository = fakePrisma();

    await expect(attachChildToVerifiedRequest({
      prisma: repository.client as never,
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      command: {
        action: 'SELECT_EXISTING',
        studentId: STUDENT_ID,
      },
      now: NOW,
    })).resolves.toEqual({ attached: true, studentId: STUDENT_ID });

    expect(repository.tx.bilanRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: REQUEST_ID,
        parentUserId: PARENT_ID,
        accountVerificationState: 'VERIFIED',
        status: { notIn: ['CANCELLED', 'HUMAN_FOLLOWUP_REQUIRED'] },
        parentUser: {
          is: {
            role: 'PARENT',
            activatedAt: { not: null },
          },
        },
      },
      select: {
        id: true,
        parentUserId: true,
        accountVerificationState: true,
        status: true,
        studentId: true,
        gradeLevel: true,
        subject: true,
      },
    });
    expect(repository.tx.parentStudentLink.findMany).toHaveBeenCalledWith({
      where: {
        parentUserId: PARENT_ID,
        studentId: STUDENT_ID,
        state: 'VERIFIED',
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
      },
      select: { id: true, studentId: true },
      take: 2,
    });
    expect(repository.tx.bilanRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: REQUEST_ID,
        parentUserId: PARENT_ID,
        accountVerificationState: 'VERIFIED',
        status: 'NEW',
        studentId: null,
      },
      data: {
        studentId: STUDENT_ID,
        provisionalChildFirstName: null,
        provisionalChildLastName: null,
        provisionalChildSchoolName: null,
        status: 'READY_FOR_ASSESSMENT',
        lastActivityAt: NOW,
      },
    });
    expect(repository.tx.bilanRequestEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: REQUEST_ID,
        type: 'CHILD_SELECTED',
        actor: 'PARENT_FLOW',
        payload: { studentId: STUDENT_ID },
        occurredAt: NOW,
      }),
    });
  });

  it.each([
    ['missing request', { request: null }],
    ['cross-parent request', { request: { parentUserId: 'other_parent' } }],
    ['unverified request', { request: { accountVerificationState: 'UNVERIFIED' } }],
    ['cancelled request', { request: { status: 'CANCELLED' } }],
    ['human follow-up request', { request: { status: 'HUMAN_FOLLOWUP_REQUIRED' } }],
    ['missing child link', { links: [] }],
    ['ambiguous child links', {
      links: [
        { id: LINK_ID, studentId: STUDENT_ID },
        { id: 'clink00000000000000000002', studentId: STUDENT_ID },
      ],
    }],
  ])('fails closed for %s', async (_label, options) => {
    const repository = fakePrisma(options as FakeOptions);
    await expect(attachChildToVerifiedRequest({
      prisma: repository.client as never,
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      command: { action: 'SELECT_EXISTING', studentId: STUDENT_ID },
      now: NOW,
    })).rejects.toMatchObject({
      code: expect.stringMatching(/^BILAN_/),
    });
    expect(repository.tx.bilanRequestEvent.create).not.toHaveBeenCalled();
  });

  it('creates an inactive child with opaque email and a canonical verified link atomically', async () => {
    const repository = fakePrisma({ links: [] });
    const child = {
      firstName: 'Inès',
      lastName: 'Ben Salah',
      schoolName: 'Lycée Pierre Mendès France',
    };

    await attachChildToVerifiedRequest({
      prisma: repository.client as never,
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      command: { action: 'CREATE_NEW', child },
      now: NOW,
    });

    expect(repository.tx.user.create).toHaveBeenCalledWith({
      data: {
        email: expect.stringMatching(
          /^child\+[a-f0-9]{24}@nexus-student\.local$/,
        ),
        role: 'ELEVE',
        firstName: child.firstName,
        lastName: child.lastName,
        password: null,
        activatedAt: null,
      },
      select: { id: true },
    });
    expect(repository.tx.student.create).toHaveBeenCalledWith({
      data: {
        parentId: PARENT_PROFILE_ID,
        userId: STUDENT_USER_ID,
        grade: 'TERMINALE',
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        specialties: ['MATHEMATIQUES'],
        school: child.schoolName,
      },
      select: { id: true },
    });
    expect(repository.tx.parentStudentLink.create).toHaveBeenCalledWith({
      data: {
        parentUserId: PARENT_ID,
        studentId: STUDENT_ID,
        state: 'VERIFIED',
        consentedAt: NOW,
        verifiedAt: NOW,
      },
      select: { id: true },
    });
    expect(repository.tx.bilanRequestEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'CHILD_CREATED',
        payload: { studentId: STUDENT_ID },
      }),
    });
    const event = JSON.stringify(repository.tx.bilanRequestEvent.create.mock.calls);
    expect(event).not.toContain(child.firstName);
    expect(event).not.toContain(child.lastName);
    expect(event).not.toContain(child.schoolName);
  });

  it('verifies a request-bound existing parent session before attaching in the same transaction', async () => {
    const repository = fakePrisma({
      request: { accountVerificationState: 'VERIFICATION_PENDING' },
      updateCounts: [1, 1],
    });

    await expect(attachChildToVerifiedRequest({
      prisma: repository.client as never,
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      command: { action: 'SELECT_EXISTING', studentId: STUDENT_ID },
      existingSessionFlowTokenHash: 'a'.repeat(64),
      now: NOW,
    })).resolves.toEqual({ attached: true, studentId: STUDENT_ID });

    expect(repository.tx.bilanRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          flowSessions: {
            some: {
              tokenHash: 'a'.repeat(64),
              revokedAt: null,
              expiresAt: { gt: NOW },
            },
          },
        }),
      }),
    );
    expect(repository.tx.bilanRequest.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: REQUEST_ID,
        parentUserId: PARENT_ID,
        accountVerificationState: 'VERIFICATION_PENDING',
        status: { notIn: ['CANCELLED', 'HUMAN_FOLLOWUP_REQUIRED'] },
        flowSessions: {
          some: {
            tokenHash: 'a'.repeat(64),
            revokedAt: null,
            expiresAt: { gt: NOW },
          },
        },
      },
      data: {
        accountVerificationState: 'VERIFIED',
        lastActivityAt: NOW,
      },
    });
    expect(repository.tx.bilanRequestEvent.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        requestId: REQUEST_ID,
        type: 'ACCOUNT_VERIFIED',
        actor: 'PARENT_FLOW',
        payload: { methodCode: 'EXISTING_SESSION' },
        occurredAt: NOW,
      }),
    });
    expect(repository.tx.bilanRequestEvent.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        type: 'CHILD_SELECTED',
      }),
    });
    expect(repository.tx.bilanRequest.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          flowSessions: {
            some: {
              tokenHash: 'a'.repeat(64),
              revokedAt: null,
              expiresAt: { gt: NOW },
            },
          },
        }),
      }),
    );
  });

  it('does not create a second event when the same child is already attached', async () => {
    const repository = fakePrisma({
      request: { status: 'READY_FOR_ASSESSMENT', studentId: STUDENT_ID },
    });
    await expect(attachChildToVerifiedRequest({
      prisma: repository.client as never,
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      command: { action: 'SELECT_EXISTING', studentId: STUDENT_ID },
      now: NOW,
    })).resolves.toEqual({ attached: false, studentId: STUDENT_ID });
    expect(repository.tx.bilanRequest.updateMany).not.toHaveBeenCalled();
    expect(repository.tx.bilanRequestEvent.create).not.toHaveBeenCalled();
  });

  it('fails if the conditional attachment count is not exactly one', async () => {
    const repository = fakePrisma({ updateCounts: [0] });
    await expect(attachChildToVerifiedRequest({
      prisma: repository.client as never,
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      command: { action: 'SELECT_EXISTING', studentId: STUDENT_ID },
      now: NOW,
    })).rejects.toMatchObject({ code: 'BILAN_REQUEST_OWNERSHIP_CHANGED' });
  });

  it('retries the entire Serializable transaction on P2034', async () => {
    const repository = fakePrisma({
      transactionErrors: [Object.assign(new Error('conflict'), { code: 'P2034' })],
    });
    await expect(attachChildToVerifiedRequest({
      prisma: repository.client as never,
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      command: { action: 'SELECT_EXISTING', studentId: STUDENT_ID },
      now: NOW,
    })).resolves.toEqual({ attached: true, studentId: STUDENT_ID });
    expect(repository.client.$transaction).toHaveBeenCalledTimes(2);
    expect(repository.client.$transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });
});
