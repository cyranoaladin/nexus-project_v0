/**
 * Unit tests for lib/quotes/candidat-individuel-guard.server.ts (mission
 * "vers un produit complet" §9 — security checklist). Every route under
 * app/api/assistante/candidat-individuel/** and the wizard-preview page
 * depend on this guard; verifying it in isolation proves PARENT/ELEVE/
 * COACH/unauthenticated rejection for the whole surface at once, rather
 * than re-asserting it per route (requireAnyRole itself is already
 * covered exhaustively by __tests__/lib/guards*.test.ts — this test
 * verifies THIS module calls it with the right role list, not that
 * requireAnyRole works).
 */
const mockRequireAnyRole = jest.fn();
jest.mock('@/lib/guards', () => {
  return {
    requireAnyRole: (...args: unknown[]) => mockRequireAnyRole(...args),
    isErrorResponse: (r: unknown) => {
      if (typeof r !== 'object' || r === null) return false;
      const x = r as { json?: unknown; status?: unknown };
      return typeof x.json === 'function' && 'status' in (r as object);
    },
  };
});

import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { _resetForTest, _setForTest } from '@/lib/config/snapshot';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';

function activatePipeline() {
  _setForTest([
    { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() },
  ]);
}

beforeEach(() => {
  _resetForTest();
  jest.clearAllMocks();
});

describe('requireInternalPipelineAccess — role list, security checklist mission §9', () => {
  test('calls requireAnyRole with exactly [ADMIN, ASSISTANTE] — PARENT/ELEVE/COACH excluded by construction, not by convention', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN', email: 'a@test.com' } });
    activatePipeline();
    await requireInternalPipelineAccess();
    expect(mockRequireAnyRole).toHaveBeenCalledTimes(1);
    expect(mockRequireAnyRole).toHaveBeenCalledWith([UserRole.ADMIN, UserRole.ASSISTANTE]);
  });

  test('propagates a 403 from requireAnyRole unchanged (PARENT/ELEVE/COACH/unauthenticated all rejected upstream by the shared guard)', async () => {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mockRequireAnyRole.mockResolvedValue(forbidden);
    activatePipeline();
    const result = await requireInternalPipelineAccess();
    expect((result as Response).status).toBe(403);
  });

  test('a valid role but flag OFF (default) is still 403 — never accessible before ACTIVE_INTERNAL', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN', email: 'a@test.com' } });
    // flag left at its OFF default (no activatePipeline() call)
    const result = await requireInternalPipelineAccess();
    expect((result as Response).status).toBe(403);
  });

  test('valid role + flag ACTIVE_INTERNAL returns the session', async () => {
    const session = { user: { id: 'u1', role: 'ASSISTANTE', email: 'a@test.com' } };
    mockRequireAnyRole.mockResolvedValue(session);
    activatePipeline();
    const result = await requireInternalPipelineAccess();
    expect(result).toBe(session);
  });
});
