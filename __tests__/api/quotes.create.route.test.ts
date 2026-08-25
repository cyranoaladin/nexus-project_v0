jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAuth: jest.fn(),
  requireParentOwnsStudent: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/diagnostic.server', () => ({
  loadRawDomainScores: jest.fn(),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  createQuote: jest.fn(),
}));
jest.mock('@/lib/quotes/pipeline-flag', () => ({
  isShadowModeEnabled: jest.fn().mockReturnValue(false),
}));
jest.mock('@/lib/quotes/shadow-persistence.server', () => ({
  logShadowComparisonWithTimeout: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/crm/contact-leads', () => {
  const actual = jest.requireActual('@/lib/crm/contact-leads');
  return {
    ...actual,
    captureContactLead: jest.fn(),
  };
});

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/route';
import { requireAuth, requireParentOwnsStudent } from '@/lib/guards';
import { createQuote } from '@/lib/quotes/persistence.server';
import { isShadowModeEnabled } from '@/lib/quotes/pipeline-flag';
import { logShadowComparisonWithTimeout } from '@/lib/quotes/shadow-persistence.server';

const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireParentOwnsStudent = requireParentOwnsStudent as jest.Mock;
const mockCreateQuote = createQuote as jest.Mock;
const mockIsShadowModeEnabled = isShadowModeEnabled as jest.Mock;
const mockLogShadowComparison = logShadowComparisonWithTimeout as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/quotes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  idempotencyKey: 'idem-key-1234567890',
  situation: { level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'] },
  budget: { monthlyBudgetTnd: 1000, strategy: 'BEST_BALANCE' },
  scenarioTier: 'RECOMMANDE',
  contact: {
    parentName: 'Jean Dupont',
    studentFirstName: 'Marie',
    whatsapp: '+21699000000',
    email: 'jean.dupont@example.com',
    consent: true,
  },
};

describe('POST /api/quotes (create)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateQuote.mockResolvedValue({
      quote: { id: 'quote-1', status: 'ESTIMATION', validUntil: new Date('2027-03-01T00:00:00.000Z'), lines: [] },
      rawToken: 'raw-token-abc',
      alreadyExisted: false,
    });
    mockIsShadowModeEnabled.mockReturnValue(false);
  });

  test('rejects a payload without consent', async () => {
    const res = await POST(makeRequest({ ...validBody, contact: { ...validBody.contact, consent: false } }));
    expect(res.status).toBe(400);
  });

  test('rejects unknown fields (.strict())', async () => {
    const res = await POST(makeRequest({ ...validBody, extraField: 'nope' }));
    expect(res.status).toBe(400);
  });

  test('creates a quote and returns the public token when no ownership is needed', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quoteId).toBe('quote-1');
    expect(json.token).toBe('raw-token-abc');
    expect(json.scenario).toEqual(mockCreateQuote.mock.calls[0][0].scenario);
    expect(json.situation).toEqual(validBody.situation);
    expect(json.validUntil).toBe('2027-03-01T00:00:00.000Z');
    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
    expect(mockCreateQuote).toHaveBeenCalledWith(expect.objectContaining({
      contact: expect.objectContaining({
        name: 'Jean Dupont',
        email: 'jean.dupont@example.com',
        consent: true,
      }),
    }));
    expect(mockRequireAuth).not.toHaveBeenCalled(); // no studentId/diagnosticId => no auth needed
  });

  test('fails closed on an idempotent replay instead of mixing persisted identity with recomputed content', async () => {
    mockCreateQuote.mockResolvedValue({
      quote: {
        id: 'persisted-quote',
        status: 'ESTIMATION',
        validUntil: new Date('2027-04-01T00:00:00.000Z'),
        monthlyTotal: 150,
        grandTotal: 1500,
        lines: [],
      },
      rawToken: null,
      alreadyExisted: true,
    });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json).toEqual({ error: 'idempotency_key_reused' });
    expect(json.scenario).toBeUndefined();
    expect(json.situation).toBeUndefined();
  });

  test('rejects an arbitrary studentId with no session at all', async () => {
    mockRequireAuth.mockResolvedValue(new Response('unauthorized', { status: 401 }));
    const res = await POST(makeRequest({ ...validBody, studentId: 'someone-elses-student-id' }));
    expect(res.status).toBe(401);
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  test('rejects a studentId a signed-in PARENT does not own', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
    mockRequireParentOwnsStudent.mockResolvedValue(new Response('forbidden', { status: 403 }));
    const res = await POST(makeRequest({ ...validBody, studentId: 'not-my-student' }));
    expect(res.status).toBe(403);
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  test('accepts a studentId a signed-in PARENT does own', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
    mockRequireParentOwnsStudent.mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
    const res = await POST(makeRequest({ ...validBody, studentId: 'my-student' }));
    expect(res.status).toBe(200);
    expect(mockCreateQuote).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'my-student' }));
  });

  test('recomputes prices server-side and never trusts a client-submitted scenario body', async () => {
    await POST(makeRequest(validBody));
    const createCallArg = mockCreateQuote.mock.calls[0][0];
    // The scenario passed to persistence must be the server-recomputed one
    // (has real canonical line prices), not anything the client could have sent.
    expect(createCallArg.scenario).toBeDefined();
    expect(createCallArg.scenario.lines.every((l: { unitPriceMonthly: number }) => l.unitPriceMonthly > 0)).toBe(
      true,
    );
  });

  describe('staff path (existingContactLeadId)', () => {
    const staffBody = {
      idempotencyKey: 'idem-key-staff-0001',
      situation: validBody.situation,
      budget: validBody.budget,
      scenarioTier: 'RECOMMANDE',
      existingContactLeadId: 'lead-existing-1',
    };

    test('rejects existingContactLeadId with no session at all', async () => {
      mockRequireAuth.mockResolvedValue(new Response('unauthorized', { status: 401 }));
      const res = await POST(makeRequest(staffBody));
      expect(res.status).toBe(401);
      expect(mockCreateQuote).not.toHaveBeenCalled();
    });

    test('rejects existingContactLeadId from a non-staff role (e.g. PARENT)', async () => {
      mockRequireAuth.mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
      const res = await POST(makeRequest(staffBody));
      expect(res.status).toBe(403);
      expect(mockCreateQuote).not.toHaveBeenCalled();
    });

    test('ASSISTANTE can create a quote for an existing lead without re-capturing PII', async () => {
      mockRequireAuth.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
      const res = await POST(makeRequest(staffBody));
      expect(res.status).toBe(200);
      expect(mockCreateQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          contactLeadId: 'lead-existing-1',
          source: 'STAFF_WORKSPACE',
          createdByUserId: 'staff-1',
        }),
      );
    });

    test('rejects a payload with neither contact nor existingContactLeadId', async () => {
      const { contact: _contact, ...withoutContact } = validBody;
      const res = await POST(makeRequest(withoutContact));
      expect(res.status).toBe(400);
    });
  });

  // ── Shadow mode (recâblage mission §2/§3) ──

  describe('shadow mode', () => {
    test('OFF (default): the new pipeline never runs, never logged', async () => {
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(200);
      expect(mockLogShadowComparison).not.toHaveBeenCalled();
    });

    test('SHADOW enabled: runs and logs a comparison, but the visible response is unaffected', async () => {
      mockIsShadowModeEnabled.mockReturnValue(true);
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.quoteId).toBe('quote-1'); // identical to the OFF case — legacy response untouched
      expect(mockLogShadowComparison).toHaveBeenCalledTimes(1);
      const loggedRecord = mockLogShadowComparison.mock.calls[0][0];
      expect(loggedRecord).not.toHaveProperty('quoteId'); // no PII, no linkage to the contractual Quote
    });

    test('SHADOW enabled but the comparison/log throws: the visible response still succeeds (isolated failure)', async () => {
      mockIsShadowModeEnabled.mockReturnValue(true);
      mockLogShadowComparison.mockRejectedValue(new Error('db unavailable'));
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.quoteId).toBe('quote-1');
    });

    test('rollback proof: flipping the flag back to disabled immediately stops the pipeline, no residual effect from a prior enabled request', async () => {
      mockIsShadowModeEnabled.mockReturnValue(true);
      await POST(makeRequest(validBody));
      expect(mockLogShadowComparison).toHaveBeenCalledTimes(1);

      mockIsShadowModeEnabled.mockReturnValue(false); // simulates an ADMIN setting state=OFF
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(200);
      expect(mockLogShadowComparison).toHaveBeenCalledTimes(1); // unchanged — no second call after rollback
    });
  });
});
