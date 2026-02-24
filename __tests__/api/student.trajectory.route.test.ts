/**
 * Student Trajectory API — Complete Test Suite
 *
 * Tests: GET /api/student/trajectory
 *
 * Source: app/api/student/trajectory/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/scopes', () => ({
  resolveStudentScope: jest.fn(),
}));

jest.mock('@/lib/trajectory', () => ({
  getActiveTrajectory: jest.fn(),
}));

import { GET } from '@/app/api/student/trajectory/route';
import { auth } from '@/auth';
import { resolveStudentScope } from '@/lib/scopes';
import { getActiveTrajectory } from '@/lib/trajectory';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockResolveScope = resolveStudentScope as jest.MockedFunction<typeof resolveStudentScope>;
const mockGetTrajectory = getActiveTrajectory as jest.MockedFunction<typeof getActiveTrajectory>;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(params?: string): NextRequest {
  const url = params
    ? `http://localhost:3000/api/student/trajectory?${params}`
    : 'http://localhost:3000/api/student/trajectory';
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/student/trajectory', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Authentification');
  });

  it('should return 403 for unauthorized role (COACH)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'COACH' },
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
  });

  it('should return trajectory for ELEVE', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    } as any);
    mockResolveScope.mockResolvedValue({
      authorized: true,
      studentId: 'stu-1',
    } as any);
    mockGetTrajectory.mockResolvedValue({
      id: 'traj-1',
      title: 'Objectif Bac',
      description: 'Préparation bac maths',
      status: 'ACTIVE',
      horizon: 'TRIMESTRE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
      progress: 45,
      daysRemaining: 120,
      milestones: [
        { title: 'Maîtriser les dérivées', completed: true, targetDate: '2026-02-15' },
        { title: 'Maîtriser les intégrales', completed: false, targetDate: '2026-04-01' },
      ],
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trajectory.id).toBe('traj-1');
    expect(body.trajectory.progress).toBe(45);
    expect(body.trajectory.nextMilestoneTitle).toBe('Maîtriser les intégrales');
  });

  it('should return null trajectory when none exists', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    } as any);
    mockResolveScope.mockResolvedValue({
      authorized: true,
      studentId: 'stu-1',
    } as any);
    mockGetTrajectory.mockResolvedValue(null);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trajectory).toBeNull();
  });

  it('should return 403 when scope not authorized', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ADMIN' },
    } as any);
    mockResolveScope.mockResolvedValue({
      authorized: false,
      error: 'Student not found',
    } as any);

    const res = await GET(makeRequest('studentId=unknown'));
    const body = await res.json();

    expect(res.status).toBe(403);
  });

  it('should return null for PARENT with no child', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'PARENT' },
    } as any);
    mockResolveScope.mockResolvedValue({
      authorized: false,
      error: 'Aucun enfant trouvé',
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trajectory).toBeNull();
  });

  it('should return 500 on unexpected error', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    } as any);
    mockResolveScope.mockRejectedValue(new Error('DB error'));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
  });
});
