/**
 * @jest-environment node
 */

/**
 * API Integration Tests — /api/bilan-pallier2-maths + /api/diagnostics/definitions
 *
 * Tests:
 * - GET list = STAFF ONLY (403 for unauthenticated/non-staff)
 * - GET ?id= with invalid/expired token => 401
 * - GET ?t= with tampered signed token => 401
 * - POST with invalid schema => 400
 * - GET /api/diagnostics/definitions?id=unknown => 404
 * - GET /api/diagnostics/definitions (list) => 200 with definitions
 */

import { GET as getDefinitions } from '@/app/api/diagnostics/definitions/route';
import { GET as getBilan, POST as postBilan } from '@/app/api/bilan-pallier2-maths/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { verifyBilanToken } from '@/lib/diagnostics/signed-token';
import { NextRequest } from 'next/server';

// Mock auth to prevent @auth/prisma-adapter ESM import chain
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock guards (fully — no requireActual to avoid ESM chain)
jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    diagnostic: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock bilan-generator (avoid LLM calls)
jest.mock('@/lib/bilan-generator', () => ({
  generateBilans: jest.fn().mockResolvedValue({
    eleve: '# Bilan Élève',
    parents: '# Bilan Parents',
    nexus: '# Bilan Nexus',
  }),
}));

// Mock bilan-scoring
jest.mock('@/lib/bilan-scoring', () => ({
  computeScoring: jest.fn().mockReturnValue({
    readinessScore: 65,
    riskIndex: 30,
    recommendation: 'Pallier2_confirmed',
  }),
}));

// Mock rate-limit
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(null),
}));

// Mock csrf
jest.mock('@/lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));

// Mock signed-token
jest.mock('@/lib/diagnostics/signed-token', () => ({
  generateBilanToken: jest.fn().mockReturnValue('mock-token'),
  verifyBilanToken: jest.fn(),
}));

// Mock llm-contract
jest.mock('@/lib/diagnostics/llm-contract', () => ({
  buildQualityFlags: jest.fn().mockReturnValue({}),
}));

/**
 * Helper: create a NextRequest with URL and optional body
 */
function makeRequest(url: string, options?: Record<string, unknown>): NextRequest {
  return new NextRequest(url, options as any);
}

/* ═══════════════════════════════════════════════════════════════════════════
   /api/diagnostics/definitions
   ═══════════════════════════════════════════════════════════════════════════ */

describe('GET /api/diagnostics/definitions', () => {
  it('returns 200 with list of definitions when no id param', async () => {
    const req = new Request('http://localhost:3000/api/diagnostics/definitions');
    const res = await getDefinitions(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.definitions).toBeDefined();
    expect(Array.isArray(data.definitions)).toBe(true);
    expect(data.definitions.length).toBeGreaterThanOrEqual(4);
  });

  it('returns 200 with definition details for valid id', async () => {
    const req = new Request('http://localhost:3000/api/diagnostics/definitions?id=maths-premiere-p2');
    const res = await getDefinitions(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.key).toBe('maths-premiere-p2');
    expect(data.domains).toBeDefined();
    expect(data.chapters).toBeDefined();
    expect(Array.isArray(data.domains)).toBe(true);
  });

  it('returns 404 for unknown definitionKey', async () => {
    const req = new Request('http://localhost:3000/api/diagnostics/definitions?id=unknown-definition-xyz');
    const res = await getDefinitions(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('does NOT expose prompts or scoring thresholds in response', async () => {
    const req = new Request('http://localhost:3000/api/diagnostics/definitions?id=maths-premiere-p2');
    const res = await getDefinitions(req);
    const data = await res.json();

    expect(data.prompts).toBeUndefined();
    expect(data.scoringPolicy).toBeUndefined();
    expect(data.ragPolicy).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/bilan-pallier2-maths — RBAC
   ═══════════════════════════════════════════════════════════════════════════ */

describe('GET /api/bilan-pallier2-maths — RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when unauthenticated user requests list (no params)', async () => {
    const mockErrorResponse = {
      json: async () => ({ error: 'Forbidden' }),
      status: 403,
    };
    (requireAnyRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

    const req = makeRequest('http://localhost:3000/api/bilan-pallier2-maths');
    const res = await getBilan(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 when non-staff user requests by id', async () => {
    const mockErrorResponse = {
      json: async () => ({ error: 'Forbidden', message: 'Required role: ADMIN, ASSISTANTE, COACH' }),
      status: 403,
    };
    (requireAnyRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

    const req = makeRequest('http://localhost:3000/api/bilan-pallier2-maths?id=some-id');
    const res = await getBilan(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 401 when signed token is invalid/expired', async () => {
    (verifyBilanToken as jest.Mock).mockReturnValue(null); // invalid token

    const req = makeRequest('http://localhost:3000/api/bilan-pallier2-maths?t=invalid-token-xyz');
    const res = await getBilan(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('invalide');
  });

  it('returns 401 when signed token is tampered', async () => {
    (verifyBilanToken as jest.Mock).mockReturnValue(null); // tampered = fails verification

    const req = makeRequest('http://localhost:3000/api/bilan-pallier2-maths?t=tampered.token.here');
    const res = await getBilan(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('invalide');
  });

  it('returns diagnostic when valid signed token provided', async () => {
    const { prisma } = require('@/lib/prisma');
    (verifyBilanToken as jest.Mock).mockReturnValue({ shareId: 'share-123', audience: 'eleve' });
    prisma.diagnostic.findUnique.mockResolvedValue({
      id: 'diag-1',
      publicShareId: 'share-123',
      type: 'DIAGNOSTIC_PRE_STAGE_MATHS',
      studentFirstName: 'Test',
      studentLastName: 'User',
      status: 'ANALYZED',
      studentMarkdown: '# Bilan',
      parentsMarkdown: '# Parents',
      createdAt: new Date(),
    });

    const req = makeRequest('http://localhost:3000/api/bilan-pallier2-maths?t=valid-token');
    const res = await getBilan(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.diagnostic).toBeDefined();
    expect(data.audience).toBe('eleve');
    // Audience restriction: only eleve markdown should be returned
    expect(data.diagnostic.studentMarkdown).toBe('# Bilan');
    expect(data.diagnostic.parentsMarkdown).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/bilan-pallier2-maths — schema validation
   ═══════════════════════════════════════════════════════════════════════════ */

describe('POST /api/bilan-pallier2-maths — schema validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 for invalid/empty body', async () => {
    const req = makeRequest('http://localhost:3000/api/bilan-pallier2-maths', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await postBilan(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('invalide');
  });

  it('returns 400 for body missing required fields', async () => {
    const req = makeRequest('http://localhost:3000/api/bilan-pallier2-maths', {
      method: 'POST',
      body: JSON.stringify({
        identity: { firstName: 'Test' },
        // Missing all other required fields
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await postBilan(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('invalide');
  });
});
