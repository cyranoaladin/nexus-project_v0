/**
 * Shared guard for the assistante-workspace candidat-individuel API
 * (mission recâblage §5) — every route under
 * app/api/assistante/candidat-individuel/** must pass both checks: role
 * (ADMIN/ASSISTANTE) AND the pipeline rollout flag being at least
 * ACTIVE_INTERNAL. The whole surface stays behind the flag, not just the
 * simulate action — while pricing.candidatIndividuelPipeline.state is OFF
 * (its fail-closed default, unchanged by this commit), every route here
 * returns 403, matching the mission's explicit NO-GO-for-now posture.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireAnyRole, isErrorResponse, type AuthSession } from '@/lib/guards';
import { isActiveForInternalStaff } from './pipeline-flag';

export async function requireInternalPipelineAccess(): Promise<AuthSession | NextResponse> {
  const result = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(result)) return result;
  if (!isActiveForInternalStaff()) {
    return NextResponse.json(
      {
        error: 'Pipeline not active for internal staff',
        message: "Le nouveau moteur candidat-individuel n'est pas activé (pricing.candidatIndividuelPipeline.state doit être ACTIVE_INTERNAL ou plus).",
      },
      { status: 403 },
    );
  }
  return result;
}
