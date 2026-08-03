import {
  getParentStudentConsentStatus,
  preparePendingParentStudentLink,
  verifyParentStudentConsent,
} from '@/lib/bilans/parent-student-consent';

type LinkState = 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED';

type Link = {
  id: string;
  parentUserId: string;
  studentId: string;
  state: LinkState;
  requestedAt: Date;
  consentedAt: Date | null;
  verifiedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function memoryDatabase(input?: {
  studentParentId?: string;
  links?: Link[];
}) {
  const students = new Map([
    ['student-1', { id: 'student-1', parentId: input?.studentParentId ?? 'parent-profile-1' }],
  ]);
  const parentProfiles = new Map([
    ['parent-user-1', { id: 'parent-profile-1', userId: 'parent-user-1' }],
    ['parent-user-2', { id: 'parent-profile-2', userId: 'parent-user-2' }],
  ]);
  const links = [...(input?.links ?? [])];
  let sequence = links.length;
  let transactionTail = Promise.resolve();

  const matches = (link: Link, where: Record<string, any>): boolean => {
    if (where.id !== undefined && link.id !== where.id) return false;
    if (where.studentId !== undefined && link.studentId !== where.studentId) return false;
    if (typeof where.parentUserId === 'string' && link.parentUserId !== where.parentUserId) return false;
    if (where.parentUserId?.not !== undefined && link.parentUserId === where.parentUserId.not) return false;
    if (typeof where.state === 'string' && link.state !== where.state) return false;
    if (where.state?.in !== undefined && !where.state.in.includes(link.state)) return false;
    if (where.expiresAt?.lte !== undefined && !(link.expiresAt !== null && link.expiresAt <= where.expiresAt.lte)) return false;
    if (where.expiresAt?.gt !== undefined && !(link.expiresAt !== null && link.expiresAt > where.expiresAt.gt)) return false;
    if (where.OR !== undefined && !where.OR.some((entry: Record<string, any>) => matches(link, entry))) return false;
    return true;
  };

  const transaction = {
    $queryRaw: jest.fn(async (query: { values?: unknown[] }) => {
      const studentId = String(query.values?.[0] ?? '');
      const student = students.get(studentId);
      return student === undefined ? [] : [student];
    }),
    parentProfile: {
      findUnique: jest.fn(async ({ where }: any) => parentProfiles.get(where.userId) ?? null),
    },
    parentStudentLink: {
      findFirst: jest.fn(async ({ where }: any) => links.find((link) => matches(link, where)) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const now = data.requestedAt as Date;
        const link: Link = {
          id: `link-${++sequence}`,
          parentUserId: data.parentUserId,
          studentId: data.studentId,
          state: data.state,
          requestedAt: now,
          consentedAt: data.consentedAt ?? null,
          verifiedAt: data.verifiedAt ?? null,
          revokedAt: data.revokedAt ?? null,
          expiresAt: data.expiresAt ?? null,
          revokedReason: data.revokedReason ?? null,
          createdAt: now,
          updatedAt: now,
        };
        links.push(link);
        return link;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const link of links) {
          if (!matches(link, where)) continue;
          Object.assign(link, data, { updatedAt: data.updatedAt ?? link.updatedAt });
          count += 1;
        }
        return { count };
      }),
    },
  };

  const runTransaction = async <T>(action: (tx: typeof transaction) => Promise<T>): Promise<T> => {
    let release!: () => void;
    const predecessor = transactionTail;
    transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await predecessor;
    try {
      return await action(transaction);
    } finally {
      release();
    }
  };

  return { links, students, transaction, runTransaction };
}

const at = (iso: string) => new Date(iso);

function historicalLink(overrides: Partial<Link> = {}): Link {
  const requestedAt = at('2026-08-01T08:00:00.000Z');
  return {
    id: 'historical-link',
    parentUserId: 'parent-user-1',
    studentId: 'student-1',
    state: 'REVOKED',
    requestedAt,
    consentedAt: null,
    verifiedAt: null,
    revokedAt: requestedAt,
    expiresAt: null,
    revokedReason: 'historical',
    createdAt: requestedAt,
    updatedAt: requestedAt,
    ...overrides,
  };
}

describe('preparePendingParentStudentLink', () => {
  const now = at('2026-08-03T09:00:00.000Z');

  it('locks the student, checks legacy ownership and creates only a pending link', async () => {
    const database = memoryDatabase();

    const result = await database.runTransaction((transaction) => preparePendingParentStudentLink({
      transaction: transaction as never,
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now,
    }));

    expect(result.state).toBe('PENDING_PARENT_CONSENT');
    expect(result.verifiedAt).toBeNull();
    expect(database.links).toHaveLength(1);
    expect(database.links[0]).toMatchObject({
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      state: 'PENDING_PARENT_CONSENT',
      requestedAt: now,
      consentedAt: null,
      verifiedAt: null,
    });
    const sql = database.transaction.$queryRaw.mock.calls[0]?.[0] as { strings?: readonly string[] };
    expect(sql.strings?.join('?')).toContain('FOR UPDATE');
    expect(database.transaction.parentProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'parent-user-1' },
    }));
  });

  it('fails closed for a student not owned by the parent', async () => {
    const database = memoryDatabase();

    await expect(database.runTransaction((transaction) => preparePendingParentStudentLink({
      transaction: transaction as never,
      parentUserId: 'parent-user-2',
      studentId: 'student-1',
      now,
    }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(database.links).toEqual([]);
  });

  it.each<LinkState>(['PENDING_PARENT_CONSENT', 'VERIFIED'])(
    'is idempotent when a current %s link already exists',
    async (state) => {
      const existing = historicalLink({
        id: 'active-link',
        state,
        revokedAt: null,
        revokedReason: null,
        verifiedAt: state === 'VERIFIED' ? now : null,
        consentedAt: state === 'VERIFIED' ? now : null,
      });
      const database = memoryDatabase({ links: [existing] });

      const result = await database.runTransaction((transaction) => preparePendingParentStudentLink({
        transaction: transaction as never,
        parentUserId: 'parent-user-1',
        studentId: 'student-1',
        now,
      }));

      expect(result.id).toBe('active-link');
      expect(database.links).toHaveLength(1);
      expect(database.transaction.parentStudentLink.create).not.toHaveBeenCalled();
    },
  );

  it.each<LinkState>(['REVOKED', 'EXPIRED'])(
    'creates a new pending link after a %s history',
    async (state) => {
      const database = memoryDatabase({ links: [historicalLink({ state })] });

      await database.runTransaction((transaction) => preparePendingParentStudentLink({
        transaction: transaction as never,
        parentUserId: 'parent-user-1',
        studentId: 'student-1',
        now,
      }));

      expect(database.links.map(({ state: linkState }) => linkState)).toEqual([state, 'PENDING_PARENT_CONSENT']);
    },
  );

  it('revokes active links belonging to a former parent', async () => {
    const former = historicalLink({
      parentUserId: 'parent-user-2',
      state: 'VERIFIED',
      revokedAt: null,
      revokedReason: null,
      consentedAt: at('2026-08-02T08:00:00.000Z'),
      verifiedAt: at('2026-08-02T08:00:00.000Z'),
    });
    const database = memoryDatabase({ links: [former] });

    await database.runTransaction((transaction) => preparePendingParentStudentLink({
      transaction: transaction as never,
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now,
    }));

    expect(former).toMatchObject({ state: 'REVOKED', revokedAt: now, revokedReason: 'LEGACY_PARENT_CHANGED' });
    expect(database.links[1]?.state).toBe('PENDING_PARENT_CONSENT');
  });

  it('converges under two concurrent preparations without creating a verified link', async () => {
    const database = memoryDatabase();
    const prepare = () => database.runTransaction((transaction) => preparePendingParentStudentLink({
      transaction: transaction as never,
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now,
    }));

    const [first, second] = await Promise.all([prepare(), prepare()]);

    expect(first.id).toBe(second.id);
    expect(database.links.filter(({ state }) => state === 'PENDING_PARENT_CONSENT')).toHaveLength(1);
    expect(database.links.filter(({ state }) => state === 'VERIFIED')).toHaveLength(0);
  });
});

describe('verifyParentStudentConsent', () => {
  const now = at('2026-08-03T10:00:00.000Z');

  it('moves only the current pending link to verified and records consent timestamps', async () => {
    const pending = historicalLink({ state: 'PENDING_PARENT_CONSENT', revokedAt: null, revokedReason: null });
    const database = memoryDatabase({ links: [pending] });

    const result = await database.runTransaction((transaction) => verifyParentStudentConsent({
      transaction: transaction as never,
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now,
    }));

    expect(result).toMatchObject({ id: pending.id, state: 'VERIFIED', consentedAt: now, verifiedAt: now });
    expect(database.links).toHaveLength(1);
  });

  it('is idempotent when the same parent repeats an already verified consent', async () => {
    const verifiedAt = at('2026-08-02T10:00:00.000Z');
    const verified = historicalLink({
      state: 'VERIFIED',
      revokedAt: null,
      revokedReason: null,
      consentedAt: verifiedAt,
      verifiedAt,
    });
    const database = memoryDatabase({ links: [verified] });

    const result = await database.runTransaction((transaction) => verifyParentStudentConsent({
      transaction: transaction as never,
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now,
    }));

    expect(result.verifiedAt).toEqual(verifiedAt);
    expect(database.transaction.parentStudentLink.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: 'VERIFIED' }),
    }));
  });

  it('rejects a stale parent after the legacy relation was reassigned', async () => {
    const database = memoryDatabase({ studentParentId: 'parent-profile-2', links: [historicalLink({ state: 'PENDING_PARENT_CONSENT', revokedAt: null })] });

    await expect(database.runTransaction((transaction) => verifyParentStudentConsent({
      transaction: transaction as never,
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now,
    }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(database.links[0]?.state).toBe('PENDING_PARENT_CONSENT');
  });

  it('does not overwrite a revoke that wins before the compare-and-set update', async () => {
    const pending = historicalLink({ state: 'PENDING_PARENT_CONSENT', revokedAt: null, revokedReason: null });
    const database = memoryDatabase({ links: [pending] });
    const originalUpdateMany = database.transaction.parentStudentLink.updateMany;
    originalUpdateMany.mockImplementation(async ({ where, data }: any) => {
      if (where.id === pending.id && data.state === 'VERIFIED') {
        pending.state = 'REVOKED';
        pending.revokedAt = now;
        pending.revokedReason = 'CONCURRENT_REVOKE';
        return { count: 0 };
      }
      return { count: 0 };
    });

    await expect(database.runTransaction((transaction) => verifyParentStudentConsent({
      transaction: transaction as never,
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now,
    }))).rejects.toMatchObject({ code: 'CONSENT_NOT_PENDING' });
    expect(pending).toMatchObject({ state: 'REVOKED', verifiedAt: null, consentedAt: null });
  });

  it('reports current status only after rechecking legacy ownership', async () => {
    const pending = historicalLink({ state: 'PENDING_PARENT_CONSENT', revokedAt: null, revokedReason: null });
    const database = memoryDatabase({ links: [pending] });

    await expect(database.runTransaction((transaction) => getParentStudentConsentStatus({
      transaction: transaction as never,
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now,
    }))).resolves.toEqual({ state: 'PENDING_PARENT_CONSENT' });

    database.students.set('student-1', { id: 'student-1', parentId: 'parent-profile-2' });
    await expect(database.runTransaction((transaction) => getParentStudentConsentStatus({
      transaction: transaction as never,
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now,
    }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
