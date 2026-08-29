/**
 * GET   /api/assistante/candidat-individuel/profils/:id — resume a draft.
 * PATCH /api/assistante/candidat-individuel/profils/:id — save edits to a draft.
 *
 * Access: ADMIN/ASSISTANTE, AND pricing.candidatIndividuelPipeline.state
 * must be at least ACTIVE_INTERNAL (mission recâblage §5/§6).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { profilCandidatDraftBodySchema } from '@/lib/quotes/candidat-individuel-api-schemas';
import { getProfilCandidatWithIdentity, updateProfilCandidat } from '@/lib/quotes/profil-candidat.server';

const NOT_FOUND = { error: 'Profil introuvable' };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;

  const { id } = await params;
  const profil = await getProfilCandidatWithIdentity(id);
  if (!profil) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json({ profil });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = profilCandidatDraftBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const result = await updateProfilCandidat(id, parsed.data);
  if (!result.ok) {
    if ('notFound' in result) return NextResponse.json(NOT_FOUND, { status: 404 });
    return NextResponse.json(
      { error: 'Profil incomplet', unresolvedFields: result.unresolvedFields, missingRequiredFields: result.missingRequiredFields },
      { status: 422 },
    );
  }
  return NextResponse.json({ profil: result.profil });
}
