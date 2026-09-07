/**
 * Integration-style tests for buildStudentDashboardPayload.
 *
 * Each test verifies that the correct shape is produced for the 4 main
 * student profiles: EDS Première, EDS Terminale, STMG Première, STMG Terminale.
 */

import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';
import { prisma } from '@/lib/prisma';
import { getUserEntitlements } from '@/lib/entitlement/engine';
import { getActiveTrajectory, parseMilestones } from '@/lib/trajectory';
import { getNextStep } from '@/lib/next-step-engine';
import { tunisTodayUtcMidnight, parseCalendarDate } from '@/lib/planning/series';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    mathsProgress: { findFirst: jest.fn() },
    bilan: { findMany: jest.fn() },
    stageReservation: { findMany: jest.fn() },
    userDocument: { findMany: jest.fn() },
    invoice: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/entitlement/engine', () => ({
  getUserEntitlements: jest.fn(),
}));

jest.mock('@/lib/trajectory', () => ({
  getActiveTrajectory: jest.fn(),
  parseMilestones: jest.fn(),
}));

jest.mock('@/lib/next-step-engine', () => ({
  getNextStep: jest.fn(),
}));

// ─── Shared helpers ───────────────────────────────────────────────────────────

function makeStudent(overrides: Partial<{
  academicTrack: string;
  grade: string;
  gradeLevel: string;
  survivalMode: boolean;
  stmgPathway: string | null;
  academicEnrollments: Array<{ courseKey: string; kind: string; source: string }>;
}> = {}) {
  const gradeLevel = overrides.gradeLevel ?? 'PREMIERE';
  // Clé alignée sur le niveau réel de l'élève, comme le SSoT d'inscriptions l'exige.
  const defaultMathsSpecialtyCourseKey =
    gradeLevel === 'TERMINALE' ? 'eds-maths-terminale' : 'eds-maths-premiere';
  return {
    id: 'student-1',
    userId: 'user-1',
    grade: overrides.grade ?? gradeLevel,
    gradeLevel,
    academicTrack: overrides.academicTrack ?? 'EDS_GENERALE',
    academicEnrollments: overrides.academicEnrollments ?? [
      { courseKey: defaultMathsSpecialtyCourseKey, kind: 'SPECIALTY', source: 'SEED' },
    ],
    stmgPathway: overrides.stmgPathway ?? null,
    survivalMode: overrides.survivalMode ?? false,
    survivalModeReason: null,
    school: null,
    credits: 3,
    totalSessions: 5,
    user: {
      email: 'eleve@test.com',
      firstName: 'Nour',
      lastName: 'Ben Ali',
      mathsProgress: [],
    },
    canonicalSessionBookings: [],
    ariaConversations: [],
    creditTransactions: [
      { amount: 3, expiresAt: null },
    ],
    badges: [],
    survivalProgress: null,
  };
}

const emptyMathsProgress = {
  id: 'mp-1',
  userId: 'user-1',
  level: 'PREMIERE',
  track: 'EDS_GENERALE',
  completedChapters: [],
  masteredChapters: [],
  totalXp: 0,
  quizScore: 0,
  bestCombo: 0,
  streak: 0,
  lastActivityDate: null,
  exerciseResults: {},
};

function setupDefaultMocks() {
  (prisma.mathsProgress.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.bilan.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.stageReservation.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.userDocument.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
  (getUserEntitlements as jest.Mock).mockResolvedValue([]);
  (getActiveTrajectory as jest.Mock).mockResolvedValue(null);
  (parseMilestones as jest.Mock).mockReturnValue([]);
  (getNextStep as jest.Mock).mockResolvedValue(null);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildStudentDashboardPayload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  describe('EDS Première (EDS_GENERALE)', () => {
    it('returns correct student metadata', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'EDS_GENERALE', gradeLevel: 'PREMIERE' })
      );

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.student.academicTrack).toBe('EDS_GENERALE');
      expect(result.student.gradeLevel).toBe('PREMIERE');
      expect(result.student.firstName).toBe('Nour');
      expect(result.student.lastName).toBe('Ben Ali');
    });

    it('returns null automatismes when no mathsProgress', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'EDS_GENERALE', gradeLevel: 'PREMIERE' })
      );
      (prisma.mathsProgress.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.automatismes).toBeNull();
    });

    it('derives automatismes from mathsProgress when present', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'EDS_GENERALE', gradeLevel: 'PREMIERE' })
      );
      (prisma.mathsProgress.findFirst as jest.Mock).mockResolvedValue({
        ...emptyMathsProgress,
        bestCombo: 5,
        streak: 3,
        exerciseResults: {
          ch1: { attempts: 10, correct: 8 },
          ch2: { attempts: 5, correct: 4 },
        },
      });

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.automatismes).not.toBeNull();
      expect(result.automatismes!.totalAttempted).toBe(15);
      expect(result.automatismes!.totalCorrect).toBe(12);
      expect(result.automatismes!.bestStreak).toBe(5);
      expect(result.automatismes!.accuracy).toBeCloseTo(0.8);
    });

    it('returns null survivalProgress for EDS track', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'EDS_GENERALE', gradeLevel: 'PREMIERE', survivalMode: true })
      );

      const result = await buildStudentDashboardPayload('user-1');

      // Survival is STMG-only
      expect(result.survivalProgress).toBeNull();
    });

    it('returns EDS specialties in trackContent and empty stmgModules', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({
          academicTrack: 'EDS_GENERALE',
          academicEnrollments: [
            { courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'SEED' },
            { courseKey: 'eds-nsi-premiere', kind: 'SPECIALTY', source: 'SEED' },
          ],
        })
      );

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.trackContent.stmgModules).toHaveLength(0);
      expect(result.trackContent.specialties).toHaveLength(2);
      expect(result.trackContent.specialties[0].subject).toBe('MATHEMATIQUES');
    });
  });

  describe('EDS Terminale (EDS_GENERALE)', () => {
    it('sets gradeLevel to TERMINALE correctly', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'EDS_GENERALE', gradeLevel: 'TERMINALE' })
      );

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.student.gradeLevel).toBe('TERMINALE');
    });

    it('returns automatismes from mathsProgress for Terminale EDS', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'EDS_GENERALE', gradeLevel: 'TERMINALE' })
      );
      (prisma.mathsProgress.findFirst as jest.Mock).mockResolvedValue({
        ...emptyMathsProgress,
        level: 'TERMINALE',
        bestCombo: 10,
      });

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.automatismes).not.toBeNull();
      expect(result.automatismes!.bestStreak).toBe(10);
    });

    it('points a Terminale maths/NSI specialty at the Terminale diagnostic bank, not Première', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({
          academicTrack: 'EDS_GENERALE',
          gradeLevel: 'TERMINALE',
          academicEnrollments: [
            { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'SEED' },
            { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'SEED' },
          ],
        })
      );

      const result = await buildStudentDashboardPayload('user-1');

      const maths = result.trackContent.specialties.find((s) => s.subject === 'MATHEMATIQUES');
      const nsi = result.trackContent.specialties.find((s) => s.subject === 'NSI');
      expect(maths?.diagnosticKey).toBe('maths-terminale-p2');
      expect(nsi?.diagnosticKey).toBe('nsi-terminale-p2');
    });
  });

  describe('STMG Première', () => {
    it('returns null automatismes for STMG', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'STMG', gradeLevel: 'PREMIERE' })
      );
      (prisma.mathsProgress.findFirst as jest.Mock).mockResolvedValue(emptyMathsProgress);

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.automatismes).toBeNull();
    });

    it('returns STMG modules and empty specialties', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'STMG', gradeLevel: 'PREMIERE' })
      );

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.trackContent.specialties).toHaveLength(0);
      expect(result.trackContent.stmgModules.length).toBeGreaterThan(0);
      const moduleNames = result.trackContent.stmgModules.map((m) => m.module);
      expect(moduleNames).toContain('MATHS_STMG');
    });

    it('returns survivalProgress when STMG + PREMIERE + survivalMode active', async () => {
      const storedProgress = {
        phase: 1,
        completedRituals: [],
        lastRitualAt: null,
        streakDays: 0,
      };
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        ...makeStudent({ academicTrack: 'STMG', gradeLevel: 'PREMIERE', survivalMode: true }),
        survivalProgress: storedProgress,
      });

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.survivalProgress).toEqual(storedProgress);
    });

    it('returns null survivalProgress when STMG + PREMIERE but survivalMode=false', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'STMG', gradeLevel: 'PREMIERE', survivalMode: false })
      );

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.survivalProgress).toBeNull();
    });

    it('adds interactive programme resources when legacy grade is empty', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({
          academicTrack: 'STMG',
          grade: '',
          gradeLevel: 'PREMIERE',
          survivalMode: false,
          academicEnrollments: [],
        })
      );

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.hub.byCategory.INTERACTIVE_PROGRAM).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Mathématiques STMG — livret interactif',
            externalUrl: '/dashboard/eleve/programme/maths',
          }),
          expect.objectContaining({
            title: 'Banque QCM Maths STMG — 30 questions',
            externalUrl: '/dashboard/eleve/programme/maths#qcm',
          }),
          expect.objectContaining({
            title: 'Skill graph Maths STMG — 17 compétences',
            externalUrl: '/dashboard/eleve/programme/maths#programme',
          }),
          expect.objectContaining({
            title: 'Sciences de gestion et numérique',
            externalUrl: '/dashboard/eleve/programme/sgn',
          }),
          expect.objectContaining({
            title: 'Management',
            externalUrl: '/dashboard/eleve/programme/management',
          }),
          expect.objectContaining({
            title: 'Droit-Économie',
            externalUrl: '/dashboard/eleve/programme/droit_eco',
          }),
          expect.objectContaining({
            title: 'Français EAF',
            externalUrl: 'https://eaf.nexusreussite.academy',
          }),
        ])
      );
      expect(result.hub.byCategory.INTERACTIVE_PROGRAM).toHaveLength(7);
      expect(result.hub.totalCount).toBeGreaterThanOrEqual(7);
    });
  });

  describe('STMG Terminale', () => {
    it('returns null survivalProgress for STMG Terminale even with survivalMode', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(
        makeStudent({ academicTrack: 'STMG', gradeLevel: 'TERMINALE', survivalMode: true })
      );

      const result = await buildStudentDashboardPayload('user-1');

      // Survival is only for Première
      expect(result.survivalProgress).toBeNull();
    });
  });

  describe('credits', () => {
    it('does not expose historical transactions', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        ...makeStudent(),
        creditTransactions: [
          { amount: 5, expiresAt: null },
          { amount: 2, expiresAt: futureDate },
          { amount: -3, expiresAt: null }, // debit
        ],
      });

      const result = await buildStudentDashboardPayload('user-1');

      expect(result).not.toHaveProperty('credits');
    });
  });

  describe('ariaStats', () => {
    it('gates aria features via entitlements', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(makeStudent());
      (getUserEntitlements as jest.Mock).mockResolvedValue([
        { features: ['aria_maths'] },
      ]);

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.ariaStats.canUseAriaMaths).toBe(true);
      expect(result.ariaStats.canUseAriaNsi).toBe(false);
    });
  });

  describe('bilans', () => {
    it('maps bilan rows to EleveBilan shape', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(makeStudent());
      const bilanRow = {
        id: 'bilan-1',
        publicShareId: 'share-abc',
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHEMATIQUES',
        status: 'COMPLETED',
        globalScore: 78.5,
        ssn: 42,
        confidenceIndex: 0.9,
        analysisJson: { trustLevel: 'high', topPriorities: ['Algèbre', 'Géométrie', 'Stats', 'Extra'] },
        parentsMarkdown: 'some content',
        createdAt: new Date('2026-03-01'),
      };
      (prisma.bilan.findMany as jest.Mock).mockResolvedValue([bilanRow]);

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.recentBilans).toHaveLength(1);
      const b = result.recentBilans[0];
      expect(b.id).toBe('bilan-1');
      expect(b.subject).toBe('MATHEMATIQUES');
      expect(b.trustLevel).toBe('high');
      expect(b.topPriorities).toHaveLength(3); // capped at 3
      expect(b.hasParentsRender).toBe(true);
      expect(b.resultUrl).toBe('/bilan-pallier2-maths/resultat/share-abc');
      expect(result.lastBilan).toEqual(b);
    });

    it('maps unknown bilan subject to MIXTE', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(makeStudent());
      (prisma.bilan.findMany as jest.Mock).mockResolvedValue([{
        id: 'b2', publicShareId: 'share-b2', type: 'CONTINUOUS',
        subject: 'UNKNOWN_SUBJECT', status: 'COMPLETED',
        globalScore: null, ssn: null, confidenceIndex: null,
        analysisJson: null, parentsMarkdown: null, createdAt: new Date(),
      }]);

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.recentBilans[0].subject).toBe('MIXTE');
    });
  });

  describe('resources', () => {
    it('maps UserDocument to EleveResource with download URL', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(makeStudent());
      (prisma.userDocument.findMany as jest.Mock).mockResolvedValue([{
        id: 'doc-1',
        title: 'Fiche de révision',
        originalName: 'fiche.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 102400,
        createdAt: new Date('2026-04-01'),
      }]);

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].downloadUrl).toBe('/api/student/documents/doc-1/download');
      expect(result.resources[0].type).toBe('USER_DOCUMENT');
    });
  });

  describe('sessions (canonical SessionBooking, not legacy Session)', () => {
    function makeBooking(overrides: Partial<{
      id: string;
      title: string;
      subject: string;
      status: string;
      scheduledDate: Date;
      startTime: string;
      endTime: string;
      duration: number;
      coachProfile: { pseudonym: string; user: { firstName: string; lastName: string } } | null;
    }> = {}) {
      return {
        id: overrides.id ?? 'booking-1',
        title: overrides.title ?? 'Séance de maths',
        subject: overrides.subject ?? 'MATHEMATIQUES',
        status: overrides.status ?? 'SCHEDULED',
        scheduledDate: overrides.scheduledDate ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        startTime: overrides.startTime ?? '10:00',
        endTime: overrides.endTime ?? '11:00',
        duration: overrides.duration ?? 60,
        coachProfile:
          overrides.coachProfile === undefined
            ? { pseudonym: 'Hélios', user: { firstName: 'Sarah', lastName: 'Coach' } }
            : overrides.coachProfile,
      };
    }

    it('derives nextSession from a real SessionBooking row', async () => {
      const booking = makeBooking({ id: 'sb-future', title: 'Coaching Terminale' });
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        ...makeStudent(),
        canonicalSessionBookings: [booking],
      });

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.nextSession).not.toBeNull();
      expect(result.nextSession!.id).toBe('sb-future');
      expect(result.nextSession!.title).toBe('Coaching Terminale');
      expect(result.nextSession!.coach).toEqual({
        firstName: 'Sarah',
        lastName: 'Coach',
        pseudonym: 'Hélios',
      });
    });

    it('does not fall back to a legacy Session row when canonicalSessionBookings is empty', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        ...makeStudent(),
        // A legacy `sessions` field present on the row (as the old relation
        // would have returned) must be fully ignored by the payload builder —
        // it no longer reads `student.sessions` at all.
        sessions: [
          {
            id: 'legacy-session-1',
            title: 'Séance historique',
            subject: 'MATHEMATIQUES',
            status: 'SCHEDULED',
            scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            duration: 60,
            coach: null,
          },
        ],
        canonicalSessionBookings: [],
      });

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.nextSession).toBeNull();
      expect(result.recentSessions).toHaveLength(0);
    });

    it('excludes a past SessionBooking from nextSession', async () => {
      const pastBooking = makeBooking({
        id: 'sb-past',
        scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      });
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        ...makeStudent(),
        canonicalSessionBookings: [pastBooking],
      });

      const result = await buildStudentDashboardPayload('user-1');

      expect(result.nextSession).toBeNull();
      expect(result.recentSessions).toHaveLength(1);
      expect(result.recentSessions[0].id).toBe('sb-past');
    });

    it('excludes a SessionBooking that already started (true time) from nextSession, even though its pseudo-UTC bookingStart is still ahead of a raw `now`', async () => {
      // Fixed instant: true UTC 2026-09-10T13:30:00Z == Tunis wall-clock
      // 2026-09-10 14:30 (Tunis is fixed UTC+1). A session scheduled Tunis
      // 2026-09-10 14:00 therefore started 30 minutes ago in true time.
      //
      // `combineDateAndTime` encodes the Tunis wall-clock time-of-day
      // directly as UTC hours/minutes ("pseudo-UTC"), so
      // bookingStart(s) = 2026-09-10T14:00:00Z — which is numerically AFTER
      // the raw `now` (2026-09-10T13:30:00Z) even though the session's real
      // start (13:00Z, i.e. true UTC = Tunis wall - 1h) is 30 minutes in the
      // past. Comparing bookingStart(s) > now (a true instant) directly is
      // exactly the bug: it would keep this already-started session
      // classified as "upcoming"/nextSession for a full extra hour.
      jest.useFakeTimers().setSystemTime(new Date('2026-09-10T13:30:00.000Z'));
      try {
        const startedBooking = makeBooking({
          id: 'sb-already-started',
          scheduledDate: parseCalendarDate('2026-09-10'),
          startTime: '14:00',
          endTime: '15:00',
        });
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
          ...makeStudent(),
          canonicalSessionBookings: [startedBooking],
        });

        const result = await buildStudentDashboardPayload('user-1');

        expect(result.nextSession).toBeNull();
        // The dashboard's "no session programmed" warning must fire for a
        // student whose only booking already started — buildAlertes reads
        // nextSession, so it inherits the fix for free once nextSession is
        // itself correct.
        expect(result.cockpit.alertes).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: 'no-session' })])
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('maps recentSessions with coach info from coachProfile, gracefully handling a null coachProfile', async () => {
      const withCoach = makeBooking({ id: 'sb-with-coach' });
      const withoutCoach = makeBooking({ id: 'sb-no-coach', coachProfile: null });
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        ...makeStudent(),
        canonicalSessionBookings: [withCoach, withoutCoach],
      });

      const result = await buildStudentDashboardPayload('user-1');

      const withCoachResult = result.recentSessions.find((s) => s.id === 'sb-with-coach');
      const withoutCoachResult = result.recentSessions.find((s) => s.id === 'sb-no-coach');
      expect(withCoachResult?.coach).toEqual({
        firstName: 'Sarah',
        lastName: 'Coach',
        pseudonym: 'Hélios',
      });
      expect(withoutCoachResult?.coach).toBeNull();
    });

    it('derives seanceDuJour (cockpit) from a SessionBooking scheduled today', async () => {
      // Build the fixture using the SAME Tunis-calendar-day, UTC-midnight-
      // anchored convention the production code uses for its `today`/`todayEnd`
      // boundary (`tunisTodayUtcMidnight`, lib/planning/series.ts). This makes
      // the test deterministic regardless of the runner's local timezone —
      // a `new Date(now.getFullYear(), now.getMonth(), now.getDate())` fixture
      // (local-runtime-timezone calendar day) is NOT guaranteed to fall inside
      // the production Tunis-day boundary and previously made this assertion
      // silently vacuous under an `if`.
      //
      // A late-evening startTime (23:30) is deliberately chosen: it sits in
      // the exact window a runtime-local-timezone boundary (instead of a
      // Tunis-calendar-day boundary) mis-brackets — this is what would have
      // caught the original bug (a booking scheduled for the current Tunis
      // calendar day, near its end, was excluded from `[today, todayEnd)`).
      const todayBooking = makeBooking({
        id: 'sb-today',
        scheduledDate: tunisTodayUtcMidnight(),
        startTime: '23:30',
        endTime: '23:59',
      });
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        ...makeStudent(),
        canonicalSessionBookings: [todayBooking],
      });

      const result = await buildStudentDashboardPayload('user-1');

      // seanceDuJour is populated because the booking's combined date+time
      // unconditionally falls within [today, todayEnd) — this must hold, not
      // merely might.
      expect(result.cockpit.seanceDuJour).not.toBeNull();
      expect(result.cockpit.seanceDuJour!.id).toBe('sb-today');
    });
  });

  describe('trajectory', () => {
    it('derives milestone status correctly', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(makeStudent());
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      (getActiveTrajectory as jest.Mock).mockResolvedValue({ id: 'traj-1', milestones: [] });
      (parseMilestones as jest.Mock).mockReturnValue([
        { id: 'm1', title: 'Bilan pallier 2', targetDate: futureDate, completed: false, completedAt: null },
        { id: 'm2', title: 'Stage hiver', targetDate: '2026-01-01', completed: true, completedAt: '2026-01-02' },
      ]);

      const result = await buildStudentDashboardPayload('user-1');

      const upcoming = result.trajectory.milestones.find((m) => m.id === 'm1');
      const completed = result.trajectory.milestones.find((m) => m.id === 'm2');
      expect(upcoming?.status).toBe('UPCOMING');
      expect(completed?.status).toBe('COMPLETED');
      expect(result.trajectory.nextMilestoneAt).toBe(futureDate);
    });
  });

  describe('error handling', () => {
    it('throws when student not found', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(buildStudentDashboardPayload('nonexistent-user')).rejects.toThrow(
        'Student not found for userId=nonexistent-user'
      );
    });
  });
});
