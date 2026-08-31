import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((value: unknown) => value instanceof NextResponse),
}));

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn(),
}));

jest.mock('@/lib/quotes/pipeline-flag', () => ({
  isActiveForInternalStaff: jest.fn(),
}));

jest.mock('@/lib/api/helpers', () => ({
  generateRequestId: jest.fn(() => 'request-id-001'),
}));

jest.mock('@/lib/quotes/candidat-individuel-staff-search.server', () => ({
  searchCandidatIndividuelStudents: jest.fn(),
  searchCandidatIndividuelLeads: jest.fn(),
}));

import { POST as searchStudents } from '@/app/api/assistante/candidat-individuel/students/search/route';
import { POST as searchLeads } from '@/app/api/assistante/candidat-individuel/leads/search/route';
import { requireAnyRole } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { isActiveForInternalStaff } from '@/lib/quotes/pipeline-flag';
import {
  searchCandidatIndividuelLeads,
  searchCandidatIndividuelStudents,
} from '@/lib/quotes/candidat-individuel-staff-search.server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockGuardRateLimit = guardSensitiveRateLimit as jest.Mock;
const mockPipelineActive = isActiveForInternalStaff as jest.Mock;
const mockSearchStudents = searchCandidatIndividuelStudents as jest.Mock;
const mockSearchLeads = searchCandidatIndividuelLeads as jest.Mock;

type SearchCase = {
  name: string;
  operation: 'candidate-student-search' | 'candidate-lead-search';
  route: (request: NextRequest) => Promise<NextResponse>;
  url: string;
  scope: 'candidat-individuel-student-search' | 'candidat-individuel-lead-search';
  validRequest: Record<string, unknown>;
  normalizedRequest: Record<string, unknown>;
  success: Record<string, unknown>;
  service: jest.Mock;
};

const cases: SearchCase[] = [
  {
    name: 'students',
    operation: 'candidate-student-search',
    route: searchStudents,
    url: 'http://localhost/api/assistante/candidat-individuel/students/search',
    scope: 'candidat-individuel-student-search',
    validRequest: { query: '  élève  ', page: 1, limit: 20 },
    normalizedRequest: { query: 'élève', page: 1, limit: 20 },
    success: {
      items: [{ studentId: 'student_01', displayName: 'Élève Exemple', email: 'eleve@example.test', grade: 'TERMINALE', school: 'Lycée exemple', selectable: true, unavailableReason: null }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
    service: mockSearchStudents,
  },
  {
    name: 'leads',
    operation: 'candidate-lead-search',
    route: searchLeads,
    url: 'http://localhost/api/assistante/candidat-individuel/leads/search',
    scope: 'candidat-individuel-lead-search',
    validRequest: { query: '  parent  ', limit: 20 },
    normalizedRequest: { query: 'parent', limit: 20 },
    success: { items: [{ contactLeadId: 'contact-lead-001', displayName: 'Responsable Exemple', email: 'responsable@example.test' }] },
    service: mockSearchLeads,
  },
];

function request(url: string, body: string, contentType = 'application/json'): NextRequest {
  return new NextRequest(url, { method: 'POST', body, headers: { 'content-type': contentType, 'x-forwarded-for': '203.0.113.8' } });
}

function assertPrivateNoStore(response: Response): void {
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('x-request-id')).toBe('request-id-001');
}

describe.each(cases)('POST candidat-individuel $name search', (entry) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff_01', role: 'ADMIN' } });
    mockGuardRateLimit.mockResolvedValue(null);
    mockPipelineActive.mockResolvedValue(true);
    entry.service.mockResolvedValue(entry.success);
  });

  it.each(['ADMIN', 'ASSISTANTE'])('allows %s and returns the exact minimal DTO', async (role) => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff_01', role } });
    const response = await entry.route(request(entry.url, JSON.stringify(entry.validRequest)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(entry.success);
    expect(mockRequireAnyRole).toHaveBeenCalledWith(['ADMIN', 'ASSISTANTE']);
    expect(mockGuardRateLimit).toHaveBeenCalledWith(expect.any(NextRequest), { scope: entry.scope, identity: 'staff_01', dimensions: ['ip', 'identity'] });
    expect(entry.service).toHaveBeenCalledWith(entry.normalizedRequest);
    assertPrivateNoStore(response);
  });

  it('accepts application/json with media type parameters', async () => {
    const response = await entry.route(request(entry.url, JSON.stringify(entry.validRequest), 'application/json; charset=utf-8'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(entry.success);
    assertPrivateNoStore(response);
  });

  it('returns 401 before rate limiting for anonymous callers', async () => {
    mockRequireAnyRole.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    const response = await entry.route(request(entry.url, JSON.stringify(entry.validRequest)));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mockGuardRateLimit).not.toHaveBeenCalled();
    expect(entry.service).not.toHaveBeenCalled();
    assertPrivateNoStore(response);
  });

  it.each(['PARENT', 'ELEVE', 'COACH'])('returns 403 before rate limiting for %s', async () => {
    mockRequireAnyRole.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    const response = await entry.route(request(entry.url, JSON.stringify(entry.validRequest)));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(mockGuardRateLimit).not.toHaveBeenCalled();
    expect(entry.service).not.toHaveBeenCalled();
    assertPrivateNoStore(response);
  });

  it('rate limits before pipeline, body validation, or business lookup', async () => {
    mockGuardRateLimit.mockResolvedValue(NextResponse.json({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'PII' } }, { status: 429, headers: { 'retry-after': '30' } }));
    const response = await entry.route(request(entry.url, '{not-json'));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED' } });
    expect(response.headers.get('retry-after')).toBe('30');
    expect(mockPipelineActive).not.toHaveBeenCalled();
    expect(entry.service).not.toHaveBeenCalled();
    assertPrivateNoStore(response);
  });

  it('maps a rate-limit backend failure to a stable PII-free 500', async () => {
    mockGuardRateLimit.mockResolvedValue(NextResponse.json({ error: { code: 'RATE_LIMIT_BACKEND_UNAVAILABLE' } }, { status: 503 }));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await entry.route(request(entry.url, JSON.stringify(entry.validRequest)));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: { code: 'SEARCH_UNAVAILABLE' } });
    expect(log).toHaveBeenCalledWith({ operation: entry.operation, code: 'SEARCH_UNAVAILABLE', status: 500, requestId: 'request-id-001' });
    expect(entry.service).not.toHaveBeenCalled();
    assertPrivateNoStore(response);
    log.mockRestore();
  });

  it('returns 409 without parsing or searching when the pipeline is not internal', async () => {
    mockPipelineActive.mockResolvedValue(false);
    const response = await entry.route(request(entry.url, '{not-json'));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: { code: 'PIPELINE_INACTIVE' } });
    expect(entry.service).not.toHaveBeenCalled();
    assertPrivateNoStore(response);
  });

  it.each([
    ['malformed JSON', '{not-json', 'application/json'],
    ['non-JSON content type', JSON.stringify({}), 'text/plain'],
    ['lookalike JSON content type', JSON.stringify(entry.validRequest), 'notapplication/json'],
    ['unknown request key', JSON.stringify({ ...entry.validRequest, secret: 'forbidden' }), 'application/json'],
  ])('returns 400 for %s', async (_label, body, contentType) => {
    const response = await entry.route(request(entry.url, body, contentType));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: { code: 'INVALID_REQUEST' } });
    expect(entry.service).not.toHaveBeenCalled();
    assertPrivateNoStore(response);
  });

  it('returns a stable 500 and never logs the raw service error', async () => {
    const sensitiveMarker = 'parent@example.test secret search body';
    entry.service.mockRejectedValue(new Error(sensitiveMarker));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await entry.route(request(entry.url, JSON.stringify(entry.validRequest)));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: { code: 'SEARCH_UNAVAILABLE' } });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ operation: entry.operation, code: 'SEARCH_UNAVAILABLE', status: 500, requestId: 'request-id-001' });
    expect(JSON.stringify(log.mock.calls)).not.toContain(sensitiveMarker);
    assertPrivateNoStore(response);
    log.mockRestore();
  });
});
