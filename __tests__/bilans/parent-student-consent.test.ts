import * as consentService from '@/lib/bilans/parent-student-consent';

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

function memoryDatabase(input?: { studentParentId?: string; links?: Link[] }) {
  const students = new Map([
    ['student-1', { id: 'student-1', parentId: input?.studentParentId ?? 'parent-profile-1' }],
  ]);
  const parentProfiles = new Map([
    ['parent-user-1', { id: 'parent-profile-1', userId: 'parent-user-1' }],
    ['parent-user-2', { id: 'parent-profile-2', userId: 'parent-user-2' }],
  ]);
  const links = [...(input?.links ?? [])];
  let sequence = links.length;

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
    $queryRaw: jest.fn(async (query: { strings?: readonly string[]; values?: unknown[] }) => {
      const sql = query.strings?.join('?') ?? '';
      if (sql.includes('canonical_parent_student_links')) {
        const link = links.find((entry) => (
          entry.id === query.values?.[0]
          && entry.parentUserId === query.values?.[1]
          && entry.studentId === query.values?.[2]
        ));
        return link === undefined ? [] : [link];
      }
      const student = students.get(String(query.values?.[0] ?? ''));
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
          Object.assign(link, data);
          count += 1;
        }
        return { count };
      }),
    },
  };
  const database = {
    $transaction: jest.fn(async (action: (tx: typeof transaction) => Promise<unknown>) => action(transaction)),
  };
  return { database, links, students, transaction };
}

function inConsentTransaction<T>(
  database: ReturnType<typeof memoryDatabase>,
  action: (context: any) => Promise<T>,
): Promise<T> {
  return consentService.withParentStudentConsentTransaction(database.database as never, action);
}

describe('parent-student consent transaction boundary', () => {
  it('exposes operations only from a wrapper-owned interactive transaction context', async () => {
    const database = memoryDatabase();

    await inConsentTransaction(database, async (context) => {
      expect(context.transaction).toBe(database.transaction);
      expect(typeof context.preparePending).toBe('function');
      expect(typeof context.verify).toBe('function');
      expect(typeof context.getStatus).toBe('function');
    });

    expect(database.database.$transaction).toHaveBeenCalledTimes(1);
    expect(consentService).not.toHaveProperty('preparePendingParentStudentLink');
    expect(consentService).not.toHaveProperty('verifyParentStudentConsent');
  });
});

describe('preparePending', () => {
  const now = at('2026-08-03T09:00:00.000Z');

  it('locks the student, checks legacy ownership and creates only a pending link', async () => {
    const database = memoryDatabase();
    const result = await inConsentTransaction(database, (context) => context.preparePending({
      parentUserId: 'parent-user-1', studentId: 'student-1', now,
    }));

    expect(result.state).toBe('PENDING_PARENT_CONSENT');
    expect(result.verifiedAt).toBeNull();
    expect(database.links).toHaveLength(1);
    const sql = database.transaction.$queryRaw.mock.calls[0]?.[0] as { strings?: readonly string[] };
    expect(sql.strings?.join('?')).toContain('FOR UPDATE');
    expect(database.transaction.parentProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'parent-user-1' },
    }));
  });

  it('fails closed for a student not owned by the parent', async () => {
    const database = memoryDatabase();
    await expect(inConsentTransaction(database, (context) => context.preparePending({
      parentUserId: 'parent-user-2', studentId: 'student-1', now,
    }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(database.links).toEqual([]);
  });

  it.each<LinkState>(['PENDING_PARENT_CONSENT', 'VERIFIED'])(
    'is idempotent for an existing %s link',
    async (state) => {
      const existing = historicalLink({
        id: 'active-link', state, revokedAt: null, revokedReason: null,
        consentedAt: state === 'VERIFIED' ? now : null,
        verifiedAt: state === 'VERIFIED' ? now : null,
      });
      const database = memoryDatabase({ links: [existing] });
      const result = await inConsentTransaction(database, (context) => context.preparePending({
        parentUserId: 'parent-user-1', studentId: 'student-1', now,
      }));
      expect(result.id).toBe(existing.id);
      expect(database.links).toHaveLength(1);
    },
  );

  it('revokes an active link for a former legacy parent', async () => {
    const former = historicalLink({
      parentUserId: 'parent-user-2', state: 'VERIFIED', revokedAt: null, revokedReason: null,
      consentedAt: now, verifiedAt: now,
    });
    const database = memoryDatabase({ links: [former] });
    await inConsentTransaction(database, (context) => context.preparePending({
      parentUserId: 'parent-user-1', studentId: 'student-1', now,
    }));
    expect(former).toMatchObject({ state: 'REVOKED', revokedAt: now, revokedReason: 'LEGACY_PARENT_CHANGED' });
    expect(database.links[1]?.state).toBe('PENDING_PARENT_CONSENT');
  });
});

describe('verify', () => {
  const now = at('2026-08-03T10:00:00.000Z');

  it('moves a pending link to verified with explicit consent timestamps', async () => {
    const pending = historicalLink({ state: 'PENDING_PARENT_CONSENT', revokedAt: null, revokedReason: null });
    const database = memoryDatabase({ links: [pending] });
    const result = await inConsentTransaction(database, (context) => context.verify({
      parentUserId: 'parent-user-1', studentId: 'student-1', now,
    }));
    expect(result).toMatchObject({ id: pending.id, state: 'VERIFIED', consentedAt: now, verifiedAt: now });
  });

  it.each<LinkState>(['REVOKED', 'EXPIRED'])(
    'prepares a fresh pending link after %s history and verifies it in the same call',
    async (state) => {
      const database = memoryDatabase({ links: [historicalLink({ state })] });
      const result = await inConsentTransaction(database, (context) => context.verify({
        parentUserId: 'parent-user-1', studentId: 'student-1', now,
      }));
      expect(result).toMatchObject({ state: 'VERIFIED', consentedAt: now, verifiedAt: now });
      expect(database.links).toHaveLength(2);
      expect(database.links.map(({ state: value }) => value)).toEqual([state, 'VERIFIED']);
    },
  );

  it('refuses when the pending row disappears before the compare-and-set reread', async () => {
    const pending = historicalLink({ state: 'PENDING_PARENT_CONSENT', revokedAt: null, revokedReason: null });
    const database = memoryDatabase({ links: [pending] });
    database.transaction.parentStudentLink.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (where.id === pending.id && data.state === 'VERIFIED') {
        database.links.splice(0, 1);
        return { count: 0 };
      }
      return { count: 0 };
    });
    await expect(inConsentTransaction(database, (context) => context.verify({
      parentUserId: 'parent-user-1', studentId: 'student-1', now,
    }))).rejects.toMatchObject({ code: 'CONSENT_NOT_PENDING' });
  });

  it('returns the verified row when a competing CAS already completed it', async () => {
    const pending = historicalLink({ state: 'PENDING_PARENT_CONSENT', revokedAt: null, revokedReason: null });
    const database = memoryDatabase({ links: [pending] });
    database.transaction.parentStudentLink.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (where.id === pending.id && data.state === 'VERIFIED') {
        pending.state = 'VERIFIED';
        pending.consentedAt = now;
        pending.verifiedAt = now;
        return { count: 0 };
      }
      return { count: 0 };
    });

    await expect(inConsentTransaction(database, (context) => context.verify({
      parentUserId: 'parent-user-1', studentId: 'student-1', now,
    }))).resolves.toMatchObject({ id: pending.id, state: 'VERIFIED' });
  });

  it.each<LinkState>(['REVOKED', 'EXPIRED'])(
    'refuses when %s wins before the compare-and-set reread',
    async (winningState) => {
      const pending = historicalLink({ state: 'PENDING_PARENT_CONSENT', revokedAt: null, revokedReason: null });
      const database = memoryDatabase({ links: [pending] });
      database.transaction.parentStudentLink.updateMany.mockImplementation(async ({ where, data }: any) => {
        if (where.id === pending.id && data.state === 'VERIFIED') {
          pending.state = winningState;
          return { count: 0 };
        }
        return { count: 0 };
      });
      await expect(inConsentTransaction(database, (context) => context.verify({
        parentUserId: 'parent-user-1', studentId: 'student-1', now,
      }))).rejects.toMatchObject({ code: 'CONSENT_NOT_PENDING' });
      expect(pending.verifiedAt).toBeNull();
    },
  );

  it('is idempotent for a repeated explicit consent and rejects stale legacy ownership', async () => {
    const verifiedAt = at('2026-08-02T10:00:00.000Z');
    const verified = historicalLink({
      state: 'VERIFIED', revokedAt: null, revokedReason: null,
      consentedAt: verifiedAt, verifiedAt,
    });
    const database = memoryDatabase({ links: [verified] });
    await expect(inConsentTransaction(database, (context) => context.verify({
      parentUserId: 'parent-user-1', studentId: 'student-1', now,
    }))).resolves.toMatchObject({ id: verified.id, verifiedAt });

    database.students.set('student-1', { id: 'student-1', parentId: 'parent-profile-2' });
    await expect(inConsentTransaction(database, (context) => context.verify({
      parentUserId: 'parent-user-1', studentId: 'student-1', now,
    }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reports status only after rechecking legacy ownership', async () => {
    const pending = historicalLink({ state: 'PENDING_PARENT_CONSENT', revokedAt: null, revokedReason: null });
    const database = memoryDatabase({ links: [pending] });
    await expect(inConsentTransaction(database, (context) => context.getStatus({
      parentUserId: 'parent-user-1', studentId: 'student-1', now,
    }))).resolves.toEqual({ state: 'PENDING_PARENT_CONSENT' });
  });
});
