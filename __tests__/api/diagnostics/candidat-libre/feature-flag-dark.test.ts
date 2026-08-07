/**
 * Proves the candidate-libre diagnostic is entirely dark when
 * CANDIDATE_DIAGNOSTIC_ENABLED is not set to 'true'.
 *
 * Every route handler must return 404 *before* touching auth, RBAC, rate
 * limiting or the database — not merely return 404 as a coincidental
 * downstream result. So this suite asserts both the response status AND
 * that requireAnyRole/requireRole/guardRateLimitAsync were never called.
 * That's a role-independent proof: since the flag check is the first line
 * and short-circuits before any role is even resolved, no role — ELEVE,
 * PARENT, COACH, ASSISTANTE, ADMIN, or unauthenticated — can reach further.
 * The ADMIN-bypass test below makes that explicit: even a mock session an
 * auth layer would normally grant access to still gets 404 when the flag
 * is off, because the guard never lets the session resolution run at all.
 *
 * Source: lib/diagnostics/candidat-libre/feature-flag.ts
 */

import { NextResponse } from 'next/server';

const mockRequireAnyRole = jest.fn();
const mockRequireRole = jest.fn();
const mockIsErrorResponse = jest.fn((...args: unknown[]) => args[0] instanceof NextResponse);
const mockRequireParentOwnsStudent = jest.fn();
const mockRequireCoachAssignedToStudent = jest.fn();

jest.mock('@/lib/guards', () => ({
  requireAnyRole: (...args: unknown[]) => mockRequireAnyRole(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  isErrorResponse: (...args: unknown[]) => mockIsErrorResponse(...args),
  requireParentOwnsStudent: (...args: unknown[]) => mockRequireParentOwnsStudent(...args),
  requireCoachAssignedToStudent: (...args: unknown[]) => mockRequireCoachAssignedToStudent(...args),
}));

const mockGuardRateLimit = jest.fn();
jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: (...args: unknown[]) => mockGuardRateLimit(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        throw new Error('prisma must never be touched while the diagnostic feature flag is off');
      },
    },
  ),
}));

import { GET as diagnosticsGet, POST as diagnosticsPost } from '@/app/api/diagnostics/candidat-libre/route';
import { GET as byIdGet, PATCH as byIdPatch } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/route';
import { GET as moduleGet, PUT as modulePut, POST as modulePost } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/modules/[moduleKey]/route';
import { GET as documentsGet, POST as documentsPost } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/documents/route';
import { GET as documentGet, DELETE as documentDelete } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/documents/[documentId]/route';
import { GET as parentGet, PUT as parentPut, POST as parentPost } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/parent/route';
import { POST as submitPost } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/submit/route';
import { GET as staffExportGet } from '@/app/api/diagnostics/candidat-libre/[diagnosticId]/staff-export/route';

const req = (method = 'GET') => new Request('http://localhost/api/diagnostics/candidat-libre', { method });
const diagnosticParams = () => ({ params: Promise.resolve({ diagnosticId: 'diag-1' }) });
const moduleParams = () => ({ params: Promise.resolve({ diagnosticId: 'diag-1', moduleKey: 'mathematiques' }) });
const documentParams = () => ({ params: Promise.resolve({ diagnosticId: 'diag-1', documentId: 'doc-1' }) });

type Handler = () => Promise<Response>;

const ROUTES: Array<[string, Handler]> = [
  ['POST /api/diagnostics/candidat-libre', () => diagnosticsPost(req('POST'))],
  ['GET /api/diagnostics/candidat-libre/{id}', () => byIdGet(req(), diagnosticParams())],
  ['PATCH /api/diagnostics/candidat-libre/{id}', () => byIdPatch(req('PATCH'), diagnosticParams())],
  ['GET /modules/{moduleKey}', () => moduleGet(req(), moduleParams())],
  ['PUT /modules/{moduleKey}', () => modulePut(req('PUT'), moduleParams())],
  ['POST /modules/{moduleKey}', () => modulePost(req('POST'), moduleParams())],
  ['GET /documents', () => documentsGet(req(), diagnosticParams())],
  ['POST /documents', () => documentsPost(req('POST'), diagnosticParams())],
  ['GET /documents/{documentId}', () => documentGet(req(), documentParams())],
  ['DELETE /documents/{documentId}', () => documentDelete(req('DELETE'), documentParams())],
  ['GET /parent', () => parentGet(req(), diagnosticParams())],
  ['PUT /parent', () => parentPut(req('PUT'), diagnosticParams())],
  ['POST /parent', () => parentPost(req('POST'), diagnosticParams())],
  ['POST /submit', () => submitPost(req('POST'), diagnosticParams())],
  ['GET /staff-export', () => staffExportGet(req(), diagnosticParams())],
];

// GET /api/diagnostics/candidat-libre reads a query string, tested separately below.
const diagnosticsGetHandler: [string, Handler] = [
  'GET /api/diagnostics/candidat-libre',
  () => diagnosticsGet(new Request('http://localhost/api/diagnostics/candidat-libre?targetSession=2027')),
];

describe('candidate-libre diagnostic — flag OFF ⇒ every route is dark', () => {
  const originalEnv = process.env.CANDIDATE_DIAGNOSTIC_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CANDIDATE_DIAGNOSTIC_ENABLED;
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.CANDIDATE_DIAGNOSTIC_ENABLED;
    else process.env.CANDIDATE_DIAGNOSTIC_ENABLED = originalEnv;
  });

  it.each([...ROUTES, diagnosticsGetHandler])('%s returns 404 with the flag unset, touching nothing downstream', async (_name, handler) => {
    const response = await handler();
    expect(response.status).toBe(404);
    expect(mockRequireAnyRole).not.toHaveBeenCalled();
    expect(mockRequireRole).not.toHaveBeenCalled();
    expect(mockGuardRateLimit).not.toHaveBeenCalled();
  });

  it.each(['false', '', '1', 'TRUE', 'yes', 'enabled'])('stays dark for a falsy/garbage flag value %j (only the exact string "true" opens it)', async (value) => {
    process.env.CANDIDATE_DIAGNOSTIC_ENABLED = value;
    const response = await submitPost(req('POST'), diagnosticParams());
    expect(response.status).toBe(404);
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it('even a session an auth layer would grant ADMIN access to never reaches the route logic while the flag is off', async () => {
    // Configure the mocks as if auth would succeed for ADMIN — proves the
    // flag check runs unconditionally, before any role is resolved, not
    // just for the roles this suite happens to simulate.
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mockRequireRole.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });

    const response = await staffExportGet(req(), diagnosticParams());
    expect(response.status).toBe(404);
    expect(mockRequireAnyRole).not.toHaveBeenCalled();
  });
});

describe('candidate-libre diagnostic — flag ON opens the gate', () => {
  afterEach(() => {
    delete process.env.CANDIDATE_DIAGNOSTIC_ENABLED;
  });

  it('with the flag set to "true", the route proceeds past the feature guard (and fails downstream on the unmocked-prisma trap, proving it got that far)', async () => {
    process.env.CANDIDATE_DIAGNOSTIC_ENABLED = 'true';
    mockRequireRole.mockResolvedValue({ user: { id: 'eleve-1', role: 'ELEVE' } });
    mockIsErrorResponse.mockReturnValue(false);

    // getDiagnosticForActor (unmocked, real) will touch the prisma proxy and throw —
    // proof the guard let the request through instead of short-circuiting.
    await expect(submitPost(req('POST'), diagnosticParams())).rejects.toThrow(
      'prisma must never be touched while the diagnostic feature flag is off',
    );
  });
});
