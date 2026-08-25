/**
 * POST /api/assistante/candidat-individuel/profils — create/save a
 * ProfilCandidat draft.
 * GET  /api/assistante/candidat-individuel/profils — resume: list existing
 * drafts (optionally filtered by contactLeadId/studentId).
 *
 * Access: ADMIN/ASSISTANTE, AND pricing.candidatIndividuelPipeline.state
 * must be at least ACTIVE_INTERNAL (mission recâblage §5/§6).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse, type AuthSession } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { profilCandidatDraftBodySchema } from '@/lib/quotes/candidat-individuel-api-schemas';
import { createProfilCandidat, listProfilsCandidats } from '@/lib/quotes/profil-candidat.server';

export async function POST(request: NextRequest) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;
  const session = access as AuthSession;

  const json = await request.json().catch(() => null);
  const parsed = profilCandidatDraftBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const result = await createProfilCandidat(parsed.data, session.user.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Profil incomplet', unresolvedFields: result.unresolvedFields, missingRequiredFields: result.missingRequiredFields },
      { status: 422 },
    );
  }
  return NextResponse.json({ profil: result.profil }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;

  const { searchParams } = new URL(request.url);
  const profils = await listProfilsCandidats({
    contactLeadId: searchParams.get('contactLeadId') ?? undefined,
    studentId: searchParams.get('studentId') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  });
  return NextResponse.json({ profils });
}
