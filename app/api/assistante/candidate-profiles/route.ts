/**
 * POST /api/assistante/candidate-profiles — creates a ProfilCandidat
 * (Track A, Section 12). Staff-only (ADMIN/ASSISTANTE); the workflow
 * feature flag is checked server-side in addition to RBAC (Section A12 —
 * must govern server-side, not just UI). createdByUserId is always the
 * authenticated session's own id, never client-supplied.
 */
import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import { createProfilCandidat } from '@/lib/quotes/candidate-profile-persistence.server';
import { createProfilCandidatSchema } from '@/lib/quotes/candidate-profile-schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'candidate-profile-create',
    identity: sessionOrError.user.id,
  });
  if (blocked) return blocked;

  const workflowStatus = await getCandidateProfileWorkflowStatus();
  if (workflowStatus !== 'ACTIVE_INTERNAL') {
    return NextResponse.json({ error: 'candidate_profile_workflow_disabled' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = createProfilCandidatSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const profil = await createProfilCandidat({
      ...input,
      // Never trusted from the client — always the authenticated staff session.
      createdByUserId: sessionOrError.user.id,
    });
    return NextResponse.json(profil, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return NextResponse.json({ error: 'referenced_entity_not_found' }, { status: 400 });
    }
    throw error;
  }
}
