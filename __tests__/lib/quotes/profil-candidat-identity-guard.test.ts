import { prisma } from '@/lib/prisma';
import { createProfilCandidat, updateProfilCandidat } from '@/lib/quotes/profil-candidat.server';

const VALID_DRAFT = {
  contactLeadId: 'lead-1',
  studentId: 'student-1',
  publicInput: {
    level: 'TERMINALE', examSession: 2027, modalite: 'A',
    specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
  },
};

function matchingIdentity(parentEmail = 'parent@example.test') {
  (prisma.contactLead.findUnique as jest.Mock).mockResolvedValue({ id: 'lead-1', email: ' PARENT@example.test ' });
  (prisma.student.findUnique as jest.Mock).mockResolvedValue({
    id: 'student-1',
    user: { id: 'student-user-1', mergedIntoUserId: null },
    parent: { user: { id: 'parent-user-1', email: parentEmail, mergedIntoUserId: null } },
  });
}

describe('ProfilCandidat canonical identity guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.contactLead.findUnique as jest.Mock).mockReset().mockResolvedValue(null);
    (prisma.student.findUnique as jest.Mock).mockReset().mockResolvedValue(null);
    (prisma.profilCandidat.create as jest.Mock).mockReset().mockResolvedValue({ id: 'profil-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (operation) => operation(prisma));
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'profil-1', updatedAt: new Date() }]);
  });

  it('creates only after resolving a matching ContactLead + Student parent inside the transaction', async () => {
    matchingIdentity();
    (prisma.profilCandidat.create as jest.Mock).mockResolvedValue({ id: 'profil-1' });

    await expect(createProfilCandidat(VALID_DRAFT, 'staff-1')).resolves.toMatchObject({ ok: true });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.profilCandidat.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contactLeadId: 'lead-1', studentId: 'student-1' }),
    }));
  });

  it('locks Student, ContactLead, ParentProfile and users in deterministic order before comparing them', async () => {
    matchingIdentity();

    await createProfilCandidat(VALID_DRAFT, 'staff-1');

    const lockSql = (prisma.$queryRaw as jest.Mock).mock.calls.slice(0, 4).map(
      ([sql]) => (sql as { strings?: readonly string[] }).strings?.join('?') ?? '',
    );
    expect(lockSql[0]).toContain('FROM "students"');
    expect(lockSql[1]).toContain('FROM "contact_leads"');
    expect(lockSql[2]).toContain('FROM "parent_profiles"');
    expect(lockSql[3]).toContain('FROM "users"');
    expect(lockSql).toEqual(lockSql.map((sql) => expect.stringContaining('FOR UPDATE')));
    expect(lockSql[3]).toContain('ORDER BY u."id"');
    const lastLockOrder = (prisma.$queryRaw as jest.Mock).mock.invocationCallOrder[3];
    expect(lastLockOrder).toBeLessThan((prisma.contactLead.findUnique as jest.Mock).mock.invocationCallOrder[0]);
    expect(lastLockOrder).toBeLessThan((prisma.student.findUnique as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('reconciles an existing lead and student without a ContactLead FK by normalized parent email', async () => {
    matchingIdentity(' PARENT@EXAMPLE.TEST ');

    await expect(createProfilCandidat(VALID_DRAFT, 'staff-1')).resolves.toMatchObject({ ok: true });

    expect(prisma.contactLead.create).not.toHaveBeenCalled();
    expect(prisma.contactLead.update).not.toHaveBeenCalled();
    expect(prisma.profilCandidat.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contactLeadId: 'lead-1', studentId: 'student-1' }),
    }));
  });

  it('serializes overlapping identity validations before the second transaction can read', async () => {
    matchingIdentity();
    let releaseFirstCreate!: (value: { id: string }) => void;
    const firstCreate = new Promise<{ id: string }>((resolve) => { releaseFirstCreate = resolve; });
    (prisma.profilCandidat.create as jest.Mock)
      .mockImplementationOnce(() => firstCreate)
      .mockResolvedValue({ id: 'profil-2' });

    let releaseIdentityLocks!: () => void;
    const identityLocksReleased = new Promise<void>((resolve) => { releaseIdentityLocks = resolve; });
    let transactionNumber = 0;
    (prisma.$transaction as jest.Mock).mockImplementation(async (operation) => {
      const currentTransaction = ++transactionNumber;
      const transaction = {
        contactLead: prisma.contactLead,
        student: prisma.student,
        profilCandidat: prisma.profilCandidat,
        quote: prisma.quote,
        $queryRaw: jest.fn(async (sql: { strings?: readonly string[] }) => {
          const statement = sql.strings?.join('?') ?? '';
          if (currentTransaction === 2 && statement.includes('FROM "students"')) await identityLocksReleased;
          return [];
        }),
      };
      try {
        return await operation(transaction);
      } finally {
        if (currentTransaction === 1) releaseIdentityLocks();
      }
    });

    const first = createProfilCandidat(VALID_DRAFT, 'staff-1');
    await new Promise((resolve) => setImmediate(resolve));
    expect(prisma.contactLead.findUnique).toHaveBeenCalledTimes(1);
    const second = createProfilCandidat(VALID_DRAFT, 'staff-2');
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.contactLead.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.student.findUnique).toHaveBeenCalledTimes(1);

    releaseFirstCreate({ id: 'profil-1' });
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ ok: true, profil: { id: 'profil-1' } }),
      expect.objectContaining({ ok: true, profil: { id: 'profil-2' } }),
    ]);
    expect(prisma.contactLead.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.student.findUnique).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['MISSING_IDENTITY', { ...VALID_DRAFT, studentId: null }],
    ['CONTACT_LEAD_NOT_FOUND', VALID_DRAFT],
    ['STUDENT_NOT_FOUND', VALID_DRAFT],
    ['RESPONSIBLE_UNAVAILABLE', VALID_DRAFT],
    ['IDENTITY_MISMATCH', VALID_DRAFT],
  ])('fails closed with stable code %s before any mutation', async (code, draft) => {
    if (code !== 'CONTACT_LEAD_NOT_FOUND') {
      (prisma.contactLead.findUnique as jest.Mock).mockResolvedValue({ id: 'lead-1', email: 'parent@example.test' });
    }
    if (['RESPONSIBLE_UNAVAILABLE', 'IDENTITY_MISMATCH'].includes(code)) {
      matchingIdentity(code === 'IDENTITY_MISMATCH' ? 'other@example.test' : 'parent@example.test');
    }
    if (code === 'RESPONSIBLE_UNAVAILABLE') {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        id: 'student-1', user: { id: 'student-user-1', mergedIntoUserId: null },
        parent: { user: { id: 'parent-user-1', email: null, mergedIntoUserId: null } },
      });
    }

    await expect(createProfilCandidat(draft as typeof VALID_DRAFT, 'staff-1')).resolves.toEqual({ ok: false, identityError: code });
    expect(prisma.profilCandidat.create).not.toHaveBeenCalled();
    expect(prisma.profilCandidat.update).not.toHaveBeenCalled();
  });

  it('revalidates a changed responsible/student pair before PATCH mutation', async () => {
    matchingIdentity('other@example.test');
    (prisma.profilCandidat.findUnique as jest.Mock).mockResolvedValue({ id: 'profil-1' });
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(updateProfilCandidat('profil-1', VALID_DRAFT)).resolves.toEqual({ ok: false, identityError: 'IDENTITY_MISMATCH' });
    expect(prisma.profilCandidat.update).not.toHaveBeenCalled();
  });
});
