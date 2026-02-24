/**
 * Bilan Pallier2 Maths Retry API — Complete Test Suite
 *
 * Tests: POST /api/bilan-pallier2-maths/retry
 *
 * Source: app/api/bilan-pallier2-maths/retry/route.ts
 */

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/validations', () => ({
  bilanDiagnosticMathsSchema: {
    parse: jest.fn((v: unknown) => v),
  },
}));

jest.mock('@/lib/bilan-scoring', () => ({
  computeScoring: jest.fn().mockReturnValue({
    readinessScore: 65,
    riskIndex: 30,
    recommendation: 'STAGE_RECOMMENDED',
  }),
}));

jest.mock('@/lib/bilan-generator', () => ({
  generateBilans: jest.fn(),
}));

jest.mock('@/lib/diagnostics/llm-contract', () => ({
  buildQualityFlags: jest.fn().mockReturnValue({
    ragAvailable: false,
    llmSuccessCount: 3,
  }),
}));

jest.mock('@/lib/diagnostics/score-diagnostic', () => ({
  computeScoringV2: jest.fn().mockReturnValue({
    dataQuality: { quality: 'good' },
    coverageIndex: 0.85,
    domainScores: [
      { domain: 'analysis', score: 80, priority: 'low', evaluatedCount: 5, totalCount: 5, gaps: [] },
      { domain: 'algebra', score: 30, priority: 'critical', evaluatedCount: 3, totalCount: 5, gaps: ['suites'] },
    ],
  }),
}));

jest.mock('@/lib/diagnostics/definitions', () => ({
  getDefinition: jest.fn().mockReturnValue({
    scoringPolicy: { domainWeights: { analysis: 0.28 } },
  }),
}));

jest.mock('@/lib/diagnostics/types', () => ({
  DiagnosticStatus: {
    FAILED: 'FAILED',
    SCORED: 'SCORED',
    GENERATING: 'GENERATING',
    ANALYZED: 'ANALYZED',
  },
}));

import { POST } from '@/app/api/bilan-pallier2-maths/retry/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { generateBilans } from '@/lib/bilan-generator';
import { NextRequest, NextResponse } from 'next/server';

const mockRequireAnyRole = requireAnyRole as jest.MockedFunction<typeof requireAnyRole>;
const mockIsErrorResponse = isErrorResponse as jest.MockedFunction<typeof isErrorResponse>;
const mockGenerateBilans = generateBilans as jest.MockedFunction<typeof generateBilans>;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/bilan-pallier2-maths/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/bilan-pallier2-maths/retry', () => {
  it('should return 403 for unauthorized role', async () => {
    const errorRes = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mockRequireAnyRole.mockResolvedValue(errorRes as any);
    mockIsErrorResponse.mockReturnValue(true);

    const res = await POST(makeRequest({ diagnosticId: 'd1' }));
    expect(res.status).toBe(403);
  });

  it('should return 400 for missing diagnosticId', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);

    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('diagnosticId');
  });

  it('should return 404 when diagnostic not found', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.diagnostic.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ diagnosticId: 'nonexistent' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('non trouvé');
  });

  it('should return 409 for non-retryable status', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.diagnostic.findUnique.mockResolvedValue({
      id: 'd1',
      status: 'ANALYZED',
      data: {},
    });

    const res = await POST(makeRequest({ diagnosticId: 'd1' }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('Retry non autorisé');
  });

  it('should return 422 when diagnostic data is missing', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.diagnostic.findUnique.mockResolvedValue({
      id: 'd1',
      status: 'FAILED',
      data: null,
    });

    const res = await POST(makeRequest({ diagnosticId: 'd1' }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain('manquantes');
  });

  it('should retry and succeed for FAILED diagnostic', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.diagnostic.findUnique.mockResolvedValue({
      id: 'd1',
      status: 'FAILED',
      data: { studentName: 'Ahmed', answers: [] },
      definitionKey: 'maths-premiere-p2',
    });
    prisma.diagnostic.update.mockResolvedValue({});
    mockGenerateBilans.mockResolvedValue({
      eleve: '# Bilan Élève',
      parents: '# Bilan Parents',
      nexus: '# Bilan Nexus',
    } as any);

    const res = await POST(makeRequest({ diagnosticId: 'd1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe('ANALYZED');
    // Should have been called twice: once for GENERATING, once for ANALYZED
    expect(prisma.diagnostic.update).toHaveBeenCalledTimes(2);
  });

  it('should return 502 when LLM generation fails', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.diagnostic.findUnique.mockResolvedValue({
      id: 'd1',
      status: 'SCORED',
      data: { studentName: 'Ahmed', answers: [] },
      definitionKey: 'maths-premiere-p2',
    });
    prisma.diagnostic.update.mockResolvedValue({});
    mockGenerateBilans.mockRejectedValue(new Error('Ollama timeout'));

    const res = await POST(makeRequest({ diagnosticId: 'd1' }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.errorCode).toBe('OLLAMA_TIMEOUT');
  });
});
