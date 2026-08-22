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
import { captureContactLead } from '@/lib/crm/contact-leads';

const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireParentOwnsStudent = requireParentOwnsStudent as jest.Mock;
const mockCreateQuote = createQuote as jest.Mock;
const mockCaptureLead = captureContactLead as jest.Mock;

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
    mockCaptureLead.mockResolvedValue({ id: 'lead-1' });
    mockCreateQuote.mockResolvedValue({
      quote: { id: 'quote-1', status: 'ESTIMATION', lines: [] },
      rawToken: 'raw-token-abc',
      alreadyExisted: false,
    });
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
    expect(mockCaptureLead).toHaveBeenCalledTimes(1);
    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
    expect(mockRequireAuth).not.toHaveBeenCalled(); // no studentId/diagnosticId => no auth needed
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
});
