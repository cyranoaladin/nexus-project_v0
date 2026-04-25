/**
 * Route-level smoke test — STMG profile.
 * Builder-level STMG coverage lives in student.dashboard.payload.test.ts.
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

const mockSession = { user: { id: 'user-stmg', email: 'ines@test.com', role: 'ELEVE' as const } };

const stmgPayload = {
  student: { id: 's1', firstName: 'Ines', lastName: 'STMG', email: 'ines@test.com', grade: 'PREMIERE', gradeLevel: 'PREMIERE', academicTrack: 'STMG', specialties: [], stmgPathway: 'INDETERMINE', survivalMode: true, survivalModeReason: 'Objectif 8/20', school: null },
  cockpit: { seanceDuJour: null, feuilleDeRoute: [], alertes: [] },
  trackContent: {
    specialties: [],
    stmgModules: [
      { module: 'MATHS_STMG', label: 'Mathématiques STMG', skillGraphRef: 'maths_premiere_stmg', progress: { totalXp: 90, completedChapters: ['CH_STMG_MATH_SUITES'], masteredChapters: [], totalChaptersInProgram: 10, bestCombo: 0, streak: 0 } },
      { module: 'SGN', label: 'Sciences de gestion et numérique', skillGraphRef: 'sgn_premiere_stmg', progress: { totalXp: 0, completedChapters: [], masteredChapters: [], totalChaptersInProgram: 10, bestCombo: 0, streak: 0 } },
      { module: 'MANAGEMENT', label: 'Management', skillGraphRef: 'management_premiere_stmg', progress: { totalXp: 0, completedChapters: [], masteredChapters: [], totalChaptersInProgram: 10, bestCombo: 0, streak: 0 } },
      { module: 'DROIT_ECO', label: 'Droit-Économie', skillGraphRef: 'droit_eco_premiere_stmg', progress: { totalXp: 0, completedChapters: [], masteredChapters: [], totalChaptersInProgram: 10, bestCombo: 0, streak: 0 } },
    ],
  },
  sessionsCount: 0, nextSession: null, recentSessions: [],
  lastBilan: null, recentBilans: [],
  upcomingStages: [], pastStages: [],
  resources: [],
  ariaStats: { messagesToday: 0, totalConversations: 0, canUseAriaMaths: false, canUseAriaNsi: false },
  badges: [],
  trajectory: { id: null, title: null, progress: 0, daysRemaining: 0, milestones: [], nextMilestoneAt: null },
  automatismes: null,
  survivalProgress: { id: 'survival-1', qcmAttempts: 2, qcmCorrect: 1 },
  credits: { balance: 0, nonExpiredCount: 0, nextExpiryAt: null },
};

describe('GET /api/student/dashboard — STMG payload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(stmgPayload);
  });

  it('returns STMG modules and no EDS specialties content', async () => {
    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.student.academicTrack).toBe('STMG');
    expect(body.student.survivalMode).toBe(true);
    expect(body.survivalProgress).toEqual(expect.objectContaining({ id: 'survival-1' }));
    expect(body.trackContent.specialties).toHaveLength(0);
    expect(body.trackContent.stmgModules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ module: 'MATHS_STMG', skillGraphRef: 'maths_premiere_stmg' }),
        expect.objectContaining({ module: 'SGN', skillGraphRef: 'sgn_premiere_stmg' }),
        expect.objectContaining({ module: 'MANAGEMENT', skillGraphRef: 'management_premiere_stmg' }),
        expect.objectContaining({ module: 'DROIT_ECO', skillGraphRef: 'droit_eco_premiere_stmg' }),
      ])
    );
  });
});
