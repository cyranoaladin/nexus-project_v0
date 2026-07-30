import { NextRequest, NextResponse } from 'next/server';

import { AssessmentEngineError } from '@/lib/bilans/engine/errors';

const mockAuth = jest.fn();
const mockGuardRateLimit = jest.fn();
const mockAutosave = jest.fn();
const mockCreateAssignment = jest.fn();
const mockGetPublishedReport = jest.fn();
const mockListAssignments = jest.fn();
const mockScore = jest.fn();

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/pre-rentree/pedagogy/catalog', () => ({
  loadPedagogyCatalog: jest.fn(() => ({ fixture: true })),
}));
jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: (...args: unknown[]) => mockGuardRateLimit(...args),
}));
jest.mock('@/lib/csrf', () => ({
  checkBodySize: jest.fn(() => null),
  checkCsrf: jest.fn(() => null),
}));
jest.mock('@/lib/bilans/engine', () => {
  const actual = jest.requireActual('@/lib/bilans/engine');
  return {
    ...actual,
    autosaveAssessmentResponse: (...args: unknown[]) => mockAutosave(...args),
    createAssessmentAssignment: (...args: unknown[]) => mockCreateAssignment(...args),
    getPublishedAssessmentReport: (...args: unknown[]) => mockGetPublishedReport(...args),
    listAssessmentAssignments: (...args: unknown[]) => mockListAssignments(...args),
    scoreAssessmentAttempt: (...args: unknown[]) => mockScore(...args),
  };
});

import { GET as listAssignments } from '@/app/api/bilan-gratuit/v1/requests/current/assignments/route';
import { GET as getReport } from '@/app/api/bilan-gratuit/v1/requests/current/attempts/[attemptId]/report/route';
import { PUT as autosave } from '@/app/api/bilan-gratuit/v1/requests/current/attempts/[attemptId]/responses/[itemId]/route';
import { POST as createAssignment } from '@/app/api/bilan-gratuit/v1/team/assignments/route';
import { POST as scoreAttempt } from '@/app/api/bilan-gratuit/v1/team/attempts/[attemptId]/score/route';

const parentSession = {
  user: { id: 'parent-user-1', role: 'PARENT' },
};
const adminSession = {
  user: { id: 'admin-user-1', role: 'ADMIN' },
};

function request(
  url: string,
  method = 'GET',
  body?: unknown,
  idempotencyKey = 'engine_key_123456789',
) {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      origin: 'http://localhost:3000',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('canonical assessment engine API security boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BILAN_CANONICAL_INTAKE_ENABLED = 'true';
    delete process.env.BILAN_PROVISIONAL_RESULTS_ENABLED;
    mockGuardRateLimit.mockResolvedValue(null);
    mockListAssignments.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.BILAN_CANONICAL_INTAKE_ENABLED;
    delete process.env.BILAN_PROVISIONAL_RESULTS_ENABLED;
  });

  it('returns 404 before authentication while the canonical flag is disabled', async () => {
    delete process.env.BILAN_CANONICAL_INTAKE_ENABLED;
    const response = await listAssignments();

    expect(response.status).toBe(404);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockListAssignments).not.toHaveBeenCalled();
  });

  it('requires authentication for family resources', async () => {
    mockAuth.mockResolvedValue(null);
    const response = await listAssignments();

    expect(response.status).toBe(401);
    expect(mockListAssignments).not.toHaveBeenCalled();
  });

  it('refuses a parent on the team assignment route before parsing the body', async () => {
    mockAuth.mockResolvedValue(parentSession);
    const response = await createAssignment(request(
      'http://localhost:3000/api/bilan-gratuit/v1/team/assignments',
      'POST',
      {},
    ));

    expect(response.status).toBe(403);
    expect(mockGuardRateLimit).not.toHaveBeenCalled();
    expect(mockCreateAssignment).not.toHaveBeenCalled();
  });

  it('propagates distributed rate-limit unavailability without calling autosave', async () => {
    mockAuth.mockResolvedValue(parentSession);
    mockGuardRateLimit.mockResolvedValue(NextResponse.json(
      { error: 'Rate limit temporarily unavailable' },
      { status: 503 },
    ));
    const response = await autosave(
      request(
        'http://localhost:3000/api/bilan-gratuit/v1/requests/current/attempts/attempt-1/responses/item-1',
        'PUT',
        { expectedVersion: 0, response: { selectedOptionIndex: 1 } },
      ),
      { params: Promise.resolve({ attemptId: 'attempt-1', itemId: 'item-1' }) },
    );

    expect(response.status).toBe(503);
    expect(mockAutosave).not.toHaveBeenCalled();
  });

  it('turns an ownership denial into a non-enumerating 404', async () => {
    mockAuth.mockResolvedValue(parentSession);
    mockGetPublishedReport.mockRejectedValue(
      new AssessmentEngineError('REPORT_NOT_PUBLISHED', 404),
    );
    const response = await getReport(
      request(
        'http://localhost:3000/api/bilan-gratuit/v1/requests/current/attempts/foreign-attempt/report',
      ),
      { params: Promise.resolve({ attemptId: 'foreign-attempt' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Ressource indisponible.',
    });
  });

  it('passes a validated autosave without exposing any correction field', async () => {
    mockAuth.mockResolvedValue(parentSession);
    mockAutosave.mockResolvedValue({
      id: 'response-1',
      itemId: 'item-1',
      version: 1,
      lastAutosavedAt: '2026-07-30T10:00:00.000Z',
    });
    const response = await autosave(
      request(
        'http://localhost:3000/api/bilan-gratuit/v1/requests/current/attempts/attempt-1/responses/item-1',
        'PUT',
        { expectedVersion: 0, response: { selectedOptionIndex: 1 } },
      ),
      { params: Promise.resolve({ attemptId: 'attempt-1', itemId: 'item-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(payload)).not.toMatch(/correct|rationale|grading/i);
    expect(mockAutosave).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actor: { role: 'PARENT', userId: 'parent-user-1' },
        idempotencyKey: 'engine_key_123456789',
      }),
    );
  });

  it('keeps provisional scoring disabled unless the central flag enables it', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockScore.mockResolvedValue({ id: 'score-1', resultKind: 'PROVISIONAL' });
    const response = await scoreAttempt(
      request(
        'http://localhost:3000/api/bilan-gratuit/v1/team/attempts/attempt-1/score',
        'POST',
        { resultKind: 'PROVISIONAL' },
      ),
      { params: Promise.resolve({ attemptId: 'attempt-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockScore).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ provisionalResultsEnabled: false }),
    );
  });
});
