import { auth } from '@/auth';
import { GET } from '@/app/api/coach/dashboard/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findUnique: jest.fn() },
    sessionBooking: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    student: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    coachStudentAssignment: { findMany: jest.fn() },
    mathsProgress: { findMany: jest.fn().mockResolvedValue([]) },
    bilan: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

function makeRequest() {
  return {} as any;
}

/** Ordre des 4 appels séquentiels à `sessionBooking.findMany` dans la route. */
function mockSessionBookingSequence({
  todaysSessions = [],
  weekSessionsRaw = [],
  uniqueStudentBookings = [],
  recentBookings = [],
}: {
  todaysSessions?: unknown[];
  weekSessionsRaw?: unknown[];
  uniqueStudentBookings?: unknown[];
  recentBookings?: unknown[];
} = {}) {
  (prisma.sessionBooking.findMany as jest.Mock)
    .mockResolvedValueOnce(todaysSessions)
    .mockResolvedValueOnce(weekSessionsRaw)
    .mockResolvedValueOnce(uniqueStudentBookings)
    .mockResolvedValueOnce(recentBookings);
}

describe('GET /api/coach/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not coach', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when coach profile missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Coach profile not found');
  });

  it('returns dashboard data for coach', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'coach-profile-1',
      pseudonym: 'CoachX',
      tag: 'Math',
      subjects: '["MATHEMATIQUES"]',
      user: { firstName: 'Coach', lastName: 'One', email: 'c@test.com' },
    });
    mockSessionBookingSequence({
      todaysSessions: [
        {
          id: 's1',
          student: { firstName: 'Student', lastName: 'One' },
          subject: 'MATHEMATIQUES',
          startTime: '10:00',
          endTime: '11:00',
          type: 'INDIVIDUAL',
          status: 'SCHEDULED',
          scheduledDate: new Date(),
          duration: 60,
        },
      ],
      weekSessionsRaw: [
        {
          id: 's2',
          studentId: 'student-1',
          student: { firstName: 'Student', lastName: 'One' },
          subject: 'MATHEMATIQUES',
          scheduledDate: new Date(),
          startTime: '10:00',
          endTime: '11:00',
          duration: 60,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          status: 'COMPLETED',
          creditsUsed: 2,
          title: 'Math',
          description: '',
        },
      ],
      uniqueStudentBookings: [{ studentId: 'student-1' }],
      recentBookings: [
        { studentProfileId: 'student-entity-1', scheduledDate: new Date() },
      ],
    });
    (prisma.mathsProgress.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bilan.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([
      {
        coachId: 'coach-profile-1',
        studentId: 'student-entity-1',
        subjects: ['MATHEMATIQUES'],
        academicCourseKeys: ['tc-maths-seconde'],
        createdAt: new Date(),
        student: {
          id: 'student-entity-1',
          userId: 'student-1',
          grade: 'Seconde',
          gradeLevel: 'SECONDE',
          academicTrack: null,
          user: { firstName: 'Student', lastName: 'One' },
        },
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.coach.pseudonym).toBe('CoachX');
    expect(body.weekStats.totalSessions).toBe(1);
    expect(body.uniqueStudentsCount).toBe(1);
    expect(body.students).toHaveLength(1);
    expect(body.students[0].id).toBe('student-entity-1');
  });

  it('never adds a student to the roster from a recent SessionBooking alone (no active assignment)', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'coach-profile-1',
      pseudonym: 'CoachX',
      tag: 'Math',
      subjects: '["MATHEMATIQUES"]',
      user: { firstName: 'Coach', lastName: 'One', email: 'c@test.com' },
    });
    // No active CoachStudentAssignment at all.
    (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([]);
    mockSessionBookingSequence({
      // A student who booked a session with this coach in the last 30 days,
      // but who has NO active assignment — a historical/ended booking must
      // never reopen a dossier or add the student to the roster.
      recentBookings: [
        { studentProfileId: 'student-with-only-a-booking', scheduledDate: new Date() },
      ],
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.students).toEqual([]);
  });

  it('overlays recent booking recency onto a student already in the roster, without changing their canonical subject', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'coach-profile-1',
      pseudonym: 'CoachX',
      tag: 'Math',
      subjects: '["MATHEMATIQUES"]',
      user: { firstName: 'Coach', lastName: 'One', email: 'c@test.com' },
    });
    (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([
      {
        coachId: 'coach-profile-1',
        studentId: 'student-entity-1',
        subjects: ['MATHEMATIQUES'],
        academicCourseKeys: ['tc-maths-seconde'],
        createdAt: new Date('2020-01-01'),
        student: {
          id: 'student-entity-1',
          userId: 'student-1',
          grade: 'Seconde',
          gradeLevel: 'SECONDE',
          academicTrack: null,
          user: { firstName: 'Student', lastName: 'One' },
        },
      },
    ]);
    const recentDate = new Date();
    mockSessionBookingSequence({
      recentBookings: [{ studentProfileId: 'student-entity-1', scheduledDate: recentDate }],
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.students).toHaveLength(1);
    // Canonical course label, untouched by the booking overlay.
    expect(body.students[0].subject).toBe('Mathématiques');
    expect(new Date(body.students[0].lastSession).toISOString()).toBe(recentDate.toISOString());
  });

  it('exposes the canonical academicCourseKeys as course labels, not the legacy subjects join', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'coach-profile-1',
      pseudonym: 'CoachX',
      tag: 'Math',
      subjects: '["MATHEMATIQUES"]',
      user: { firstName: 'Coach', lastName: 'One', email: 'c@test.com' },
    });
    (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([
      {
        coachId: 'coach-profile-1',
        studentId: 'student-entity-1',
        subjects: ['MATHEMATIQUES'],
        academicCourseKeys: ['tc-maths-seconde'],
        createdAt: new Date(),
        student: {
          id: 'student-entity-1',
          userId: 'student-1',
          grade: 'Seconde',
          gradeLevel: 'SECONDE',
          academicTrack: null,
          user: { firstName: 'Student', lastName: 'One' },
        },
      },
    ]);
    mockSessionBookingSequence();

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.students[0].subject).toBe('Mathématiques');
  });
});
