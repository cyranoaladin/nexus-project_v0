/**
 * Route-level smoke tests for GET /api/student/dashboard.
 *
 * Auth/permission coverage lives in student.dashboard.permissions.test.ts.
 * Payload shape coverage lives in student.dashboard.payload.test.ts.
 * This file covers the HTTP route plumbing (status codes, headers, error propagation).
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

const mockSession = { user: { id: 'user-1', email: 'e@test.com', role: 'ELEVE' as const } };

const stubPayload = {
  student: { id: 's1', firstName: 'Nour', lastName: 'B', email: 'e@test.com', grade: 'PREMIERE', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', specialties: [], stmgPathway: null, survivalMode: false, survivalModeReason: null, school: null },
  cockpit: { seanceDuJour: null, feuilleDeRoute: [], alertes: [] },
  trackContent: { specialties: [], stmgModules: [] },
  sessionsCount: 0, nextSession: null, recentSessions: [],
  lastBilan: null, recentBilans: [],
  upcomingStages: [], pastStages: [],
  resources: [],
  ariaStats: { messagesToday: 0, totalConversations: 1, canUseAriaMaths: false, canUseAriaNsi: false },
  badges: [{ id: 'b1', name: 'Badge', description: 'Desc', icon: 'icon', earnedAt: new Date().toISOString() }],
  trajectory: { id: null, title: null, progress: 0, daysRemaining: 0, milestones: [], nextMilestoneAt: null },
  automatismes: null, survivalProgress: null,
  credits: { balance: 1, nonExpiredCount: 1, nextExpiryAt: null },
};

describe('GET /api/student/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(stubPayload);
  });

  it('returns 401 when not student', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ status: 401, json: async () => ({ error: 'Unauthorized' }), headers: new Headers() });
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await GET({} as any);
    expect(response.status).toBe(401);
  });

  it('returns 200 with credits and badges', async () => {
    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.credits.balance).toBe(1);
    expect(body.ariaStats.totalConversations).toBe(1);
    expect(body.badges).toHaveLength(1);
  });

  it('returns 500 when builder throws', async () => {
    (buildStudentDashboardPayload as jest.Mock).mockRejectedValue(new Error('DB error'));

    const response = await GET({} as any);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Internal error');
  });
});
