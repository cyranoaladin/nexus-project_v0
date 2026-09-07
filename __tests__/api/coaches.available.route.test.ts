/**
 * GET /api/coaches/available — Tâche 12.
 *
 * `id` doit être `CoachProfile.id` (identité canonique), jamais `User.id`.
 * L'endpoint sert un annuaire de coachs : la disponibilité exposée est un
 * résumé SANITIZÉ du motif hebdomadaire récurrent (`{dayOfWeek, startTime,
 * endTime}`), jamais les lignes `CoachAvailability` brutes — aucun blackout
 * (`isAvailable: false`), aucune dérogation datée, aucun champ interne
 * (`isRecurring`, `validFrom`, `validUntil`, `specificDate`).
 */
import { auth } from '@/auth';
import { GET } from '@/app/api/coaches/available/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findMany: jest.fn() },
  },
}));

function makeRequest(url: string) {
  return { url } as any;
}

function coachRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'coach-profile-1',
    userId: 'coach-user-1',
    subjects: '["MATHEMATIQUES"]',
    description: 'Bio',
    philosophy: 'Phil',
    expertise: 'Exp',
    user: {
      firstName: 'Coach',
      lastName: 'One',
      coachAvailabilities: [],
    },
    ...overrides,
  };
}

describe('GET /api/coaches/available', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
  });

  it('returns 401 when not allowed', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns coach.id (CoachProfile.id), never the raw User.id', async () => {
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([coachRow()]);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available?subject=MATHEMATIQUES'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.coaches).toHaveLength(1);
    expect(body.coaches[0].id).toBe('coach-profile-1');
  });

  it('sanitizes a currently-valid recurring available window to {dayOfWeek, startTime, endTime}', async () => {
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([
      coachRow({
        user: {
          firstName: 'Coach',
          lastName: 'One',
          coachAvailabilities: [
            {
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '12:00',
              isAvailable: true,
              isRecurring: true,
              specificDate: null,
              validFrom: new Date('2020-01-01T00:00:00Z'),
              validUntil: null,
            },
          ],
        },
      }),
    ]);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available'));
    const body = await response.json();

    expect(body.coaches[0].availability).toEqual([{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }]);
  });

  it('never leaks a blackout row (isAvailable: false)', async () => {
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([
      coachRow({
        user: {
          firstName: 'Coach',
          lastName: 'One',
          coachAvailabilities: [
            {
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '12:00',
              isAvailable: false,
              isRecurring: true,
              specificDate: null,
              validFrom: new Date('2020-01-01T00:00:00Z'),
              validUntil: null,
            },
          ],
        },
      }),
    ]);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available'));
    const body = await response.json();

    expect(body.coaches[0].availability).toEqual([]);
  });

  it('never leaks a specific-date row (dated blackout or dated replacement)', async () => {
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([
      coachRow({
        user: {
          firstName: 'Coach',
          lastName: 'One',
          coachAvailabilities: [
            {
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '12:00',
              isAvailable: true,
              isRecurring: false,
              specificDate: new Date('2026-03-10T00:00:00Z'),
              validFrom: new Date('2020-01-01T00:00:00Z'),
              validUntil: null,
            },
          ],
        },
      }),
    ]);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available'));
    const body = await response.json();

    expect(body.coaches[0].availability).toEqual([]);
  });

  it('excludes a recurring window whose validity window has already lapsed', async () => {
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([
      coachRow({
        user: {
          firstName: 'Coach',
          lastName: 'One',
          coachAvailabilities: [
            {
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '12:00',
              isAvailable: true,
              isRecurring: true,
              specificDate: null,
              validFrom: new Date('2020-01-01T00:00:00Z'),
              validUntil: new Date('2020-06-01T00:00:00Z'),
            },
          ],
        },
      }),
    ]);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available'));
    const body = await response.json();

    expect(body.coaches[0].availability).toEqual([]);
  });

  it('does not include internal fields (isRecurring, validFrom, validUntil, specificDate, isAvailable) on any exposed window', async () => {
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([
      coachRow({
        user: {
          firstName: 'Coach',
          lastName: 'One',
          coachAvailabilities: [
            {
              dayOfWeek: 2,
              startTime: '10:00',
              endTime: '11:00',
              isAvailable: true,
              isRecurring: true,
              specificDate: null,
              validFrom: new Date('2020-01-01T00:00:00Z'),
              validUntil: null,
            },
          ],
        },
      }),
    ]);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available'));
    const body = await response.json();

    expect(Object.keys(body.coaches[0].availability[0]).sort()).toEqual(['dayOfWeek', 'endTime', 'startTime']);
  });

  it('returns coaches list filtered by subject', async () => {
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([coachRow()]);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available?subject=MATHEMATIQUES'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.coaches).toHaveLength(1);
  });
});
