/**
 * Route-level smoke test — EDS Première profile.
 * Builder-level EDS coverage lives in student.dashboard.payload.test.ts.
 */
import { GET } from '@/app/api/student/dashboard/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/dashboard/student-payload', () => ({
  buildStudentDashboardPayload: jest.fn(),
}));

const mockSession = { user: { id: 'user-1', email: 'nour@test.com', role: 'ELEVE' as const } };

const edsPayload = {
  student: { id: 's1', firstName: 'Nour', lastName: 'EDS', email: 'nour@test.com', grade: 'PREMIERE', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', specialties: ['MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE'], stmgPathway: null, survivalMode: false, survivalModeReason: null, school: null },
  cockpit: { seanceDuJour: null, feuilleDeRoute: [], alertes: [] },
  trackContent: {
    specialties: [
      { subject: 'MATHEMATIQUES', skillGraphRef: 'maths_premiere', progress: { totalXp: 120, completedChapters: ['CH_M1_SUITES'], masteredChapters: [], totalChaptersInProgram: 10, bestCombo: 0, streak: 0 } },
      { subject: 'NSI', skillGraphRef: 'nsi_premiere', progress: { totalXp: 0, completedChapters: [], masteredChapters: [], totalChaptersInProgram: 10, bestCombo: 0, streak: 0 } },
      { subject: 'PHYSIQUE_CHIMIE', skillGraphRef: 'physique_chimie_premiere', progress: { totalXp: 0, completedChapters: [], masteredChapters: [], totalChaptersInProgram: 10, bestCombo: 0, streak: 0 } },
    ],
    stmgModules: [],
  },
  sessionsCount: 0, nextSession: null, recentSessions: [],
  lastBilan: null, recentBilans: [],
  upcomingStages: [], pastStages: [],
  resources: [],
  ariaStats: { messagesToday: 0, totalConversations: 0, canUseAriaMaths: true, canUseAriaNsi: false },
  badges: [],
  trajectory: { id: null, title: null, progress: 0, daysRemaining: 0, milestones: [], nextMilestoneAt: null },
  automatismes: null,
  survivalProgress: null,
  credits: { balance: 3, nonExpiredCount: 3, nextExpiryAt: null },
};

describe('GET /api/student/dashboard — EDS payload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(edsPayload);
  });

  it('returns specialties track content for Premiere EDS student', async () => {
    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.student).toEqual(expect.objectContaining({
      gradeLevel: 'PREMIERE',
      academicTrack: 'EDS_GENERALE',
      specialties: ['MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE'],
    }));
    expect(body.trackContent.specialties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject: 'MATHEMATIQUES', skillGraphRef: 'maths_premiere' }),
        expect.objectContaining({ subject: 'NSI', skillGraphRef: 'nsi_premiere' }),
      ])
    );
    expect(body.trackContent.stmgModules).toHaveLength(0);
  });
});
