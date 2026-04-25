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

const mockEleveSession = {
  user: { id: 'user-eleve-1', email: 'eleve@test.com', role: 'ELEVE' as const },
};

const mockUnauthorizedResponse = {
  status: 401,
  json: async () => ({ error: 'Unauthorized' }),
  headers: new Headers(),
};

const mockForbiddenResponse = {
  status: 403,
  json: async () => ({ error: 'Forbidden' }),
  headers: new Headers(),
};

const minimalPayload = {
  student: { id: 's1', firstName: 'Nour', lastName: 'B', email: 'e@e.com', grade: 'PREMIERE', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', specialties: [], stmgPathway: null, survivalMode: false, survivalModeReason: null, school: null },
  cockpit: { seanceDuJour: null, feuilleDeRoute: [], alertes: [] },
  trackContent: { specialties: [], stmgModules: [] },
  sessionsCount: 0, nextSession: null, recentSessions: [],
  lastBilan: null, recentBilans: [],
  upcomingStages: [], pastStages: [],
  resources: [],
  ariaStats: { messagesToday: 0, totalConversations: 0, canUseAriaMaths: false, canUseAriaNsi: false },
  badges: [],
  trajectory: { id: null, title: null, progress: 0, daysRemaining: 0, milestones: [], nextMilestoneAt: null },
  automatismes: null, survivalProgress: null,
  credits: { balance: 0, nonExpiredCount: 0, nextExpiryAt: null },
};

describe('GET /api/student/dashboard — permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (buildStudentDashboardPayload as jest.Mock).mockResolvedValue(minimalPayload);
  });

  it('returns 401 when unauthenticated', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mockUnauthorizedResponse);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await GET({} as any);
    expect(response.status).toBe(401);
  });

  it('returns 403 when role is COACH', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mockForbiddenResponse);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await GET({} as any);
    expect(response.status).toBe(403);
  });

  it('returns 403 when role is PARENT', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mockForbiddenResponse);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await GET({} as any);
    expect(response.status).toBe(403);
  });

  it('returns 403 when role is ADMIN', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mockForbiddenResponse);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await GET({} as any);
    expect(response.status).toBe(403);
  });

  it('returns 200 with payload for ELEVE', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mockEleveSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);

    const response = await GET({} as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('student');
    expect(buildStudentDashboardPayload).toHaveBeenCalledWith('user-eleve-1');
  });

  it('returns 500 when payload builder throws', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mockEleveSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    (buildStudentDashboardPayload as jest.Mock).mockRejectedValue(new Error('DB failure'));

    const response = await GET({} as any);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Internal error');
  });

  it('includes Cache-Control and X-Payload-Build-Ms headers for ELEVE', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mockEleveSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);

    const response = await GET({} as any);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=10');
    expect(response.headers.has('X-Payload-Build-Ms')).toBe(true);
  });

  it('ignores any external studentId and uses session.user.id only (horizontal ownership)', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mockEleveSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);

    // Attacker attempts to inject a foreign studentId via query string
    const req = new Request('http://localhost/api/student/dashboard?studentId=other-user-id') as any;
    await GET(req);

    expect(buildStudentDashboardPayload).toHaveBeenCalledWith('user-eleve-1');
    expect(buildStudentDashboardPayload).not.toHaveBeenCalledWith('other-user-id');
  });
});
