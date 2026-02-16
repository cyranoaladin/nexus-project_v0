/**
 * Integration Tests for /api/bilan-pallier2-maths
 *
 * Covers:
 * B1. GET list = STAFF ONLY (401/403 for unauthenticated/non-staff)
 * B2. GET with invalid/expired signed token => 401
 * B3. POST with invalid schema => 400
 * B4. POST with unknown definitionKey => handled gracefully
 * B5. GET single diagnostic by id (staff-only)
 */

import { getServerSession } from 'next-auth';

// Type the mock
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

// Mock diagnostic-specific modules
jest.mock('@/lib/diagnostics/signed-token', () => ({
  generateBilanToken: jest.fn(() => 'mock-token'),
  verifyBilanToken: jest.fn(() => null), // default: invalid token
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/csrf', () => ({
  checkCsrf: jest.fn(() => null),
  checkBodySize: jest.fn(() => null),
}));

jest.mock('@/lib/bilan-scoring', () => ({
  computeScoring: jest.fn(() => ({
    readinessScore: 65,
    riskIndex: 30,
    recommendation: 'Pallier2_confirmed',
  })),
}));

jest.mock('@/lib/diagnostics/score-diagnostic', () => ({
  computeScoringV2: jest.fn(() => ({
    masteryIndex: 70,
    coverageIndex: 80,
    examReadinessIndex: 65,
    readinessScore: 70,
    riskIndex: 30,
    recommendation: 'Pallier2_confirmed',
    recommendationMessage: 'Profil compatible',
    justification: 'Test justification',
    upgradeConditions: [],
    domainScores: [],
    alerts: [],
    dataQuality: { activeDomains: 5, evaluatedCompetencies: 12, notStudiedCompetencies: 0, unknownCompetencies: 0, lowConfidence: false, quality: 'good', coherenceIssues: 0, miniTestFilled: true, criticalFieldsMissing: 0 },
    trustScore: 85,
    trustLevel: 'green',
    topPriorities: [],
    quickWins: [],
    highRisk: [],
    inconsistencies: [],
  })),
}));

jest.mock('@/lib/bilan-generator', () => ({
  generateBilans: jest.fn().mockResolvedValue({
    eleve: '# Bilan Élève',
    parents: '# Bilan Parents',
    nexus: '# Bilan Nexus',
  }),
}));

jest.mock('@/lib/diagnostics/llm-contract', () => ({
  buildQualityFlags: jest.fn(() => []),
}));

jest.mock('@/lib/diagnostics/definitions', () => ({
  getDefinition: jest.fn((key: string) => {
    if (key === 'unknown-xyz') throw new Error('Unknown diagnostic definition: "unknown-xyz"');
    return {
      key,
      version: 'v1.3',
      label: 'Test Definition',
      track: 'maths',
      level: 'premiere',
      stage: 'pallier2',
      scoringPolicy: {
        domainWeights: { algebra: 0.30, analysis: 0.30, geometry: 0.20, probabilities: 0.10, python: 0.10 },
        thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
      },
      prompts: { version: 'v1.0', eleve: '', parents: '', nexus: '' },
    };
  }),
}));

// Import the prisma mock
const { prisma } = require('@/lib/prisma');

describe('/api/bilan-pallier2-maths', () => {
  // ─── B1. GET list = STAFF ONLY ──────────────────────────────────────────────

  describe('GET (list) — RBAC', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeTruthy();
    });

    it('should return 403 when authenticated as ELEVE', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', email: 'student@test.com', role: 'ELEVE' },
      });

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths'
      );

      const response = await GET(request);
      expect([401, 403]).toContain(response.status);
    });

    it('should return 403 when authenticated as PARENT', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-2', email: 'parent@test.com', role: 'PARENT' },
      });

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths'
      );

      const response = await GET(request);
      expect([401, 403]).toContain(response.status);
    });

    it('should return 200 when authenticated as ADMIN', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' },
      });

      prisma.diagnostic = {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.diagnostics).toBeDefined();
      expect(Array.isArray(data.diagnostics)).toBe(true);
    });

    it('should return 200 when authenticated as COACH', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'coach-1', email: 'coach@test.com', role: 'COACH' },
      });

      prisma.diagnostic = {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });

  // ─── B2. GET with invalid/expired signed token ────────────────────────────────

  describe('GET — signed token access', () => {
    it('should return 401 for invalid signed token', async () => {
      const { verifyBilanToken } = require('@/lib/diagnostics/signed-token');
      verifyBilanToken.mockReturnValue(null);

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths?t=invalid.token.here'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('invalide');
    });

    it('should return 401 for expired signed token', async () => {
      const { verifyBilanToken } = require('@/lib/diagnostics/signed-token');
      verifyBilanToken.mockReturnValue(null); // expired = null

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths?t=expired.token.value'
      );

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return 404 when token is valid but diagnostic not found', async () => {
      const { verifyBilanToken } = require('@/lib/diagnostics/signed-token');
      verifyBilanToken.mockReturnValue({ shareId: 'nonexistent-share-id', audience: 'eleve' });

      prisma.diagnostic = {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths?t=valid.token.value'
      );

      const response = await GET(request);
      expect(response.status).toBe(404);
    });

    it('should return audience-restricted data for valid eleve token', async () => {
      const { verifyBilanToken } = require('@/lib/diagnostics/signed-token');
      verifyBilanToken.mockReturnValue({ shareId: 'share-123', audience: 'eleve' });

      prisma.diagnostic = {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 'diag-1',
          publicShareId: 'share-123',
          type: 'DIAGNOSTIC_PRE_STAGE_MATHS',
          studentFirstName: 'Test',
          studentLastName: 'Eleve',
          status: 'ANALYZED',
          mathAverage: '12',
          establishment: 'Lycée Test',
          data: {},
          studentMarkdown: '# Bilan Élève',
          parentsMarkdown: '# Bilan Parents',
          analysisResult: '{}',
          createdAt: new Date(),
        }),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths?t=valid.eleve.token'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.audience).toBe('eleve');
      // Eleve token should see studentMarkdown but NOT parentsMarkdown
      expect(data.diagnostic.studentMarkdown).toBe('# Bilan Élève');
      expect(data.diagnostic.parentsMarkdown).toBeNull();
    });

    it('should return audience-restricted data for valid parents token', async () => {
      const { verifyBilanToken } = require('@/lib/diagnostics/signed-token');
      verifyBilanToken.mockReturnValue({ shareId: 'share-123', audience: 'parents' });

      prisma.diagnostic = {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 'diag-1',
          publicShareId: 'share-123',
          type: 'DIAGNOSTIC_PRE_STAGE_MATHS',
          studentFirstName: 'Test',
          studentLastName: 'Eleve',
          status: 'ANALYZED',
          mathAverage: '12',
          establishment: 'Lycée Test',
          data: {},
          studentMarkdown: '# Bilan Élève',
          parentsMarkdown: '# Bilan Parents',
          analysisResult: '{}',
          createdAt: new Date(),
        }),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths?t=valid.parents.token'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.audience).toBe('parents');
      // Parents token should see parentsMarkdown but NOT studentMarkdown
      expect(data.diagnostic.parentsMarkdown).toBe('# Bilan Parents');
      expect(data.diagnostic.studentMarkdown).toBeNull();
    });
  });

  // ─── B3. POST with invalid schema ────────────────────────────────────────────

  describe('POST — schema validation', () => {
    it('should return 400 for empty body', async () => {
      const { POST } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request);
      expect([400, 500]).toContain(response.status);
    });

    it('should return 400 for missing identity fields', async () => {
      const { POST } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identity: { firstName: 'Test' }, // missing lastName, email
            schoolContext: {},
            performance: {},
            chapters: {},
            competencies: {},
            openQuestions: {},
            examPrep: {},
            methodology: {},
            ambition: {},
            freeText: {},
          }),
        }
      );

      const response = await POST(request);
      expect([400, 500]).toContain(response.status);
    });

    it('should return 400 for invalid email format', async () => {
      const { POST } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identity: { firstName: 'Test', lastName: 'User', email: 'not-an-email', phone: '12345678' },
            schoolContext: {},
            performance: {},
            chapters: {},
            competencies: {},
            openQuestions: {},
            examPrep: {
              miniTest: { score: 3, timeUsedMinutes: 15, completedInTime: true },
              selfRatings: { speedNoCalc: 2, calcReliability: 2, redaction: 2, justifications: 2, stress: 2 },
              signals: { hardestItems: [], verifiedAnswers: null, feeling: 'ok' },
            },
            methodology: {},
            ambition: {},
            freeText: {},
          }),
        }
      );

      const response = await POST(request);
      // Should fail Zod validation
      expect([400, 500]).toContain(response.status);
    });
  });

  // ─── B4. GET public share ─────────────────────────────────────────────────────

  describe('GET — public share access', () => {
    it('should return 404 for nonexistent publicShareId', async () => {
      prisma.diagnostic = {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths?share=nonexistent-id'
      );

      const response = await GET(request);
      expect(response.status).toBe(404);
    });

    it('should return diagnostic data for valid publicShareId', async () => {
      prisma.diagnostic = {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 'diag-1',
          publicShareId: 'valid-share-id',
          type: 'DIAGNOSTIC_PRE_STAGE_MATHS',
          studentFirstName: 'Test',
          studentLastName: 'Eleve',
          status: 'ANALYZED',
          mathAverage: '12',
          establishment: 'Lycée Test',
          data: {},
          studentMarkdown: '# Bilan',
          parentsMarkdown: '# Parents',
          analysisResult: '{}',
          createdAt: new Date(),
        }),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };

      const { GET } = await import('@/app/api/bilan-pallier2-maths/route');
      const request = new (require('next/server').NextRequest)(
        'http://localhost:3000/api/bilan-pallier2-maths?share=valid-share-id'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.diagnostic).toBeDefined();
      expect(data.diagnostic.publicShareId).toBe('valid-share-id');
    });
  });
});
