import {
  searchPlanningStudents,
  type PlanningStudentSearchDatabase,
} from '@/lib/planning/staff-student-search.server';

describe('stage planning student search service', () => {
  test('uses a minimal projection and returns only fields required by planning', async () => {
    const database = {
      student: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'student-profile-secret',
          creditBalance: 42,
          user: {
            id: 'student-user-1', firstName: ' Yasmine ', lastName: ' Ben Salah ', email: ' YASMINE@EXAMPLE.TEST ', activatedAt: new Date(),
          },
          coachAssignments: [{ id: 'coach-secret' }],
        }, {
          user: { id: 'student-user-2', firstName: 'Email', lastName: 'Invalide', email: 'not-an-email' },
        }, {
          user: { id: 'student-user-3', firstName: 'Email', lastName: 'Vide', email: '   ' },
        }]),
      },
    } as unknown as PlanningStudentSearchDatabase;

    const result = await searchPlanningStudents({ query: '  Yasmine  ', page: 1, limit: 10 }, database);

    expect(database.student.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { user: { firstName: { contains: 'Yasmine', mode: 'insensitive' } } },
          { user: { lastName: { contains: 'Yasmine', mode: 'insensitive' } } },
          { user: { email: { contains: 'Yasmine', mode: 'insensitive' } } },
        ],
      },
      select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 10,
    });
    expect(result).toEqual({ items: [
      { userId: 'student-user-1', displayName: 'Yasmine Ben Salah', email: 'yasmine@example.test' },
      { userId: 'student-user-2', displayName: 'Email Invalide', email: null },
      { userId: 'student-user-3', displayName: 'Email Vide', email: null },
    ] });
    expect(JSON.stringify(result)).not.toMatch(/profile-secret|creditBalance|coach-secret|activatedAt/);
  });
});
