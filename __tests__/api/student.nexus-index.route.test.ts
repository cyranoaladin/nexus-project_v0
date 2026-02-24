/**
 * Student Nexus Index API — Complete Test Suite
 *
 * Tests: GET /api/student/nexus-index
 *
 * Source: app/api/student/nexus-index/route.ts
 */

import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/auth', () => ({
  auth: () => mockAuth(),
}));

jest.mock('@/lib/scopes', () => ({
  resolveStudentScope: jest.fn().mockResolvedValue({ authorized: true, studentUserId: 'user-1' }),
}));

jest.mock('@/lib/nexus-index', () => ({
  computeNexusIndex: jest.fn().mockResolvedValue({
    globalIndex: 65,
    pillars: { academic: 70, engagement: 60, progression: 65 },
    level: 'intermediate',
  }),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    assessment: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

function mockSession(role: string, userId = 'user-1') {
  return {
    user: {
      id: userId,
      email: `${role.toLowerCase()}@nexus.test`,
      role,
      firstName: 'Test',
      lastName: role,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

describe('GET /api/student/nexus-index', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 for unauthenticated request', async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import('@/app/api/student/nexus-index/route');
    const request = new NextRequest('http://localhost/api/student/nexus-index');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 403 for COACH role', async () => {
    mockAuth.mockResolvedValue(mockSession('COACH'));
    const { GET } = await import('@/app/api/student/nexus-index/route');
    const request = new NextRequest('http://localhost/api/student/nexus-index');
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it('should allow ELEVE to access their nexus index', async () => {
    mockAuth.mockResolvedValue(mockSession('ELEVE'));
    const { GET } = await import('@/app/api/student/nexus-index/route');
    const request = new NextRequest('http://localhost/api/student/nexus-index');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
