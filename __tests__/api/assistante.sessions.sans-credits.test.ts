/**
 * Régression ciblée : POST /api/assistante/sessions n'a JAMAIS consommé, et
 * ne consomme toujours pas, de crédit — `creditsUsed: 0` est écrit
 * explicitement par `lib/planning/series.ts` sur CHAQUE occurrence créée,
 * quel que soit ce qu'un appelant enverrait par ailleurs.
 *
 * Depuis la Tâche 11, le contrat de requête est celui des identités
 * canoniques (`studentProfileId`/`coachProfileId`/`assignmentId`/
 * `academicCourseKey`) — voir __tests__/api/assistante.planning-series.test.ts
 * pour la couverture complète du reste du contrat (conflits, dérogations,
 * codes d'erreur).
 */
import { POST } from '@/app/api/assistante/sessions/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(), isErrorResponse: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));

const studentProfileId = 'clh1234567890abcdefghij';
const coachProfileId = 'clh1234567890abcdefghik';
const assignmentId = 'clh1234567890abcdefghil';
const academicCourseKey = 'eds-maths-premiere';

const body = {
  studentProfileId,
  coachProfileId,
  assignmentId,
  academicCourseKey,
  scheduledDate: '2026-03-09', // lundi
  startTime: '10:00',
  endTime: '11:00',
  duration: 60,
  title: 'Mathématiques',
};
const request = { json: async () => body } as any;

describe('Assistant scheduling without credits', () => {
  let tx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE', id: 'staff' } });
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    tx = {
      student: {
        findUnique: jest.fn().mockResolvedValue({
          id: studentProfileId,
          userId: 'student-user',
          gradeLevel: 'PREMIERE',
          academicTrack: 'EDS_GENERALE',
          stmgPathway: null,
          parent: { userId: 'parent-user' },
        }),
      },
      coachProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: coachProfileId, userId: 'coach-user', subjects: ['MATHEMATIQUES'] }),
      },
      coachStudentAssignment: {
        findUnique: jest.fn().mockResolvedValue({
          id: assignmentId,
          studentId: studentProfileId,
          coachId: coachProfileId,
          status: 'ACTIVE',
          startsAt: new Date('2026-01-01T00:00:00Z'),
          endsAt: null,
          academicCourseKeys: [academicCourseKey],
        }),
      },
      studentAcademicEnrollment: {
        findMany: jest.fn().mockResolvedValue([{ courseKey: academicCourseKey, kind: 'SPECIALTY', source: 'ADMIN' }]),
      },
      coachAvailability: {
        findMany: jest.fn().mockResolvedValue([
          {
            dayOfWeek: 1,
            startTime: '08:00',
            endTime: '18:00',
            specificDate: null,
            isAvailable: true,
            isRecurring: true,
            validFrom: new Date('2026-01-01T00:00:00Z'),
            validUntil: null,
          },
        ]),
      },
      sessionBooking: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'booking', scheduledDate: new Date('2026-03-09'), startTime: '10:00', endTime: '11:00', occurrenceKey: 'series-1:0' }),
        findUnique: jest.fn(),
      },
      stageReservation: { findMany: jest.fn().mockResolvedValue([]) },
      stageSession: { findMany: jest.fn().mockResolvedValue([]) },
      planningSeries: { create: jest.fn().mockResolvedValue({ id: 'series-1' }) },
      planningOverrideAudit: { create: jest.fn() },
      creditTransaction: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(tx));
  });

  it('books an available session with no balance despite any legacy expectation of credit consumption', async () => {
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(tx.sessionBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ creditsUsed: 0, parentId: 'parent-user' }) }),
    );
    expect(tx.creditTransaction.findMany).not.toHaveBeenCalled();
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('still blocks scheduling conflicts', async () => {
    tx.sessionBooking.findMany.mockResolvedValueOnce([
      { scheduledDate: new Date('2026-03-09T00:00:00Z'), startTime: '10:00', endTime: '11:00' },
    ]);
    expect((await POST(request)).status).toBe(409);
    expect(tx.sessionBooking.create).not.toHaveBeenCalled();
  });

  it('still checks coach availability', async () => {
    tx.coachAvailability.findMany.mockResolvedValue([]);
    expect((await POST(request)).status).toBe(400);
    expect(tx.sessionBooking.create).not.toHaveBeenCalled();
  });
});
