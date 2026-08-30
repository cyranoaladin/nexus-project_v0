import {
  searchCandidatIndividuelLeads,
  searchCandidatIndividuelStudents,
  type CandidatIndividuelStaffSearchDatabase,
} from '@/lib/quotes/candidat-individuel-staff-search.server';

const studentSelect = {
  id: true,
  gradeLevel: true,
  school: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      mergedIntoUserId: true,
    },
  },
  parent: {
    select: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          mergedIntoUserId: true,
        },
      },
    },
  },
};

const leadSelect = { id: true, name: true, email: true };

function studentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'student-profile-001',
    gradeLevel: 'TERMINALE',
    school: '  Lycee test  ',
    user: {
      firstName: '  Yasmine ',
      lastName: ' Ben Salah  ',
      email: ' YASMINE@EXAMPLE.TEST ',
      mergedIntoUserId: null,
      activatedAt: new Date('2026-08-30T00:00:00.000Z'),
      id: 'student-user-secret',
    },
    parent: {
      id: 'parent-profile-secret',
      user: {
        id: 'parent-user-secret',
        firstName: 'Sonia',
        lastName: 'Ben Salah',
        email: 'parent.private@example.test',
        mergedIntoUserId: null,
        activatedAt: new Date('2026-08-30T00:00:00.000Z'),
      },
    },
    credits: 99,
    creditBalance: 99,
    coachAssignments: [{ id: 'coach-secret' }],
    subscriptions: [{ id: 'subscription-secret' }],
    _count: { sessions: 42 },
    ...overrides,
  };
}

function createDatabase() {
  return {
    student: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    contactLead: {
      findMany: jest.fn(),
    },
  } as unknown as CandidatIndividuelStaffSearchDatabase;
}

describe('candidat individuel staff search SSOT', () => {
  test('uses a minimal Student select and maps every domain variant to controlled public reasons', async () => {
    const database = createDatabase();
    const rows = [
      studentRow(),
      studentRow({
        id: 'student-profile-002',
        user: { firstName: 'Fusionne', lastName: 'Eleve', email: null, mergedIntoUserId: 'student-canonical-001' },
      }),
      studentRow({ id: 'student-profile-003', parent: null }),
      studentRow({
        id: 'student-profile-004',
        parent: { user: { firstName: 'Parent', lastName: 'Fusionne', email: 'parent4@example.test', mergedIntoUserId: 'parent-canonical-001' } },
      }),
      studentRow({
        id: 'student-profile-005',
        parent: { user: { firstName: 'Parent', lastName: 'Sans email', email: '   ', mergedIntoUserId: null } },
      }),
      studentRow({
        id: 'student-profile-006',
        parent: { user: { firstName: null, lastName: '   ', email: 'parent6@example.test', mergedIntoUserId: null } },
      }),
    ];
    (database.student.findMany as jest.Mock).mockResolvedValue(rows);
    (database.student.count as jest.Mock).mockResolvedValue(rows.length);

    const result = await searchCandidatIndividuelStudents(
      { query: '   ', page: 1, limit: 10 },
      database,
    );

    expect(database.student.findMany).toHaveBeenCalledWith({
      where: {},
      select: studentSelect,
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
    expect(database.student.count).toHaveBeenCalledWith({ where: {} });
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 6, totalPages: 1 });
    expect(result.items).toEqual([
      {
        studentId: 'student-profile-001',
        displayName: 'Yasmine Ben Salah',
        email: 'yasmine@example.test',
        grade: 'TERMINALE',
        school: 'Lycee test',
        selectable: true,
        unavailableReason: null,
      },
      expect.objectContaining({ studentId: 'student-profile-002', selectable: false, unavailableReason: 'Compte élève fusionné' }),
      expect.objectContaining({ studentId: 'student-profile-003', selectable: false, unavailableReason: 'Responsable absent' }),
      expect.objectContaining({ studentId: 'student-profile-004', selectable: false, unavailableReason: 'Compte responsable fusionné' }),
      expect.objectContaining({ studentId: 'student-profile-005', selectable: false, unavailableReason: 'Adresse email du responsable manquante' }),
      expect.objectContaining({ studentId: 'student-profile-006', selectable: false, unavailableReason: 'Nom du responsable manquant' }),
    ]);
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual([
        'displayName', 'email', 'grade', 'school', 'selectable', 'studentId', 'unavailableReason',
      ]);
    }
    expect(JSON.stringify(result)).not.toMatch(
      /coach-secret|subscription-secret|creditBalance|credits|_count|activatedAt|parent\.private|parent-user-secret|student-user-secret/,
    );
  });

  test('trims the query and applies identical filtering to paginated rows and count', async () => {
    const database = createDatabase();
    (database.student.findMany as jest.Mock).mockResolvedValue([]);
    (database.student.count as jest.Mock).mockResolvedValue(5);
    const where = {
      OR: [
        { user: { firstName: { contains: 'Yasmine', mode: 'insensitive' } } },
        { user: { lastName: { contains: 'Yasmine', mode: 'insensitive' } } },
        { user: { email: { contains: 'Yasmine', mode: 'insensitive' } } },
      ],
    };

    await expect(searchCandidatIndividuelStudents(
      { query: '  Yasmine  ', page: 2, limit: 2 },
      database,
    )).resolves.toEqual({
      items: [],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
    expect(database.student.findMany).toHaveBeenCalledWith({
      where,
      select: studentSelect,
      orderBy: { createdAt: 'desc' },
      skip: 2,
      take: 2,
    });
    expect(database.student.count).toHaveBeenCalledWith({ where });
  });

  test('reuses canonical ContactLead filtering with a minimal select and preserves colliding names by id', async () => {
    const database = createDatabase();
    (database.contactLead.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'contact-lead-001', name: '  Sonia Ben Salah ', email: ' SONIA.ONE@EXAMPLE.TEST ',
        phone: '+21600000001', status: 'QUALIFIED', notes: 'private one',
      },
      {
        id: 'contact-lead-002', name: 'Sonia Ben Salah', email: 'sonia.two@example.test',
        phone: '+21600000002', status: 'NEW', notes: 'private two',
      },
    ]);

    const result = await searchCandidatIndividuelLeads(
      { query: '  Sonia  ', limit: 2 },
      database,
    );

    expect(database.contactLead.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: 'Sonia', mode: 'insensitive' } },
          { email: { contains: 'Sonia', mode: 'insensitive' } },
          { phone: { contains: 'Sonia', mode: 'insensitive' } },
        ],
      },
      select: leadSelect,
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    expect(result).toEqual({
      items: [
        { contactLeadId: 'contact-lead-001', displayName: 'Sonia Ben Salah', email: 'sonia.one@example.test' },
        { contactLeadId: 'contact-lead-002', displayName: 'Sonia Ben Salah', email: 'sonia.two@example.test' },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/phone|status|notes|private one|private two/);
  });

  test('fails closed when a database row cannot satisfy the Task 3 response schema', async () => {
    const database = createDatabase();
    (database.student.findMany as jest.Mock).mockResolvedValue([
      studentRow({ id: 'bad' }),
    ]);
    (database.student.count as jest.Mock).mockResolvedValue(1);

    await expect(searchCandidatIndividuelStudents(
      { query: '', page: 1, limit: 20 },
      database,
    )).rejects.toThrow();
  });
});
